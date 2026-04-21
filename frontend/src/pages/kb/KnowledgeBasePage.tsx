import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../../components/shared/AppLayout';
import Modal from '../../components/shared/Modal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { listArticles, createArticle, updateArticle, deleteArticle } from '../../api/kb';
import type { KBArticle } from '../../api/kb';
import {
  listSubcontractors, createSubcontractor, updateSubcontractor, deleteSubcontractor,
} from '../../api/subcontractors';
import type { Subcontractor, SubcontractorPayload } from '../../api/subcontractors';
import { useAuth } from '../../context/AuthContext';

// ─── Shared helpers ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4,
};

// ─── Articles tab ──────────────────────────────────────────────────────────

const CATEGORIES = ['General', 'HR Policy', 'IT & Systems', 'Onboarding', 'Benefits', 'Compliance', 'Finance'];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'General':      { bg: '#e0e7ff', text: '#3730a3' },
  'HR Policy':    { bg: '#fce7f3', text: '#9d174d' },
  'IT & Systems': { bg: '#d1fae5', text: '#065f46' },
  'Onboarding':   { bg: '#fef3c7', text: '#92400e' },
  'Benefits':     { bg: '#ede9fe', text: '#5b21b6' },
  'Compliance':   { bg: '#fee2e2', text: '#991b1b' },
  'Finance':      { bg: '#dbeafe', text: '#1e40af' },
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: colors.bg, color: colors.text,
    }}>
      {category}
    </span>
  );
}

