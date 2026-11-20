import {
  ApiRequestLike,
  ApiResponseLike,
  extractToken,
  getSupabaseAdmin,
  verifyAdminToken,
} from '../_admin.js';

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const token = extractToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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

    res.status(200).json({ photos: photos || [] });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load photos.',
    });
  }
}
