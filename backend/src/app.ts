import express from 'express';
import cors from 'cors';
import { ensureInit } from './db';
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
import advancesRoutes from './routes/advances';
import taxComputationRoutes from './routes/taxComputation';
import announcementsRoutes from './routes/announcements';
import kbArticlesRoutes from './routes/kb/articles';
import kbSubcontractorsRoutes from './routes/kb/subcontractors';
import { runMarkAbsent } from './jobs/markAbsent';
import { runCreditLeaves, runResetLeaves } from './jobs/creditLeaves';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

// Ensure DB schema is ready before handling any request
app.use((_req, _res, next) => {
  ensureInit().then(next).catch(next);
});

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
app.use('/api/advances', advancesRoutes);
app.use('/api/tax-computation', taxComputationRoutes);

// Announcements module
app.use('/api/announcements', announcementsRoutes);

// Attendance module
app.use('/api/attendance', attendanceRoutes);

// Knowledge Base module
app.use('/api/kb/articles', kbArticlesRoutes);
app.use('/api/kb/subcontractors', kbSubcontractorsRoutes);

// LMS module
app.use('/api/lms/courses', lmsCoursesRoutes);
app.use('/api/lms/courses', lmsQuestionsRoutes);
app.use('/api/lms/attempts', lmsAttemptsRoutes);
app.use('/api/lms/reports', lmsReportsRoutes);

// Cron endpoints — called by Vercel Cron Jobs
const CRON_SECRET = process.env.CRON_SECRET;

function verifyCron(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}

app.get('/api/cron/mark-absent', verifyCron, async (_req, res) => {
  try {
    const changes = await runMarkAbsent();
    res.json({ ok: true, changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cron/credit-leaves', verifyCron, async (_req, res) => {
  try {
    await runCreditLeaves();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cron/reset-leaves', verifyCron, async (_req, res) => {
  try {
    await runResetLeaves();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use(errorHandler as express.ErrorRequestHandler);

export default app;
