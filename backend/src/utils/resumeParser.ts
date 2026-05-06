export interface EduEntry {
  degree: string;
  college: string;
  year: string;
}

export interface ExpEntry {
  company: string;
  designation: string;
  from: string;
  to: string;
  project: string;
}

export interface ParsedResume {
  name: string;
  mobile: string;
  education: EduEntry[];
  work_experience: ExpEntry[];
}

// ── Section detection ────────────────────────────────────────────────────────

const EDU_STARTS  = ['education', 'academic background', 'academic details', 'educational background', 'educational qualification', 'qualification', 'academics'];
const EDU_ENDS    = ['experience', 'work experience', 'professional experience', 'employment', 'skills', 'projects', 'certifications', 'achievements', 'declaration', 'references', 'hobbies', 'interests'];
const EXP_STARTS  = ['work experience', 'professional experience', 'experience', 'employment history', 'career history', 'employment details'];
const EXP_ENDS    = ['education', 'skills', 'projects', 'certifications', 'achievements', 'declaration', 'references', 'hobbies', 'interests', 'languages'];

function matchesHeader(line: string, headers: string[]): boolean {
  const l = line.toLowerCase().replace(/[:\-*•▪]/g, '').trim();
  return headers.some(h => l === h || l.startsWith(h + ' '));
}

function extractSection(lines: string[], starts: string[], ends: string[]): string[] {
  let si = -1;
  for (let i = 0; i < lines.length; i++) {
    if (matchesHeader(lines[i], starts)) { si = i + 1; break; }
  }
  if (si === -1) return [];

  let ei = lines.length;
  for (let i = si; i < lines.length; i++) {
    if (matchesHeader(lines[i], ends)) { ei = i; break; }
  }
  return lines.slice(si, ei);
}

// ── Name ─────────────────────────────────────────────────────────────────────

function extractName(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const t = line.trim();
    if (!t || t.length > 60) continue;
    if (t.includes('@')) continue;
    if (/[6-9]\d{9}/.test(t.replace(/\D/g, ''))) continue;
    if (/^(resume|curriculum vitae|cv|profile|summary)\b/i.test(t)) continue;
    if (/\b(pvt|ltd|technologies|solutions|software)\b/i.test(t)) continue;
    // Must look like a name: letters + spaces/dots/hyphens, 2+ words encouraged
    if (/^[A-Za-z][A-Za-z\s.'\-]{2,49}$/.test(t)) return t;
  }
  return '';
}

// ── Mobile ───────────────────────────────────────────────────────────────────

function extractMobile(text: string): string {
  // Strip spaces/dashes/parens and look for +91 or bare 10-digit starting 6-9
  const clean = text.replace(/[\s\-().+]/g, '');
  const m = clean.match(/(?:91)?([6-9]\d{9})/);
  return m ? m[1] : '';
}

// ── Education ────────────────────────────────────────────────────────────────

const DEGREE_TOKENS = [
  'b.tech', 'btech', 'b.e.', 'b.e ', 'be ',
  'm.tech', 'mtech', 'm.e.', 'm.e ',
  'mba', 'mca', 'bca',
  'b.sc', 'bsc', 'm.sc', 'msc',
  'b.com', 'bcom', 'm.com', 'mcom',
  'b.a.', 'b.a ', 'ba ', 'm.a.', 'm.a ', 'ma ',
  'phd', 'ph.d',
  'diploma',
  'intermediate', '12th', 'hsc', 'class xii', 'class 12',
  '10th', 'ssc', 'class x', 'class 10', 'matriculation',
];

function hasDegree(line: string): boolean {
  const l = ' ' + line.toLowerCase() + ' ';
  return DEGREE_TOKENS.some(d => l.includes(d));
}

function findYear(lines: string[], idx: number): string {
  for (let i = idx; i <= Math.min(idx + 3, lines.length - 1); i++) {
    // Graduation year range like 2016-2020 → take the later year
    const range = lines[i].match(/\b(19[89]\d|20[0-3]\d)\s*[-–]\s*(19[89]\d|20[0-3]\d)\b/);
    if (range) return range[2];
    const single = lines[i].match(/\b(19[89]\d|20[0-3]\d)\b/);
    if (single) return single[1];
  }
  return '';
}

function extractEducation(lines: string[]): EduEntry[] {
  const results: EduEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!hasDegree(lines[i])) continue;
    const year = findYear(lines, i);
    // College: scan ±2 lines for institution keyword
    let college = '';
    for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 3); j++) {
      if (j === i) continue;
      if (/university|institute|college|school|polytechnic|academy|board/i.test(lines[j]) && lines[j].length < 120) {
        college = lines[j].trim();
        break;
      }
    }
    // Fallback: next non-year, non-degree line
    if (!college && lines[i + 1]) {
      const next = lines[i + 1].trim();
      if (next && !/^\d{4}/.test(next) && !hasDegree(next) && next.length < 100) {
        college = next;
      }
    }
    results.push({ degree: lines[i].trim(), college, year });
  }
  return results;
}

