import { useState, useEffect, useCallback, useMemo } from 'react';
import { listPositions, createPosition, updatePosition, deletePosition } from '../../../api/ats-positions';
import type { Position } from '../../../types';
import Modal from '../../shared/Modal';
import ConfirmDialog from '../../shared/ConfirmDialog';
import PositionForm from './PositionForm';

const COLS = ['Job ID', 'Project', 'Department', 'Role', 'Status', 'Total Req', 'Level', 'Approval', 'Actions'];

function SpocSummaryBar({ positions }: { positions: Position[] }) {
  const summary = useMemo(() => {
    const map: Record<string, { total: number; open: number }> = {};
    for (const p of positions) {
      const spoc = p.hr_spoc || 'Unassigned';
      if (!map[spoc]) map[spoc] = { total: 0, open: 0 };
      map[spoc].total += 1;
      if (p.status === 'Active') map[spoc].open += 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [positions]);

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {summary.map(([spoc, counts]) => (
        <div key={spoc} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
            {spoc.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800 leading-tight">{spoc}</p>
            <p className="text-xs text-gray-500 leading-tight">
              <span className="font-medium text-green-600">{counts.open} open</span>
              {' / '}
              <span>{counts.total} total</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionRows({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Position[];
  onEdit: (p: Position) => void;
  onDelete: (p: Position) => void;
}) {
  return (
    <>
      {rows.map((p) => (
        <tr key={p.id} className="hover:bg-gray-50">
          <td className="px-3 py-2 text-sm font-medium text-gray-900">{p.job_id}</td>
          <td className="px-3 py-2 text-sm text-gray-600">{p.project}</td>
          <td className="px-3 py-2 text-sm text-gray-600">{p.department}</td>
          <td className="px-3 py-2 text-sm text-gray-600">{p.role}</td>
          <td className="px-3 py-2 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {p.status}
            </span>
          </td>
          <td className="px-3 py-2 text-sm text-gray-600">{p.total_req}</td>
          <td className="px-3 py-2 text-sm text-gray-600">{p.level}</td>
          <td className="px-3 py-2 text-sm">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                p.approval_status === 'approved'
                  ? 'bg-green-100 text-green-700'
                  : p.approval_status === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : p.approval_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
              }`}
            >
              {p.approval_status || 'N/A'}
            </span>
          </td>
          <td className="px-3 py-2 text-sm">
            <div className="flex gap-2">
              <button onClick={() => onEdit(p)} className="text-indigo-600 hover:text-indigo-800 font-medium">
                Edit
              </button>
              <button onClick={() => onDelete(p)} className="text-red-600 hover:text-red-800 font-medium">
                Delete
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function PositionList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [deleting, setDeleting] = useState<Position | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPositions();
      setPositions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: Partial<Position>) => {
    await createPosition(data);
    setShowForm(false);
    load();
  };

  const handleUpdate = async (data: Partial<Position>) => {
    if (!editing) return;
    await updatePosition(editing.job_id, data);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deletePosition(deleting.job_id);
    setDeleting(null);
    load();
  };

  const filtered = positions.filter(
    (p) =>
      p.job_id.toLowerCase().includes(search.toLowerCase()) ||
      p.project.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by HR SPOC
  const grouped = useMemo(() => {
    const map: Record<string, Position[]> = {};
    for (const p of filtered) {
      const spoc = p.hr_spoc || 'Unassigned';
      if (!map[spoc]) map[spoc] = [];
      map[spoc].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleCollapse = (spoc: string) =>
    setCollapsed((prev) => ({ ...prev, [spoc]: !prev[spoc] }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search positions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="ml-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
        >
          + Add Position
        </button>
      </div>

      {!loading && positions.length > 0 && <SpocSummaryBar positions={positions} />}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No positions found.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([spoc, rows]) => {
            const openCount = rows.filter((p) => p.status === 'Active').length;
            const isCollapsed = collapsed[spoc];
            return (
              <div key={spoc} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleCollapse(spoc)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      {spoc.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{spoc}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {openCount} open
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {rows.length} total
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">{isCollapsed ? '▶' : '▼'}</span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {COLS.map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <PositionRows
                          rows={rows}
                          onEdit={(p) => { setEditing(p); setShowForm(true); }}
                          onDelete={(p) => setDeleting(p)}
                        />
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Position' : 'Add Position'}
        size="lg"
      >
        <PositionForm
          initial={editing}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Position"
        message={`Are you sure you want to delete position ${deleting?.job_id}?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
