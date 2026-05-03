import { Router, Response } from 'express';
import db from '../../db';
import { authenticateToken, requireRole, AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { search, status } = req.query as { search?: string; status?: string };

  let sql = `
    SELECT s.*, u.name AS added_by_name
    FROM subcontractors s
    JOIN users u ON u.id = s.added_by
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push('(s.name LIKE ? OR s.company LIKE ? OR s.contact_person LIKE ? OR s.expertise LIKE ? OR s.projects_worked LIKE ? OR s.location LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }
  if (status && status !== 'all') {
    conditions.push('s.status = ?');
    params.push(status);
  }

  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY s.updated_at DESC';

  res.json(await db.query(sql, params));
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const row = await db.queryOne(`
    SELECT s.*, u.name AS added_by_name
    FROM subcontractors s
    JOIN users u ON u.id = s.added_by
    WHERE s.id = ?
  `, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Sub-contractor not found' });
  res.json(row);
});

router.post('/', authenticateToken, requireRole('admin', 'hr', 'vp_hr', 'projectlead'), async (req: AuthRequest, res: Response) => {
  const { name, company, contact_person, email, phone, expertise, status, location, projects_worked, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const result = await db.run(
    `INSERT INTO subcontractors
       (name, company, contact_person, email, phone, expertise, status, location, projects_worked, notes, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [name.trim(), company ?? '', contact_person ?? '', email ?? '', phone ?? '',
     expertise ?? '', status ?? 'active', location ?? '', projects_worked ?? '', notes ?? '', req.user!.id],
  );

  res.status(201).json(await db.queryOne(`
    SELECT s.*, u.name AS added_by_name
    FROM subcontractors s
    JOIN users u ON u.id = s.added_by
    WHERE s.id = ?
  `, [result.lastInsertRowid]));
});

router.put('/:id', authenticateToken, requireRole('admin', 'hr', 'vp_hr', 'projectlead'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT id FROM subcontractors WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Sub-contractor not found' });

  const { name, company, contact_person, email, phone, expertise, status, location, projects_worked, notes } = req.body;
  const now = new Date().toISOString();

  await db.run(`
    UPDATE subcontractors SET
      name            = COALESCE(?, name),
      company         = COALESCE(?, company),
      contact_person  = COALESCE(?, contact_person),
      email           = COALESCE(?, email),
      phone           = COALESCE(?, phone),
      expertise       = COALESCE(?, expertise),
      status          = COALESCE(?, status),
      location        = COALESCE(?, location),
      projects_worked = COALESCE(?, projects_worked),
      notes           = COALESCE(?, notes),
      updated_at      = ?
    WHERE id = ?
  `, [name ?? null, company ?? null, contact_person ?? null, email ?? null, phone ?? null,
      expertise ?? null, status ?? null, location ?? null, projects_worked ?? null, notes ?? null,
      now, req.params.id]);

  res.json(await db.queryOne(`
    SELECT s.*, u.name AS added_by_name
    FROM subcontractors s
    JOIN users u ON u.id = s.added_by
    WHERE s.id = ?
  `, [req.params.id]));
});

router.delete('/:id', authenticateToken, requireRole('admin', 'hr', 'vp_hr'), async (req: AuthRequest, res: Response) => {
  const existing = await db.queryOne('SELECT id FROM subcontractors WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Sub-contractor not found' });

  await db.run('DELETE FROM subcontractors WHERE id = ?', [req.params.id]);
  res.json({ message: 'Sub-contractor deleted' });
});

export default router;
