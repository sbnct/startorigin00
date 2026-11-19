import { supabase } from './supabase';

export interface PhotoLikesState {
  counts: Record<string, number>;
  likedIds: Set<string>;
}

export async function fetchPhotoLikesMap(
  photoIds: string[],
  currentUserId: string | null
): Promise<PhotoLikesState> {
  if (photoIds.length === 0) {
    return { counts: {}, likedIds: new Set<string>() };
  }

  const { data, error } = await supabase
    .from('photo_likes')
    .select('photo_id, user_id')
    .in('photo_id', photoIds);

  if (error || !data) {
    return { counts: {}, likedIds: new Set<string>() };
  }

  const counts: Record<string, number> = {};
  const likedIds = new Set<string>();

  for (const row of data) {
    const pid = row.photo_id as string;
    counts[pid] = (counts[pid] || 0) + 1;
    if (currentUserId && row.user_id === currentUserId) {
      likedIds.add(pid);
    }
  }

  return { counts, likedIds };
}

export async function togglePhotoLike(
  photoId: string,
  title: string,
  userId: string,
  currentlyLiked: boolean
): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('photo_likes')
      .delete()
      .eq('photo_id', photoId)
      .eq('user_id', userId);
    return !error;
  }

  const { error } = await supabase.from('photo_likes').insert({
    photo_id: photoId,
    user_id: userId,
  });

  if (error) {
    return false;
  }

  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      actor_id: userId,
      action_type: 'like',
      target_id: photoId,
      description: `Liked "${title}"`,
      is_public: true,
    });
  } catch {
    // Non-fatal if activity log insert fails
  }

  return true;
}
