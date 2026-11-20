import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
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

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://axjxtwdmngewjksgfbtj.supabase.co';
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment Secrets.'
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function signAdminToken(): string {
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

function verifyAdminToken(token: string | undefined | null): boolean {
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
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function safePasswordMatch(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword) {
      res.status(500).json({
        error: 'ADMIN_PASSWORD is not configured in environment Secrets.',
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || !safePasswordMatch(password, expectedPassword)) {
      res.status(401).json({ error: 'Invalid admin password.' });
      return;
    }

    const token = signAdminToken();
    res.json({ token });
  });

  app.get('/api/admin/session', (req: Request, res: Response) => {
    const valid = verifyAdminToken(extractToken(req));
    res.json({ authenticated: valid });
  });

  app.get('/api/admin/photos', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: photos, error } = await supabaseAdmin
        .from('photos')
        .select(
          `
          *,
          profiles:user_id (id, name, username, avatar_url)
        `
        )
        .order('created_at', { ascending: false })
        .limit(250);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ photos: photos || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load photos.',
      });
    }
  });

  app.delete('/api/admin/photos/:id', requireAdmin, async (req: Request, res: Response) => {
    const photoId = req.params.id;
    if (!photoId) {
      res.status(400).json({ error: 'Photo ID is required.' });
      return;
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: photoRow, error: fetchErr } = await supabaseAdmin
        .from('photos')
        .select('id, storage_path')
        .eq('id', photoId)
        .maybeSingle();

      if (fetchErr) {
        res.status(500).json({ error: fetchErr.message });
        return;
      }

      if (!photoRow) {
        res.status(404).json({ error: 'Photo not found.' });
        return;
      }

      if (photoRow.storage_path) {
        await supabaseAdmin.storage.from('photos').remove([photoRow.storage_path]);
      }

      const { error: deleteErr } = await supabaseAdmin
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (deleteErr) {
        res.status(500).json({ error: deleteErr.message });
        return;
      }

      res.json({ deleted: true, id: photoId });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete photo.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StartOrigin server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
