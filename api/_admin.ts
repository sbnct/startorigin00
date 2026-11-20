import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface ApiRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}

export interface ApiResponseLike {
  status: (code: number) => ApiResponseLike;
  json: (data: unknown) => void;
}

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32).toString('hex');

function getTokenSecret(): Buffer {
  const seed =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.ADMIN_PASSWORD ||
    EPHEMERAL_FALLBACK_KEY;
  return crypto
    .createHash('sha256')
    .update(`startorigin-admin:${seed}`)
    .digest();
}

export function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://axjxtwdmngewjksgfbtj.supabase.co';
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment variables.'
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function signAdminToken(): string {
  const payload = JSON.stringify({
    role: 'admin',
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token || !token.includes('.')) return false;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return (
      parsed.role === 'admin' &&
      typeof parsed.exp === 'number' &&
      parsed.exp > Date.now()
    );
  } catch {
    return false;
  }
}

export function safePasswordMatch(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractToken(req: ApiRequestLike): string | null {
  const rawHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function parseJsonBody(req: ApiRequestLike): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  return {};
}
