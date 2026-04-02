import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '..', 'hrms.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Unified users table (all roles) ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('admin','hr','director','projectlead','businesshead','employee')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── ATS tables ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS positions (
    id              TEXT    PRIMARY KEY,
    job_id          TEXT    NOT NULL UNIQUE,
    project         TEXT    NOT NULL,
    nature_of_work  TEXT    NOT NULL DEFAULT '',
    department      TEXT    NOT NULL,
    indent_date     TEXT    NOT NULL DEFAULT '',
    role            TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
    total_req       INTEGER NOT NULL DEFAULT 1,
    required_by_date TEXT   NOT NULL DEFAULT '',
    interview_panel TEXT    NOT NULL DEFAULT '',
    hr_spoc         TEXT    NOT NULL,
    level           TEXT    NOT NULL DEFAULT '',
    approval_status TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    mobile                TEXT NOT NULL UNIQUE,
    email                 TEXT,
    alternate_mobile      TEXT NOT NULL DEFAULT '',
    job_id                TEXT NOT NULL,
    candidate_current_role TEXT NOT NULL DEFAULT '',
    stage                 TEXT NOT NULL DEFAULT 'Profile shared with interviewer',
    interviewer           TEXT NOT NULL,
    feedback              TEXT NOT NULL DEFAULT '',
    sourcing_date         TEXT NOT NULL DEFAULT '',
    interview_done_date   TEXT NOT NULL DEFAULT '',
    offer_release_date    TEXT NOT NULL DEFAULT '',
    expected_joining_date TEXT NOT NULL DEFAULT '',
    joined_date           TEXT NOT NULL DEFAULT '',
    hr_spoc               TEXT NOT NULL,
    current_company       TEXT,
    experience            TEXT,
    current_ctc           TEXT,
    expected_ctc          TEXT,
    notice_period         TEXT,
    remarks               TEXT,
    offer_approval_status TEXT NOT NULL DEFAULT '',
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── LMS tables ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    youtube_url  TEXT    NOT NULL,
    created_by   INTEGER NOT NULL REFERENCES users(id),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id      INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    question_text  TEXT    NOT NULL,
    option_a       TEXT    NOT NULL,
    option_b       TEXT    NOT NULL,
    option_c       TEXT    NOT NULL,
    option_d       TEXT    NOT NULL,
    correct_option TEXT    NOT NULL CHECK(correct_option IN ('a','b','c','d')),
    order_index    INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    course_id    INTEGER NOT NULL REFERENCES courses(id),
    watched      INTEGER NOT NULL DEFAULT 0,
    score        INTEGER,
    total        INTEGER,
    answers      TEXT,
    submitted_at TEXT,
    started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id)
  );

  CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_user    ON attempts(user_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_course  ON attempts(course_id);
  CREATE INDEX IF NOT EXISTS idx_candidates_job   ON candidates(job_id);
  CREATE INDEX IF NOT EXISTS idx_positions_job    ON positions(job_id);
`);

// ── Seed default users on first run ─────────────────────────────────────────
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
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

  const stmt = db.prepare(
    'INSERT INTO users (username, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  );

  for (const u of seedUsers) {
    const hash = bcrypt.hashSync(u.password, 10);
    stmt.run(u.username, u.email, u.name, hash, u.role);
  }

  console.log('Users seeded (admin, hr x3, director, projectlead, businesshead, employee)');
}

export default db;