function ArticleForm({ initial, onSubmit, onCancel }: {
  initial: KBArticle | null;
  onSubmit: (d: { title: string; content: string; category: string; tags: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'General');
  const [tags, setTags] = useState(initial?.tags ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try { await onSubmit({ title: title.trim(), content: content.trim(), category, tags: tags.trim() }); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>Title <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Article title" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          style={{ ...inputStyle, background: 'white' }}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Tags <span style={{ fontWeight: 400, color: '#9ca3af' }}>(comma-separated)</span></label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. leave, policy, remote" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Content</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
          placeholder="Write the article content here..."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" onClick={onCancel}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Article'}
        </button>
      </div>
    </form>
  );
}

function ArticleViewer({ article }: { article: KBArticle }) {
  const tagList = article.tags ? article.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <CategoryBadge category={article.category} />
        {tagList.map((tag) => (
          <span key={tag} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: '#f3f4f6', color: '#6b7280' }}>
            #{tag}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
        By {article.author_name} &middot; {new Date(article.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, color: '#374151', fontSize: 14, fontFamily: 'inherit' }}>
        {article.content || <span style={{ color: '#9ca3af' }}>No content provided.</span>}
      </div>
    </div>
  );
}

function ArticlesTab({ canManage }: { canManage: boolean }) {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewing, setViewing] = useState<KBArticle | null>(null);
  const [editing, setEditing] = useState<KBArticle | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<KBArticle | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (s?: string, cat?: string) => {
    setLoading(true);
    try { const data = await listArticles({ search: s, category: cat }); setArticles(data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load('', 'All'); }, [load]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(val, activeCategory), 350);
  };

  const handleCategoryChange = (cat: string) => { setActiveCategory(cat); load(search, cat); };

  const handleCreate = async (data: { title: string; content: string; category: string; tags: string }) => {
    await createArticle(data); setShowForm(false); load(search, activeCategory);
  };

  const handleUpdate = async (data: { title: string; content: string; category: string; tags: string }) => {
    if (!editing) return;
    await updateArticle(editing.id, data);
    setEditing(null); setShowForm(false);
    if (viewing?.id === editing.id) setViewing(null);
    load(search, activeCategory);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteArticle(deleting.id);
    setDeleting(null);
    if (viewing?.id === deleting.id) setViewing(null);
    load(search, activeCategory);
  };

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search articles by title, content, or tags…"
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        {canManage && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ marginLeft: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + New Article
          </button>
        )}
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['All', ...CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => handleCategoryChange(cat)}
            style={{
              padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: '1px solid', cursor: 'pointer',
              borderColor: activeCategory === cat ? '#6366f1' : '#e5e7eb',
              background: activeCategory === cat ? '#6366f1' : 'white',
              color: activeCategory === cat ? 'white' : '#4b5563',
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 15 }}>
            {search ? 'No articles match your search.' : 'No articles yet.'}
          </p>
          {canManage && !search && (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ marginTop: 14, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Create first article
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {articles.map((article) => {
            const tagList = article.tags ? article.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
            const excerpt = article.content.length > 120 ? article.content.slice(0, 120).trimEnd() + '…' : article.content;
            return (
              <div key={article.id} onClick={() => setViewing(article)}
                style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 9 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#c7d2fe'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CategoryBadge category={article.category} />
                  {canManage && (
                    <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditing(article); setShowForm(true); }}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6366f1', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => setDeleting(article)}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #fee2e2', background: 'white', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>{article.title}</h3>
                {excerpt && <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{excerpt}</p>}
                {tagList.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {tagList.map((tag) => (
                      <span key={tag} style={{ fontSize: 11, color: '#9ca3af', background: '#f9fafb', borderRadius: 8, padding: '1px 6px', border: '1px solid #f3f4f6' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                  {article.author_name} &middot; {new Date(article.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ''} size="lg">
        {viewing && <ArticleViewer article={viewing} />}
      </Modal>
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? 'Edit Article' : 'New Article'} size="lg">
        <ArticleForm initial={editing} onSubmit={editing ? handleUpdate : handleCreate} onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete Article"
        message={`Are you sure you want to delete "${deleting?.title}"? This action cannot be undone.`}
        confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
    </>
  );
}

// ─── Sub-contractors tab ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:      { bg: '#d1fae5', text: '#065f46' },
  inactive:    { bg: '#f3f4f6', text: '#6b7280' },
  blacklisted: { bg: '#fee2e2', text: '#991b1b' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

const EMPTY_SC: SubcontractorPayload = {
  name: '', company: '', contact_person: '', email: '', phone: '',
  expertise: '', status: 'active', location: '', projects_worked: '', notes: '',
};

function SubcontractorForm({ initial, onSubmit, onCancel }: {
  initial: Subcontractor | null;
  onSubmit: (d: SubcontractorPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SubcontractorPayload>(
    initial
      ? { name: initial.name, company: initial.company, contact_person: initial.contact_person,
          email: initial.email, phone: initial.phone, expertise: initial.expertise,
          status: initial.status, location: initial.location,
          projects_worked: initial.projects_worked, notes: initial.notes }
      : { ...EMPTY_SC },
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof SubcontractorPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSubmit({ ...form, name: form.name.trim() }); }
    finally { setSaving(false); }
  };

  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={row2}>
        <div>
          <label style={labelStyle}>Name / Company <span style={{ color: '#ef4444' }}>*</span></label>
          <input value={form.name} onChange={set('name')} required placeholder="e.g. Acme Solutions" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Legal Entity / Brand</label>
          <input value={form.company} onChange={set('company')} placeholder="e.g. Acme Pvt Ltd" style={inputStyle} />
        </div>
      </div>

      <div style={row2}>
        <div>
          <label style={labelStyle}>Contact Person</label>
          <input value={form.contact_person} onChange={set('contact_person')} placeholder="Primary point of contact" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input value={form.email} onChange={set('email')} type="email" placeholder="contact@example.com" style={inputStyle} />
        </div>
      </div>

      <div style={row2}>
        <div>
          <label style={labelStyle}>Phone</label>
          <input value={form.phone} onChange={set('phone')} placeholder="+91 9876543210" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input value={form.location} onChange={set('location')} placeholder="City / Country" style={inputStyle} />
        </div>
      </div>

      <div style={row2}>
        <div>
          <label style={labelStyle}>Expertise / Domain</label>
          <input value={form.expertise} onChange={set('expertise')} placeholder="e.g. UI/UX, DevOps, Testing" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={set('status')} style={{ ...inputStyle, background: 'white' }}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blacklisted">Blacklisted</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Projects Worked On</label>
        <input value={form.projects_worked} onChange={set('projects_worked')}
          placeholder="e.g. Project Alpha (2023), Project Beta (2024)" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Notes / Remarks</label>
        <textarea value={form.notes} onChange={set('notes')} rows={4}
          placeholder="Performance history, special skills, rate details, etc."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
        <button type="button" onClick={onCancel}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Sub-contractor'}
        </button>
      </div>
    </form>
  );
}

function SubcontractorDetail({ sc }: { sc: Subcontractor }) {
  const field = (label: string, value: string) =>
    value ? (
      <div key={label} style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: 14, color: '#111827' }}>{value}</p>
      </div>
    ) : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <StatusBadge status={sc.status} />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          Last updated {new Date(sc.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Added by {sc.added_by_name}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
        {field('Legal Entity / Brand', sc.company)}
        {field('Contact Person', sc.contact_person)}
        {field('Email', sc.email)}
        {field('Phone', sc.phone)}
        {field('Location', sc.location)}
        {field('Expertise / Domain', sc.expertise)}
      </div>
      {field('Projects Worked On', sc.projects_worked)}
      {sc.notes && (
        <div style={{ marginTop: 4 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes / Remarks</p>
          <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {sc.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function SubcontractorsTab({ canManage, canDelete }: { canManage: boolean; canDelete: boolean }) {
  const [list, setList] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState<Subcontractor | null>(null);
  const [editing, setEditing] = useState<Subcontractor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<Subcontractor | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (s?: string, st?: string) => {
    setLoading(true);
    try { const data = await listSubcontractors({ search: s, status: st }); setList(data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load('', 'all'); }, [load]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(val, statusFilter), 350);
  };

  const handleStatusChange = (st: string) => { setStatusFilter(st); load(search, st); };

  const handleCreate = async (data: SubcontractorPayload) => {
    await createSubcontractor(data); setShowForm(false); load(search, statusFilter);
  };

  const handleUpdate = async (data: SubcontractorPayload) => {
    if (!editing) return;
    await updateSubcontractor(editing.id, data);
    setEditing(null); setShowForm(false);
    if (viewing?.id === editing.id) setViewing(null);
    load(search, statusFilter);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteSubcontractor(deleting.id);
    setDeleting(null);
    if (viewing?.id === deleting.id) setViewing(null);
    load(search, statusFilter);
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
    background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
  };
  const tdStyle: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 400 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, expertise, project…"
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'inactive', 'blacklisted'] as const).map((s) => (
            <button key={s} onClick={() => handleStatusChange(s)}
              style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1px solid', cursor: 'pointer',
                borderColor: statusFilter === s ? '#6366f1' : '#e5e7eb',
                background: statusFilter === s ? '#6366f1' : 'white',
                color: statusFilter === s ? 'white' : '#4b5563',
                textTransform: 'capitalize',
              }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {canManage && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add Sub-contractor
          </button>
        )}
      </div>

      {/* Stats row */}
      {!loading && list.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {(['active', 'inactive', 'blacklisted'] as const).map((s) => {
            const count = list.filter((r) => r.status === s).length;
            const c = STATUS_COLORS[s];
            return (
              <div key={s} style={{ padding: '8px 16px', borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{count}</span>
                <span style={{ fontSize: 12, color: c.text, textTransform: 'capitalize' }}>{s}</span>
              </div>
            );
          })}
          <div style={{ padding: '8px 16px', borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#3730a3' }}>{list.length}</span>
            <span style={{ fontSize: 12, color: '#3730a3' }}>Showing</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 15 }}>
            {search ? 'No sub-contractors match your search.' : 'No sub-contractors added yet.'}
          </p>
          {canManage && !search && (
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ marginTop: 14, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Add first sub-contractor
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name / Company', 'Contact', 'Expertise', 'Projects Worked On', 'Status', 'Last Updated', 'Actions'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((sc) => (
                <tr key={sc.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setViewing(sc)}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={tdStyle}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>{sc.name}</p>
                    {sc.company && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{sc.company}</p>}
                  </td>
                  <td style={tdStyle}>
                    {sc.contact_person && <p style={{ margin: 0 }}>{sc.contact_person}</p>}
                    {sc.email && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{sc.email}</p>}
                    {sc.phone && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{sc.phone}</p>}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 160 }}>
                    <span style={{ color: sc.expertise ? '#374151' : '#d1d5db' }}>{sc.expertise || '—'}</span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 200 }}>
                    <span style={{ color: sc.projects_worked ? '#374151' : '#d1d5db', fontSize: 12 }}>
                      {sc.projects_worked ? (sc.projects_worked.length > 80 ? sc.projects_worked.slice(0, 80) + '…' : sc.projects_worked) : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}><StatusBadge status={sc.status} /></td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 12, color: '#9ca3af' }}>
                    {new Date(sc.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canManage && (
                        <button onClick={() => { setEditing(sc); setShowForm(true); }}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6366f1', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleting(sc)}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fee2e2', background: 'white', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ''} size="lg">
        {viewing && (
          <>
            <SubcontractorDetail sc={viewing} />
            {canManage && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => { setEditing(viewing); setViewing(null); setShowForm(true); }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#6366f1', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Form modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }}
        title={editing ? 'Edit Sub-contractor' : 'Add Sub-contractor'} size="lg">
        <SubcontractorForm initial={editing} onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditing(null); }} />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleting} title="Delete Sub-contractor"
        message={`Are you sure you want to remove "${deleting?.name}" from the sub-contractor registry? This cannot be undone.`}
        confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

type Tab = 'articles' | 'subcontractors';

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('articles');

  const canManageArticles = user?.role === 'admin' || user?.role === 'hr';
  const canManageSC = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'projectlead';
  const canDeleteSC = user?.role === 'admin' || user?.role === 'hr';

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'articles',
      label: 'Articles',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
    },
    {
      key: 'subcontractors',
      label: 'Sub-contractors',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Knowledge Base</h2>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
          Policies, guides, and sub-contractor registry
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', border: 'none', borderRadius: '8px 8px 0 0',
                cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 500,
                background: active ? 'white' : 'transparent',
                color: active ? '#6366f1' : '#6b7280',
                borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'articles' && <ArticlesTab canManage={canManageArticles} />}
      {activeTab === 'subcontractors' && <SubcontractorsTab canManage={canManageSC} canDelete={canDeleteSC} />}
    </AppLayout>
  );
}
