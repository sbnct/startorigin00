import { supabase } from './supabase';
import { AppNotification } from '../types';
import { isMissingSchemaError } from './utils';

export async function fetchUnreadNotificationsCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) {
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

export async function fetchNotifications(userId: string): Promise<{
  items: AppNotification[];
  schemaMissing: boolean;
}> {
  if (!userId) return { items: [], schemaMissing: false };
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(
        `
        *,
        actor:actor_id (id, name, username, avatar_url, is_verified),
        photo:photo_id (id, title, image_url)
      `
      )
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      if (isMissingSchemaError(error)) {
        return { items: [], schemaMissing: true };
      }
      return { items: [], schemaMissing: false };
    }

    return {
      items: (data as AppNotification[]) || [],
      schemaMissing: false,
    };
  } catch {
    return { items: [], schemaMissing: false };
  }
}

export async function markNotificationsAsRead(
  userId: string,
  ids?: string[]
): Promise<void> {
  if (!userId) return;
  try {
    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    await query;
  } catch {
    // Non-fatal
  }
}
