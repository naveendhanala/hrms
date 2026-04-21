import { v4 as uuidv4 } from 'uuid';
import { ensureInit } from './db';
import db from './db';

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

const positions = [
  { job_id: 'JOB-001', project: 'Project Alpha',   department: 'Engineering', role: 'Frontend Developer',  total_req: 3, hr_spoc: 'Priya Sharma', required_by_date: '2026-04-30', status: 'active' },
  { job_id: 'JOB-002', project: 'Project Alpha',   department: 'Engineering', role: 'Backend Developer',   total_req: 2, hr_spoc: 'Priya Sharma', required_by_date: '2026-04-30', status: 'active' },
  { job_id: 'JOB-003', project: 'Project Beta',    department: 'Design',      role: 'UI/UX Designer',      total_req: 1, hr_spoc: 'Anita Desai',  required_by_date: '2026-05-15', status: 'active' },
  { job_id: 'JOB-004', project: 'Project Beta',    department: 'Engineering', role: 'Full Stack Developer', total_req: 4, hr_spoc: 'Anita Desai',  required_by_date: '2026-05-15', status: 'active' },
  { job_id: 'JOB-005', project: 'Project Gamma',   department: 'Data Science',role: 'Data Engineer',       total_req: 2, hr_spoc: 'Rahul Verma',  required_by_date: '2026-06-01', status: 'active' },
  { job_id: 'JOB-006', project: 'Project Gamma',   department: 'Data Science',role: 'ML Engineer',         total_req: 1, hr_spoc: 'Rahul Verma',  required_by_date: '2026-06-01', status: 'active' },
  { job_id: 'JOB-007', project: 'Project Delta',   department: 'QA',          role: 'QA Engineer',         total_req: 3, hr_spoc: 'Priya Sharma', required_by_date: '2026-04-15', status: 'active' },
  { job_id: 'JOB-008', project: 'Project Delta',   department: 'DevOps',      role: 'DevOps Engineer',     total_req: 2, hr_spoc: 'Rahul Verma',  required_by_date: '2026-05-01', status: 'active' },
  { job_id: 'JOB-009', project: 'Project Epsilon', department: 'Engineering', role: 'React Developer',     total_req: 2, hr_spoc: 'Anita Desai',  required_by_date: '2026-06-15', status: 'active' },
  { job_id: 'JOB-010', project: 'Project Epsilon', department: 'Engineering', role: 'Node.js Developer',   total_req: 2, hr_spoc: 'Priya Sharma', required_by_date: '2026-06-15', status: 'closed' },
];

