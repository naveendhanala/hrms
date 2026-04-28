import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/dept-roles', authenticateToken, async (_req: AuthRequest, res: Response) => {
  const rows = await db.query<{ department: string; roles: string }>('SELECT department, roles FROM ats_dept_roles ORDER BY department ASC');
  const data = rows.map((r) => {
    const parsed = JSON.parse(r.roles as string) as Array<string | { name: string; level: string }>;
    const roles = parsed.map((item) => typeof item === 'string' ? { name: item, level: '' } : item);
    return { department: r.department, roles };
  });
  res.json(data);
});

router.put('/dept-roles', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const entries: { department: string; roles: string[] }[] = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Expected an array' });

  await db.run('DELETE FROM ats_dept_roles', []);
  for (const entry of entries) {
    if (!entry.department?.trim()) continue;
    await db.run(
      'INSERT INTO ats_dept_roles (department, roles) VALUES (?, ?) ON CONFLICT (department) DO UPDATE SET roles = EXCLUDED.roles',
      [entry.department.trim(), JSON.stringify(entry.roles ?? [])],
    );
  }
  res.json({ ok: true });
});

export default router;
