import { apiFetch } from './client';

const BASE = 'http://localhost:4000/api/attendance';

export interface AttendanceRecord {
  id: number;
  user_id: number;
  user_name?: string;
  user_role?: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'leave' | 'half-day';
  work_hours: number | null;
  notes: string;
}

export interface LeaveRequest {
  id: number;
  user_id: number;
  user_name?: string;
  user_role?: string;
  start_date: string;
  end_date: string;
  type: 'casual' | 'sick' | 'earned' | 'unpaid';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_name?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  leave: number;
  'half-day': number;
}

export interface EmployeeAttendanceSummary {
  user_id: number;
  user_name: string;
  user_role: string;
  present: number;
  half_day: number;
  leave_days: number;
  absent: number;
  total_days: number;
  avg_hours: number | null;
  today_status: string | null;
}

export const getToday = () =>
  apiFetch<AttendanceRecord | null>(`${BASE}/today`);

export const getSummary = (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  return apiFetch<AttendanceSummary>(`${BASE}/summary?${params}`);
};

export const getMyAttendance = (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  return apiFetch<AttendanceRecord[]>(`${BASE}?${params}`);
};

export const getAllAttendance = (month?: number, year?: number, userId?: number) => {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  if (userId) params.set('user_id', String(userId));
  return apiFetch<AttendanceRecord[]>(`${BASE}/all?${params}`);
};

export const getAttendanceReport = (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  return apiFetch<EmployeeAttendanceSummary[]>(`${BASE}/report?${params}`);
};

export const checkIn = () =>
  apiFetch<AttendanceRecord>(`${BASE}/check-in`, { method: 'POST' });

export const checkOut = () =>
  apiFetch<AttendanceRecord>(`${BASE}/check-out`, { method: 'POST' });

export const getMyLeaves = () =>
  apiFetch<LeaveRequest[]>(`${BASE}/leaves`);

export const getAllLeaves = (status?: string) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  return apiFetch<LeaveRequest[]>(`${BASE}/leaves/all?${params}`);
};

export const applyLeave = (data: { start_date: string; end_date: string; type: string; reason: string }) =>
  apiFetch<LeaveRequest>(`${BASE}/leaves`, { method: 'POST', body: JSON.stringify(data) });

export const approveLeave = (id: number) =>
  apiFetch<LeaveRequest>(`${BASE}/leaves/${id}/approve`, { method: 'PUT' });

export const rejectLeave = (id: number) =>
  apiFetch<LeaveRequest>(`${BASE}/leaves/${id}/reject`, { method: 'PUT' });
