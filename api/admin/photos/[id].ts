import {
  ApiRequestLike,
  ApiResponseLike,
  extractToken,
  getSupabaseAdmin,
  verifyAdminToken,
} from '../../_admin.js';

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const token = extractToken(req);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawId = req.query?.id;
  let photoId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!photoId && req.url) {
    const parts = req.url.split('?')[0].split('/').filter(Boolean);
    photoId = parts[parts.length - 1];
  }

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

    res.status(200).json({ deleted: true, id: photoId });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to delete photo.',
    });
  }
}
