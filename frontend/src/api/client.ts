export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'message' in body ? (body as { message: string }).message : `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 45_000; // 45 seconds

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isGet = !options.method || options.method === 'GET';

  // Any mutation busts the entire cache so re-fetches after creates/edits/deletes
  // always see fresh data.
  if (!isGet) _cache.clear();

  if (isGet) {
    const hit = _cache.get(path);
    if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T;
  }

  const token = localStorage.getItem('hrms_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = { message: res.statusText };
    }
    throw new ApiError(res.status, body);
  }

  const data: T = res.status === 204 ? undefined as T : await res.json();
  if (isGet) _cache.set(path, { data, ts: Date.now() });
  return data;
}
