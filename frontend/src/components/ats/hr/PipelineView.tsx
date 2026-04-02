import { useState, useEffect } from 'react';
import { getPipeline } from '../../../api/ats-positions';
import type { PipelineItem } from '../../../types';
import { STAGES } from '../../../types';
import Badge from '../../shared/Badge';

const STAGE_COLORS: Record<string, 'blue' | 'yellow' | 'green' | 'teal' | 'red' | 'gray'> = {
  'Profile shared with interviewer': 'blue',
  'Offer Negotiation': 'yellow',
  'Offer Released': 'green',
  'Joined': 'teal',
  'Offer Dropped': 'red',
  'Rejected': 'gray',
};

export default function PipelineView() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPipeline()
      .then(setPipeline)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading pipeline...</p>;
  if (pipeline.length === 0) return <p className="text-gray-500">No pipeline data available.</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Recruitment Pipeline</h2>
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Req</th>
              {STAGES.map((s) => (
                <th key={s} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {s}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pipeline.map((p) => (
              <tr key={p.job_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.job_id}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.project}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.role}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.total_req}</td>
                {STAGES.map((s) => (
                  <td key={s} className="px-4 py-3 text-sm text-center">
                    {p.stage_counts[s] ? (
                      <Badge label={String(p.stage_counts[s])} color={STAGE_COLORS[s] ?? 'gray'} />
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
