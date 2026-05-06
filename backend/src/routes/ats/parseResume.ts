import { Router, Response } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { parseResumeText } from '../../utils/resumeParser';

const tmpDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'hrms-uploads')
  : path.join(__dirname, '../../../uploads/tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({ dest: tmpDir, limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

const GEMINI_PROMPT = `You are a resume parser. Extract information from the resume text below and return ONLY valid JSON — no markdown, no explanation, no code fences.

Return this exact structure:
{
  "name": "full name of the candidate",
  "mobile": "10-digit mobile number, digits only, empty string if not found",
  "education": [
    {
      "degree": "degree name e.g. B.Tech Computer Science",
      "college": "institution name",
      "year": "graduation year as 4-digit string, empty if unknown"
    }
  ],
  "work_experience": [
    {
      "company": "company name",
      "designation": "job title",
      "from": "YYYY-MM format, empty if unknown",
      "to": "YYYY-MM format, empty string if current/present",
      "project": "project name if explicitly mentioned, else empty string"
    }
  ]
}

Resume text:
`;

async function parseWithGemini(text: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: GEMINI_PROMPT + text,
  });

  const raw = (response.text ?? '').trim();
  // Strip markdown code fences if Gemini wraps the response
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(jsonStr);
}

async function extractText(filePath: string, ext: string): Promise<string> {
  if (ext === '.pdf') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse') as {
      PDFParse: new (opts: { data: Buffer }) => { getText: (p?: object) => Promise<{ text: string }> };
    };
    const buf = fs.readFileSync(filePath);
    const result = await new PDFParse({ data: buf }).getText({ pageJoiner: '\n\n' });
    return result.text;
  }

  if (ext === '.docx' || ext === '.doc') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { path: string }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error('Unsupported file type. Use PDF, DOC, or DOCX.');
}

router.post('/', authenticateToken, upload.single('resume'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    const text = await extractText(filePath, ext);

    console.log('[parse-resume] GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);

    // Try Gemini first; fall back to regex parser if key is absent or call fails
    try {
      const geminiResult = await parseWithGemini(text);
      if (geminiResult) {
        console.log('[parse-resume] Gemini succeeded');
        return res.json(geminiResult);
      }
    } catch (geminiErr) {
      console.error('[parse-resume] Gemini failed:', (geminiErr as Error).message);
    }

    console.log('[parse-resume] Using regex fallback');
    res.json(parseResumeText(text));
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to parse resume' });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;
