import express from 'express';
import cors from 'cors';
import './db';
import authRoutes from './routes/auth';
import atsPositionsRoutes from './routes/ats/positions';
import atsCandidatesRoutes from './routes/ats/candidates';
import atsFeedbackRoutes from './routes/ats/feedback';
import atsReportRoutes from './routes/ats/report';
import lmsCoursesRoutes from './routes/lms/courses';
import lmsQuestionsRoutes from './routes/lms/questions';
import lmsAttemptsRoutes from './routes/lms/attempts';
import lmsReportsRoutes from './routes/lms/reports';
import attendanceRoutes from './routes/attendance/attendance';
import usersRoutes from './routes/users';
import payrollRoutes from './routes/payroll';
import announcementsRoutes from './routes/announcements';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

// Shared auth
app.use('/api/auth', authRoutes);

// ATS module
app.use('/api/ats/positions', atsPositionsRoutes);
app.use('/api/ats/candidates', atsCandidatesRoutes);
app.use('/api/ats/feedback', atsFeedbackRoutes);
app.use('/api/ats/report', atsReportRoutes);

// Users / Employees module
app.use('/api/users', usersRoutes);

// Payroll module
app.use('/api/payroll', payrollRoutes);

// Announcements module
app.use('/api/announcements', announcementsRoutes);

// Attendance module
app.use('/api/attendance', attendanceRoutes);

// LMS module
app.use('/api/lms/courses', lmsCoursesRoutes);
app.use('/api/lms/courses', lmsQuestionsRoutes);
app.use('/api/lms/attempts', lmsAttemptsRoutes);
app.use('/api/lms/reports', lmsReportsRoutes);

app.use(errorHandler as express.ErrorRequestHandler);

app.listen(PORT, () => {
  console.log(`HRMS server running on http://localhost:${PORT}`);
});
