import { supabase } from './supabase';

export const UPLOAD_COOLDOWN_MS = 3 * 60 * 1000;

const lastUploadKey = (userId: string) => `startorigin_last_upload_at_${userId}`;
const rulesAcceptedKey = (userId: string) => `startorigin_rules_accepted_${userId}`;

export function getLastUploadTimestamp(userId: string): number {
  if (typeof window === 'undefined' || !userId) return 0;
  try {
    const raw = window.localStorage.getItem(lastUploadKey(userId));
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function recordPhotoUploadTimestamp(userId: string, timestampMs = Date.now()): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(lastUploadKey(userId), String(timestampMs));
  } catch {
    // Ignore storage quota errors
  }
}

export function getUploadCooldownRemainingMs(userId: string): number {
  const lastAt = getLastUploadTimestamp(userId);
  if (!lastAt) return 0;
  const elapsed = Date.now() - lastAt;
  return Math.max(0, UPLOAD_COOLDOWN_MS - elapsed);
}

export async function syncUploadCooldownFromServer(userId: string): Promise<number> {
  if (!userId) return 0;
  const localRemaining = getUploadCooldownRemainingMs(userId);

  try {
    const { data } = await supabase
      .from('photos')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.created_at) {
      const serverTs = new Date(data.created_at).getTime();
      if (Number.isFinite(serverTs)) {
        const localTs = getLastUploadTimestamp(userId);
        if (serverTs > localTs) {
          recordPhotoUploadTimestamp(userId, serverTs);
        }
        return getUploadCooldownRemainingMs(userId);
      }
    }
  } catch {
    // Fall back to local timestamp
  }

  return localRemaining;
}

export function formatCooldownDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function hasAcceptedUploadRules(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    return window.localStorage.getItem(rulesAcceptedKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function acceptUploadRules(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(rulesAcceptedKey(userId), '1');
  } catch {
    // Ignore storage quota errors
  }
}
