import {
  ApiRequestLike,
  ApiResponseLike,
  extractToken,
  verifyAdminToken,
} from '../_admin.js';

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const valid = verifyAdminToken(extractToken(req));
  res.status(200).json({ authenticated: valid });
}
