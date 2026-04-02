import { useState, useEffect, useCallback } from 'react';
import { listCandidates, createCandidate, updateCandidate, deleteCandidate, requestOfferApproval } from '../../../api/ats-candidates';
import type { Candidate } from '../../../types';
import Modal from '../../shared/Modal';
import ConfirmDialog from '../../shared/ConfirmDialog';
import CandidateForm from './CandidateForm';

export default function CandidateList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCandidates();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: Partial<Candidate>) => {
    await createCandidate(data);
    setShowForm(false);
    load();
  };

  const handleUpdate = async (data: Partial<Candidate>) => {
    if (!editing) return;
    await updateCandidate(editing.id, data);
    setEditing(null);
    setShowForm(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteCandidate(deleting.id);
    setDeleting(null);
    load();
  };

  const handleRequestApproval = async (id: string) => {
    await requestOfferApproval(id);
    load();
  };

  const filtered = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.job_id.toLowerCase().includes(search.toLowerCase()) ||
      c.stage.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Candidates</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + Add Candidate
        </button>
      </div>

      <input
        type="text"
        placeholder="Search candidates..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No candidates found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Mobile', 'Job ID', 'Stage', 'Interviewer', 'HR SPOC', 'Offer Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.mobile}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.job_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.stage}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.interviewer}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.hr_spoc}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.offer_approval_status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : c.offer_approval_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : c.offer_approval_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.offer_approval_status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setShowForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                      {c.stage === 'Offer Negotiation' && !c.offer_approval_status && (
                        <button
                          onClick={() => handleRequestApproval(c.id)}
                          className="text-amber-600 hover:text-amber-800 font-medium"
                        >
                          Request Approval
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

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Candidate' : 'Add Candidate'}
        size="lg"
      >
        <CandidateForm
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
        title="Delete Candidate"
        message={`Are you sure you want to delete candidate ${deleting?.name}?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
