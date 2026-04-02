import { useState, useEffect, useCallback } from 'react';
import { listPositions, createPosition, updatePosition, deletePosition } from '../../../api/ats-positions';
import type { Position } from '../../../types';
import Modal from '../../shared/Modal';
import ConfirmDialog from '../../shared/ConfirmDialog';
import PositionForm from './PositionForm';

export default function PositionList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [deleting, setDeleting] = useState<Position | null>(null);
  const [search, setSearch] = useState('');

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Positions</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + Add Position
        </button>
      </div>

      <input
        type="text"
        placeholder="Search positions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No positions found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Job ID', 'Project', 'Department', 'Role', 'Status', 'Total Req', 'HR SPOC', 'Level', 'Approval', 'Actions'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.department}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.total_req}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.hr_spoc}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.level}</td>
                  <td className="px-4 py-3 text-sm">
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
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setShowForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(p)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