// ── Work Experience ──────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function toMonthInput(raw: string): string {
  if (!raw) return '';
  const m = raw.match(/([A-Za-z]+)[.\s]+(\d{4})/);
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
    return mo ? `${m[2]}-${mo}` : `${m[2]}`;
  }
  if (/^\d{4}$/.test(raw.trim())) return raw.trim();
  return '';
}

// Full date-range pattern: "Jan 2019 – Mar 2022" or "2019 – 2022" or "Jan 2019 – Present"
const DATE_RANGE_RE = /([A-Za-z]+ \d{4}|\d{4})\s*[-–to]+\s*([A-Za-z]+ \d{4}|\d{4}|present|current|till date)/i;
const DESIGNATION_RE = /engineer|developer|analyst|manager|lead|architect|consultant|designer|officer|executive|associate|specialist|intern|trainee|scientist|programmer|administrator|director/i;
const COMPANY_RE     = /ltd|limited|inc|pvt|technologies|solutions|software|systems|services|consulting|group|corp|llp|llc/i;

function extractExperience(lines: string[]): ExpEntry[] {
  // Group blocks by blank lines
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (cur.length) { blocks.push(cur); cur = []; }
    } else {
      cur.push(line.trim());
    }
  }
  if (cur.length) blocks.push(cur);

  const results: ExpEntry[] = [];

  for (const block of blocks) {
    if (block.length < 1) continue;

    let from = '', to = '', dateLine = -1;
    for (let i = 0; i < block.length; i++) {
      const dm = block[i].match(DATE_RANGE_RE);
      if (dm) {
        from = toMonthInput(dm[1]);
        to = /present|current|till/i.test(dm[2]) ? '' : toMonthInput(dm[2]);
        dateLine = i;
        break;
      }
    }

    // Company: prefer line with company keywords, else first line
    let company = '';
    for (let i = 0; i < block.length; i++) {
      if (i === dateLine) continue;
      if (COMPANY_RE.test(block[i])) { company = block[i]; break; }
    }
    if (!company) company = block[0];

    // Designation: prefer line with job title keywords, else second line
    let designation = '';
    for (let i = 0; i < block.length; i++) {
      if (i === dateLine || block[i] === company) continue;
      if (DESIGNATION_RE.test(block[i])) { designation = block[i]; break; }
    }
    if (!designation && block.length > 1 && block[1] !== company) designation = block[1];

    if (company || designation) {
      results.push({ company, designation, from, to, project: '' });
    }
  }

  return results;
}

// ── Main export ──────────────────────────────────────────────────────────────

export function parseResumeText(rawText: string): ParsedResume {
  // Normalise lines: collapse multiple spaces, keep blanks as section separators
  const lines = rawText
    .split('\n')
    .map(l => l.replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ').trimEnd());

  const nonEmpty = lines.filter(Boolean);

  const eduLines = extractSection(lines, EDU_STARTS, EDU_ENDS);
  const expLines = extractSection(lines, EXP_STARTS, EXP_ENDS);

  return {
    name: extractName(nonEmpty),
    mobile: extractMobile(rawText),
    education:       extractEducation(eduLines.length ? eduLines : nonEmpty),
    work_experience: extractExperience(expLines),
  };
}
