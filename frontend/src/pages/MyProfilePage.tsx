import { useEffect, useState } from 'react';
import AppLayout from '../components/shared/AppLayout';
import { getMe, type Employee } from '../api/users';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', hr: 'HR', director: 'Director',
  projectlead: 'Project Lead', businesshead: 'Business Head',
  employee: 'Employee', vp_hr: 'VP HR&OD',
};

export default function MyProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<(Employee & { level: string; reporting_manager_name: string | null }) | null>(null);

  useEffect(() => {
    getMe().then(setProfile).catch(() => {});
  }, []);

  const initials = user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '';

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 14, color: value ? '#111827' : '#d1d5db' }}>{value || '—'}</p>
    </div>
  );

  return (
    <AppLayout>
      <div style={{ maxWidth: 700 }}>
        {/* Header card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 28, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>{profile?.name ?? user?.name}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>{profile?.designation || user?.designation || '—'}</p>
            <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: '#ede9fe', color: '#6d28d9' }}>
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Personal & Work Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Field label="Employee ID" value={profile?.emp_id} />
            <Field label="Email" value={profile?.email} />
            <Field label="Date of Birth" value={profile?.dob} />
            <Field label="Date of Joining" value={profile?.date_of_joining} />
            <Field label="Project" value={profile?.project} />
            <Field label="Location" value={profile?.location} />
            <Field label="State" value={profile?.state} />
            <Field label="Site / Office" value={profile?.site_office} />
            <Field label="Reporting Manager" value={profile?.reporting_manager_name} />
            <Field label="Level" value={profile?.level} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
