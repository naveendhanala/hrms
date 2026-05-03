// ── Auth ─────────────────────────────────────────────────
export type UserRole = 'admin' | 'hr' | 'director' | 'projectlead' | 'businesshead' | 'employee' | 'vp_hr';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  designation?: string;
  site_office?: string | null;
  project?: string;
}

// ── ATS Types ────────────────────────────────────────────
export const STAGES = [
  'Interview',
  'Offer Negotiation',
  'Offer Approval Pending',
  'Offer Released',
  'Joined',
  'Offer Dropped',
  'Rejected',
  'Candidate Not Responding',
  'Screen Reject',
] as const;

export type Stage = (typeof STAGES)[number];

export const HR_SPOC_OPTIONS = ['Ravindra Varma', 'Srinivas', 'Venu'] as const;
export const LEVEL_OPTIONS = ['APM Above', 'APM Below'] as const;
export const POSITION_STATUS_OPTIONS = ['Active', 'Inactive'] as const;

export interface Position {
  id: string;
  job_id: string;
  project: string;
  nature_of_work: string;
  department: string;
  indent_date: string;
  role: string;
  status: 'Active' | 'Inactive' | 'closed';
  total_req: number;
  required_by_date: string;
  interview_panel: string;
  hr_spoc: string;
  level: string;
  job_description: string;
  approval_status: '' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  candidate_count?: number;
  created_by?: number;
  is_replacement?: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  mobile: string;
  alternate_mobile: string;
  job_id: string;
  candidate_current_role: string;
  stage: Stage;
  interviewer: string;
  feedback: string;
  sourcing_date: string;
  interview_done_date: string;
  offer_release_date: string;
  expected_joining_date: string;
  joined_date: string;
  hr_spoc: string;
  email?: string;
  current_company?: string;
  experience?: string;
  current_ctc?: string;
  expected_ctc?: string;
  notice_period?: string;
  remarks?: string;
  offered_ctc?: string;
  offer_notes?: string;
  competency_feedback?: string;
  resume_url?: string;
  education?: string;
  work_experience?: string;
  created_at: string;
  updated_at: string;
  project: string;
  department: string;
  role: string;
  required_by_date: string;
  total_req: number;
}

export interface PipelineItem {
  job_id: string;
  project: string;
  department: string;
  role: string;
  total_req: number;
  required_by_date: string;
  hr_spoc: string;
  status: string;
  job_description: string;
  total: number;
  stage_counts: Record<string, number>;
}

// ── LMS Types ────────────────────────────────────────────
export interface Course {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  attempt?: Attempt | null;
  questions?: Question[];
}

export interface Question {
  id: number;
  course_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: string;
  order_index: number;
  created_at?: string;
}

export interface Attempt {
  id?: number;
  user_id?: number;
  course_id?: number;
  watched: number;
  score: number | null;
  total: number | null;
  answers?: string | null;
  submitted_at: string | null;
  started_at?: string;
}

export interface CompletionReport {
  user_id: number;
  user_name: string;
  user_email: string;
  course_id: number;
  course_title: string;
  watched: number | null;
  score: number | null;
  total: number | null;
  submitted_at: string | null;
  started_at: string | null;
}
