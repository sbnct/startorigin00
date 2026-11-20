import {
  ApiRequestLike,
  ApiResponseLike,
  parseJsonBody,
  safePasswordMatch,
  signAdminToken,
} from '../_admin.js';

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    res.status(500).json({
      error: 'ADMIN_PASSWORD is not configured in environment variables.',
    });
    return;
  }

  const body = parseJsonBody(req);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || !safePasswordMatch(password, expectedPassword)) {
    res.status(401).json({ error: 'Invalid admin password.' });
    return;
  }

  const token = signAdminToken();
  res.status(200).json({ token });
}
