import { Pool, types } from 'pg';
import bcrypt from 'bcryptjs';

// Make bigint (COUNT, SUM) return JS numbers instead of strings
types.setTypeParser(20, (val: string) => parseInt(val, 10));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
  max: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Convert ? placeholders to $1, $2, ... for PostgreSQL
function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export const db = {
  async queryOne<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T | null> {
    const result = await pool.query(toPgSql(sql), args);
    return result.rows[0] ?? null;
  },
  async query<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
    const result = await pool.query(toPgSql(sql), args);
    return result.rows;
  },
  async run(sql: string, args: unknown[] = []): Promise<{ rowsAffected: number; lastInsertRowid: number }> {
    const result = await pool.query(toPgSql(sql), args);
    return {
      rowsAffected: result.rowCount ?? 0,
      lastInsertRowid: result.rows[0]?.id ?? 0,
    };
  },
};

let _initialized = false;
let _initPromise: Promise<void> | null = null;

export async function ensureInit(): Promise<void> {
  if (_initialized) return;
  if (!_initPromise) _initPromise = _init();
  await _initPromise;
  _initialized = true;
}

async function _runMigrations(): Promise<void> {
  // Column migrations — run in parallel, all idempotent
  await Promise.all([
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reporting_manager_id INTEGER REFERENCES users(id)`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS emp_id    TEXT`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dob       TEXT`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS project   TEXT NOT NULL DEFAULT ''`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS location  TEXT NOT NULL DEFAULT ''`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state     TEXT NOT NULL DEFAULT ''`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'active'`),
    pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS site_office TEXT NOT NULL DEFAULT ''`),
    pool.query(`ALTER TABLE salary_master ADD COLUMN IF NOT EXISTS hra               REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE salary_master ADD COLUMN IF NOT EXISTS special_allowance REAL NOT NULL DEFAULT 0`),
    pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lop BOOLEAN NOT NULL DEFAULT false`),
  ]);
}

async function _init(): Promise<void> {
  // Fast path: if users table already exists, only run lightweight column migrations
  const { rows } = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  `);
  if (rows.length > 0) {
    await _runMigrations();
    return;
  }

  // First-run path: create all tables, then migrations, then seed
  // ── Users ────────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL  PRIMARY KEY,
      username      TEXT    NOT NULL UNIQUE,
      email         TEXT    NOT NULL UNIQUE,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL CHECK(role IN ('admin','hr','director','projectlead','businesshead','employee')),
      site_office   TEXT    NOT NULL DEFAULT '',
      created_at    TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ── ATS ──────────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS positions (
      id              TEXT    PRIMARY KEY,
      job_id          TEXT    NOT NULL UNIQUE,
      project         TEXT    NOT NULL,
      nature_of_work  TEXT    NOT NULL DEFAULT '',
      department      TEXT    NOT NULL,
      indent_date     TEXT    NOT NULL DEFAULT '',
      role            TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive','active','closed')),
      total_req       INTEGER NOT NULL DEFAULT 1,
      required_by_date TEXT   NOT NULL DEFAULT '',
      interview_panel TEXT    NOT NULL DEFAULT '',
      hr_spoc         TEXT    NOT NULL,
      level           TEXT    NOT NULL DEFAULT '',
      approval_status TEXT    NOT NULL DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT '',
      updated_at      TEXT    NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id                     TEXT PRIMARY KEY,
      name                   TEXT NOT NULL,
      mobile                 TEXT NOT NULL UNIQUE,
      email                  TEXT,
      alternate_mobile       TEXT NOT NULL DEFAULT '',
      job_id                 TEXT NOT NULL,
      candidate_current_role TEXT NOT NULL DEFAULT '',
      stage                  TEXT NOT NULL DEFAULT 'Profile shared with interviewer',
      interviewer            TEXT NOT NULL,
      feedback               TEXT NOT NULL DEFAULT '',
      sourcing_date          TEXT NOT NULL DEFAULT '',
      interview_done_date    TEXT NOT NULL DEFAULT '',
      offer_release_date     TEXT NOT NULL DEFAULT '',
      expected_joining_date  TEXT NOT NULL DEFAULT '',
      joined_date            TEXT NOT NULL DEFAULT '',
      hr_spoc                TEXT NOT NULL,
      current_company        TEXT,
      experience             TEXT,
      current_ctc            TEXT,
      expected_ctc           TEXT,
      notice_period          TEXT,
      remarks                TEXT,
      offer_approval_status  TEXT NOT NULL DEFAULT '',
      created_at             TEXT NOT NULL DEFAULT '',
      updated_at             TEXT NOT NULL DEFAULT ''
    )
  `);

  // ── LMS ──────────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id          SERIAL PRIMARY KEY,
      title       TEXT   NOT NULL,
      description TEXT   NOT NULL DEFAULT '',
      youtube_url TEXT   NOT NULL,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      created_at  TEXT   NOT NULL DEFAULT '',
      updated_at  TEXT   NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id             SERIAL  PRIMARY KEY,
      course_id      INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      question_text  TEXT    NOT NULL,
      option_a       TEXT    NOT NULL,
      option_b       TEXT    NOT NULL,
      option_c       TEXT    NOT NULL,
      option_d       TEXT    NOT NULL,
      correct_option TEXT    NOT NULL CHECK(correct_option IN ('a','b','c','d')),
      order_index    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attempts (
      id           SERIAL  PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      course_id    INTEGER NOT NULL REFERENCES courses(id),
      watched      INTEGER NOT NULL DEFAULT 0,
      score        INTEGER,
      total        INTEGER,
      answers      TEXT,
      submitted_at TEXT,
      started_at   TEXT    NOT NULL DEFAULT '',
      UNIQUE(user_id, course_id)
    )
  `);

  // ── Attendance ───────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id         SERIAL  PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      date       TEXT    NOT NULL,
      check_in   TEXT,
      check_out  TEXT,
      status     TEXT    NOT NULL DEFAULT 'present',
      lop        BOOLEAN NOT NULL DEFAULT false,
      work_hours REAL,
      notes      TEXT    NOT NULL DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT '',
      updated_at TEXT    NOT NULL DEFAULT '',
      UNIQUE(user_id, date)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaves (
      id          SERIAL  PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      start_date  TEXT    NOT NULL,
      end_date    TEXT    NOT NULL,
      type        TEXT    NOT NULL DEFAULT 'casual',
      reason      TEXT    NOT NULL DEFAULT '',
      status      TEXT    NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      lop_days    REAL    NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT '',
      updated_at  TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ── Announcements ────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id         SERIAL  PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ── Salary master ────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salary_master (
      id                     SERIAL  PRIMARY KEY,
      employee_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      basic_salary           REAL    NOT NULL DEFAULT 0,
      hra                    REAL    NOT NULL DEFAULT 0,
      allowances             REAL    NOT NULL DEFAULT 0,
      deductions             REAL    NOT NULL DEFAULT 0,
      monthly_leave_allowance REAL   NOT NULL DEFAULT 1,
      meal_allowance         REAL    NOT NULL DEFAULT 0,
      fuel_allowance         REAL    NOT NULL DEFAULT 0,
      driver_allowance       REAL    NOT NULL DEFAULT 0,
      special_allowance      REAL    NOT NULL DEFAULT 0,
      updated_at             TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ── Payroll ──────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id         SERIAL  PRIMARY KEY,
      month      INTEGER NOT NULL,
      year       INTEGER NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','processed','paid')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT    NOT NULL DEFAULT '',
      updated_at TEXT    NOT NULL DEFAULT '',
      UNIQUE(month, year)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payroll_records (
      id               SERIAL  PRIMARY KEY,
      run_id           INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
      employee_id      INTEGER NOT NULL REFERENCES users(id),
      basic_salary     REAL    NOT NULL DEFAULT 0,
      allowances       REAL    NOT NULL DEFAULT 0,
      deductions       REAL    NOT NULL DEFAULT 0,
      working_days     INTEGER NOT NULL DEFAULT 0,
      present_days     INTEGER NOT NULL DEFAULT 0,
      leave_days       INTEGER NOT NULL DEFAULT 0,
      absent_days      INTEGER NOT NULL DEFAULT 0,
      lop_days         REAL    NOT NULL DEFAULT 0,
      lop_deduction    REAL    NOT NULL DEFAULT 0,
      meal_allowance   REAL    NOT NULL DEFAULT 0,
      fuel_allowance   REAL    NOT NULL DEFAULT 0,
      driver_allowance REAL    NOT NULL DEFAULT 0,
      created_at       TEXT    NOT NULL DEFAULT '',
      updated_at       TEXT    NOT NULL DEFAULT '',
      UNIQUE(run_id, employee_id)
    )
  `);

  // ── Knowledge Base ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kb_articles (
      id         SERIAL  PRIMARY KEY,
      title      TEXT    NOT NULL,
      content    TEXT    NOT NULL DEFAULT '',
      category   TEXT    NOT NULL DEFAULT 'General',
      tags       TEXT    NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT    NOT NULL DEFAULT '',
      updated_at TEXT    NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subcontractors (
      id               SERIAL  PRIMARY KEY,
      name             TEXT    NOT NULL,
      company          TEXT    NOT NULL DEFAULT '',
      contact_person   TEXT    NOT NULL DEFAULT '',
      email            TEXT    NOT NULL DEFAULT '',
      phone            TEXT    NOT NULL DEFAULT '',
      expertise        TEXT    NOT NULL DEFAULT '',
      status           TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','blacklisted')),
      location         TEXT    NOT NULL DEFAULT '',
      projects_worked  TEXT    NOT NULL DEFAULT '',
      notes            TEXT    NOT NULL DEFAULT '',
      added_by         INTEGER NOT NULL REFERENCES users(id),
      created_at       TEXT    NOT NULL DEFAULT '',
      updated_at       TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ── Leave balances ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance    REAL    NOT NULL DEFAULT 0,
      updated_at TEXT    NOT NULL DEFAULT ''
    )
  `);

  // ── Indexes ──────────────────────────────────────────────────────────────────
  await Promise.all([
    pool.query(`CREATE INDEX IF NOT EXISTS idx_candidates_job        ON candidates(job_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_positions_job         ON positions(job_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_questions_course      ON questions(course_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_attempts_user         ON attempts(user_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_attempts_course       ON attempts(course_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_user       ON attendance(user_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_leaves_user           ON leaves(user_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_announcements_user    ON announcements(user_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_salary_master_employee ON salary_master(employee_id)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_kb_articles_category  ON kb_articles(category)`),
    pool.query(`CREATE INDEX IF NOT EXISTS idx_subcontractors_status ON subcontractors(status)`),
  ]);

  await _runMigrations();

  // ── Seed default users on first run ──────────────────────────────────────────
  const adminExists = await db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminExists) {
    const now = new Date().toISOString();
    const seedUsers = [
      { username: 'admin',        email: 'admin@hrms.com',        name: 'Admin',          role: 'admin',        password: 'admin123' },
      { username: 'ravindra',     email: 'ravindra@hrms.com',     name: 'Ravindra Varma', role: 'hr',           password: 'hr123'    },
      { username: 'srinivas',     email: 'srinivas@hrms.com',     name: 'Srinivas',       role: 'hr',           password: 'hr123'    },
      { username: 'venu',         email: 'venu@hrms.com',         name: 'Venu',           role: 'hr',           password: 'hr123'    },
      { username: 'director',     email: 'director@hrms.com',     name: 'Director',       role: 'director',     password: 'dir123'   },
      { username: 'projectlead',  email: 'projectlead@hrms.com',  name: 'Project Lead',   role: 'projectlead',  password: 'lead123'  },
      { username: 'businesshead', email: 'businesshead@hrms.com', name: 'Business Head',  role: 'businesshead', password: 'bh123'    },
      { username: 'employee1',    email: 'employee1@hrms.com',    name: 'John Employee',  role: 'employee',     password: 'emp123'   },
    ];
    for (const u of seedUsers) {
      const hash = bcrypt.hashSync(u.password, 10);
      await pool.query(
        'INSERT INTO users (username, email, name, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [u.username, u.email, u.name, hash, u.role, now],
      );
    }
    // Seed leave balances for non-admin users
    await pool.query(`
      INSERT INTO leave_balances (user_id, balance, updated_at)
      SELECT id, 0, $1 FROM users WHERE role != 'admin'
      ON CONFLICT DO NOTHING
    `, [new Date().toISOString()]);
    console.log('Users seeded');
  }
}

export default db;
