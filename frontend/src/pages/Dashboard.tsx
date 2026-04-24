import { useEffect, useRef, useState } from 'react';
import AppLayout from '../components/shared/AppLayout';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Announcement {
  id: number;
  content: string;
  created_at: string;
  author_name: string;
  author_role: string;
}

interface BirthdayEmployee {
  id: number;
  name: string;
  role: string;
  designation: string;
  location: string;
  dob: string;
  daysUntil: number;
  nextBirthday: Date;
}

function getUpcomingBirthdays(employees: { id: number; name: string; role: string; designation: string; location: string; dob: string }[]): BirthdayEmployee[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return employees
    .map(e => {
      const d = new Date(e.dob);
      const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
      return { ...e, daysUntil, nextBirthday: next };
    })
    .filter(e => e.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function BirthdayLabel({ days }: { days: number }) {
  if (days === 0) return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fce7f3', color: '#9d174d' }}>Today 🎂</span>;
  if (days === 1) return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#fef9c3', color: '#92400e' }}>Tomorrow</span>;
  return <span style={{ fontSize: 11, color: '#9ca3af' }}>in {days} days</span>;
}

function formatIST(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:        { bg: '#ede9fe', text: '#5b21b6' },
  hr:           { bg: '#dbeafe', text: '#1e40af' },
  director:     { bg: '#fce7f3', text: '#9d174d' },
  projectlead:  { bg: '#d1fae5', text: '#065f46' },
  businesshead: { bg: '#fef9c3', text: '#92400e' },
  employee:     { bg: '#f3f4f6', text: '#374151' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [birthdays, setBirthdays] = useState<BirthdayEmployee[]>([]);
  const [bdLoading, setBdLoading] = useState(true);
  const [annError, setAnnError] = useState(false);
  const [bdError, setBdError] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Announcement[]>('/api/announcements')
        .then(setAnnouncements)
        .catch(() => setAnnError(true))
        .finally(() => setAnnLoading(false)),

      apiFetch<{ id: number; name: string; role: string; designation: string; location: string; dob: string }[]>('/api/users/birthdays')
        .then(data => setBirthdays(getUpcomingBirthdays(data)))
        .catch(() => setBdError(true))
        .finally(() => setBdLoading(false)),
    ]);
  }, []);

  async function handlePost() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const created = await apiFetch<Announcement>('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({ content: draft.trim() }),
      });
      setAnnouncements(prev => [created, ...prev]);
      setDraft('');
    } catch {
      // ignore
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch {
      // ignore
    }
  }

  const canDelete = (ann: Announcement) =>
    user?.role === 'admin' || user?.role === 'hr' || ann.author_name === user?.name;

  return (
    <AppLayout>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Announcements feed */}
        <div style={{ background: '#ffffff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' }}>Announcements</h2>

          {/* Compose box */}
          <div style={{ marginBottom: 20, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write an announcement…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                border: 'none', outline: 'none', resize: 'none',
                fontSize: 14, color: '#111827', fontFamily: 'inherit',
                background: '#fafafa',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost();
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
              <button
                onClick={handlePost}
                disabled={posting || !draft.trim()}
                style={{
                  padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: draft.trim() ? 'pointer' : 'not-allowed',
                  background: draft.trim() ? '#6366f1' : '#e5e7eb',
                  color: draft.trim() ? '#ffffff' : '#9ca3af',
                }}
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>

          {/* Feed */}
          {annLoading ? (
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Loading…</p>
          ) : annError ? (
            <p style={{ fontSize: 13, color: '#991b1b', margin: 0 }}>Failed to load announcements.</p>
          ) : announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📢</div>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No announcements yet. Be the first to post!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {announcements.map(ann => {
                const initials = ann.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const roleStyle = ROLE_COLORS[ann.author_role] ?? ROLE_COLORS.employee;
                return (
                  <div key={ann.id} style={{ padding: '14px 16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ann.author_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: roleStyle.bg, color: roleStyle.text, textTransform: 'capitalize' }}>{ann.author_role}</span>
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatIST(ann.created_at)}</span>
                      </div>
                      {canDelete(ann) && (
                        <button
                          onClick={() => handleDelete(ann.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                          title="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ann.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Birthday anniversaries */}
        <div style={{ background: '#ffffff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>Birthday Anniversaries</h2>
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>· next 30 days</span>
          </div>

          {bdLoading ? (
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Loading…</p>
          ) : bdError ? (
            <p style={{ fontSize: 13, color: '#991b1b', margin: 0 }}>Failed to load birthdays.</p>
          ) : birthdays.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎂</div>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No birthdays in the next 30 days</p>
              <p style={{ fontSize: 12, color: '#d1d5db', margin: '4px 0 0' }}>Add DOB in employee profiles to see birthdays</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {birthdays.map((emp, i) => {
                const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const monthDay = emp.nextBirthday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                return (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < birthdays.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: emp.daysUntil === 0 ? 'linear-gradient(135deg,#f472b6,#ec4899)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{emp.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
                        {emp.designation || emp.role}
                        {emp.location ? ` · ${emp.location}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {emp.daysUntil === 0 && <BirthdayLabel days={0} />}
                      {emp.daysUntil === 1 && <BirthdayLabel days={1} />}
                      <p style={{ margin: emp.daysUntil <= 1 ? '3px 0 0' : 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>{monthDay}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