const candidates = [
  { name: 'Amit Kumar',       mobile: '9876543210', job_id: 'JOB-001', interviewer: 'Vikram Singh', hr_spoc: 'Priya Sharma', stage: 'Profile shared with interviewer', email: 'amit.kumar@email.com',    current_company: 'TCS',          experience: '3 years', current_ctc: '8 LPA',  expected_ctc: '12 LPA', notice_period: '30 days' },
  { name: 'Sneha Patel',      mobile: '9876543211', job_id: 'JOB-001', interviewer: 'Vikram Singh', hr_spoc: 'Priya Sharma', stage: 'Offer Negotiation',              email: 'sneha.patel@email.com',   current_company: 'Infosys',      experience: '4 years', current_ctc: '10 LPA', expected_ctc: '15 LPA', notice_period: '60 days' },
  { name: 'Rajesh Gupta',     mobile: '9876543212', job_id: 'JOB-001', interviewer: 'Meena Iyer',   hr_spoc: 'Priya Sharma', stage: 'Offer Released',                 email: 'rajesh.gupta@email.com',  current_company: 'Wipro',        experience: '5 years', current_ctc: '12 LPA', expected_ctc: '18 LPA', notice_period: '90 days' },
  { name: 'Deepa Nair',       mobile: '9876543213', job_id: 'JOB-002', interviewer: 'Suresh Menon', hr_spoc: 'Priya Sharma', stage: 'Joined',                         email: 'deepa.nair@email.com',    current_company: 'HCL',          experience: '6 years', current_ctc: '15 LPA', expected_ctc: '22 LPA', notice_period: '30 days' },
  { name: 'Arjun Reddy',      mobile: '9876543214', job_id: 'JOB-002', interviewer: 'Suresh Menon', hr_spoc: 'Priya Sharma', stage: 'Rejected',                       email: 'arjun.reddy@email.com',   current_company: 'Cognizant',    experience: '2 years', current_ctc: '6 LPA',  expected_ctc: '10 LPA', notice_period: '30 days' },
  { name: 'Kavitha Sundaram', mobile: '9876543215', job_id: 'JOB-003', interviewer: 'Lakshmi Rao',  hr_spoc: 'Anita Desai',  stage: 'Profile shared with interviewer', email: 'kavitha.s@email.com',     current_company: 'Accenture',    experience: '4 years', current_ctc: '9 LPA',  expected_ctc: '14 LPA', notice_period: '60 days' },
  { name: 'Mohan Das',        mobile: '9876543216', job_id: 'JOB-003', interviewer: 'Lakshmi Rao',  hr_spoc: 'Anita Desai',  stage: 'Offer Negotiation',              email: 'mohan.das@email.com',     current_company: 'Deloitte',     experience: '5 years', current_ctc: '14 LPA', expected_ctc: '20 LPA', notice_period: '90 days' },
  { name: 'Priyanka Joshi',   mobile: '9876543217', job_id: 'JOB-004', interviewer: 'Anil Kapoor',  hr_spoc: 'Anita Desai',  stage: 'Joined',                         email: 'priyanka.j@email.com',    current_company: 'Mindtree',     experience: '7 years', current_ctc: '18 LPA', expected_ctc: '25 LPA', notice_period: '30 days' },
  { name: 'Sanjay Mehta',     mobile: '9876543218', job_id: 'JOB-004', interviewer: 'Anil Kapoor',  hr_spoc: 'Anita Desai',  stage: 'Profile shared with interviewer', email: 'sanjay.m@email.com',      current_company: 'Tech Mahindra',experience: '3 years', current_ctc: '7 LPA',  expected_ctc: '11 LPA', notice_period: '30 days' },
  { name: 'Ritu Agarwal',     mobile: '9876543219', job_id: 'JOB-005', interviewer: 'Naveen Kumar', hr_spoc: 'Rahul Verma',  stage: 'Offer Released',                 email: 'ritu.a@email.com',        current_company: 'Amazon',       experience: '5 years', current_ctc: '20 LPA', expected_ctc: '30 LPA', notice_period: '60 days' },
  { name: 'Vikash Yadav',     mobile: '9876543220', job_id: 'JOB-005', interviewer: 'Naveen Kumar', hr_spoc: 'Rahul Verma',  stage: 'Rejected',                       email: 'vikash.y@email.com',      current_company: 'Flipkart',     experience: '2 years', current_ctc: '12 LPA', expected_ctc: '18 LPA', notice_period: '30 days' },
  { name: 'Neha Bansal',      mobile: '9876543221', job_id: 'JOB-006', interviewer: 'Pooja Shah',   hr_spoc: 'Rahul Verma',  stage: 'Offer Negotiation',              email: 'neha.b@email.com',        current_company: 'Google',       experience: '4 years', current_ctc: '25 LPA', expected_ctc: '35 LPA', notice_period: '60 days' },
  { name: 'Karan Malhotra',   mobile: '9876543222', job_id: 'JOB-007', interviewer: 'Ravi Shankar', hr_spoc: 'Priya Sharma', stage: 'Profile shared with interviewer', email: 'karan.m@email.com',       current_company: 'Mphasis',      experience: '3 years', current_ctc: '8 LPA',  expected_ctc: '13 LPA', notice_period: '30 days' },
  { name: 'Swati Kulkarni',   mobile: '9876543223', job_id: 'JOB-007', interviewer: 'Ravi Shankar', hr_spoc: 'Priya Sharma', stage: 'Joined',                         email: 'swati.k@email.com',       current_company: 'L&T Infotech', experience: '5 years', current_ctc: '11 LPA', expected_ctc: '16 LPA', notice_period: '60 days' },
  { name: 'Rohit Saxena',     mobile: '9876543224', job_id: 'JOB-007', interviewer: 'Meena Iyer',   hr_spoc: 'Priya Sharma', stage: 'Offer Dropped',                  email: 'rohit.s@email.com',       current_company: 'Capgemini',    experience: '4 years', current_ctc: '10 LPA', expected_ctc: '15 LPA', notice_period: '90 days' },
  { name: 'Ananya Chatterjee',mobile: '9876543225', job_id: 'JOB-008', interviewer: 'Suresh Menon', hr_spoc: 'Rahul Verma',  stage: 'Profile shared with interviewer', email: 'ananya.c@email.com',      current_company: 'IBM',          experience: '6 years', current_ctc: '16 LPA', expected_ctc: '22 LPA', notice_period: '30 days' },
  { name: 'Nitin Sharma',     mobile: '9876543226', job_id: 'JOB-009', interviewer: 'Vikram Singh', hr_spoc: 'Anita Desai',  stage: 'Offer Negotiation',              email: 'nitin.s@email.com',       current_company: 'Persistent',   experience: '3 years', current_ctc: '9 LPA',  expected_ctc: '14 LPA', notice_period: '30 days' },
  { name: 'Pooja Tiwari',     mobile: '9876543227', job_id: 'JOB-009', interviewer: 'Vikram Singh', hr_spoc: 'Anita Desai',  stage: 'Rejected',                       email: 'pooja.t@email.com',       current_company: 'Zensar',       experience: '2 years', current_ctc: '6 LPA',  expected_ctc: '10 LPA', notice_period: '30 days' },
  { name: 'Manish Pandey',    mobile: '9876543228', job_id: 'JOB-010', interviewer: 'Anil Kapoor',  hr_spoc: 'Priya Sharma', stage: 'Joined',                         email: 'manish.p@email.com',      current_company: 'Hexaware',     experience: '5 years', current_ctc: '13 LPA', expected_ctc: '19 LPA', notice_period: '60 days' },
];

async function seed() {
  await ensureInit();

  const positionSql = `
    INSERT OR IGNORE INTO positions (id, job_id, project, department, role, total_req, hr_spoc, required_by_date, status, approval_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  for (const pos of positions) {
    await db.run(positionSql, [
      uuidv4(), pos.job_id, pos.project, pos.department, pos.role, pos.total_req,
      pos.hr_spoc, pos.required_by_date, pos.status, '', now, now,
    ]);
  }

  const candidateSql = `
    INSERT OR IGNORE INTO candidates (id, name, mobile, email, job_id, interviewer, hr_spoc, current_company, experience, current_ctc, expected_ctc, notice_period, remarks, stage, sourcing_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  for (const c of candidates) {
    await db.run(candidateSql, [
      uuidv4(), c.name, c.mobile, c.email, c.job_id, c.interviewer, c.hr_spoc,
      c.current_company, c.experience, c.current_ctc, c.expected_ctc,
      c.notice_period, null, c.stage, today, now, now,
    ]);
  }

  console.log('Seed data inserted successfully!');
  console.log(`  - ${positions.length} positions`);
  console.log(`  - ${candidates.length} candidates`);
}

seed().catch(console.error);
