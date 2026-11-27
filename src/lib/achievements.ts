import { supabase } from './supabase';
import { Profile } from '../types';
import { isUserVerified } from '../components/VerifiedBadge';

export type AchievementIconKey =
  | 'camera'
  | 'aperture'
  | 'crown'
  | 'folder'
  | 'layers'
  | 'users'
  | 'star'
  | 'heart'
  | 'bookmark'
  | 'shield';

export interface AchievementDefinition {
  id: string;
  name: string;
  howToGet: string;
  flavor: string;
  icon: AchievementIconKey;
  accentHex: string;
  bgHex: string;
  target: number;
  unitLabel: string;
}

export interface AchievementMetrics {
  photosCount: number;
  collectionsCount: number;
  subscribersCount: number;
  followingCount: number;
  savedCount: number;
  likesReceivedCount: number;
  isVerified: boolean;
}

export interface AchievementStatus {
  definition: AchievementDefinition;
  unlocked: boolean;
  current: number;
  target: number;
  progressPct: number;
  progressText: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'ten_frames',
    name: 'Ten Frames',
    howToGet: 'Publish 10 photos to your gallery.',
    flavor: 'Every serious visual archive begins with ten deliberate frames.',
    icon: 'camera',
    accentHex: '#5865F2',
    bgHex: '#EEF0FF',
    target: 10,
    unitLabel: 'photos',
  },
  {
    id: 'fifty_frames',
    name: 'Darkroom Veteran',
    howToGet: 'Publish 50 photos to your gallery.',
    flavor: 'A sustained body of photographic work across seasons and light.',
    icon: 'aperture',
    accentHex: '#7C3AED',
    bgHex: '#F3EEFF',
    target: 50,
    unitLabel: 'photos',
  },
  {
    id: 'century_archive',
    name: 'Century Archive',
    howToGet: 'Publish 150 photos to build a living monograph.',
    flavor: 'Reserved for prolific photographers with an expansive visual vault.',
    icon: 'crown',
    accentHex: '#D97706',
    bgHex: '#FEF5E7',
    target: 150,
    unitLabel: 'photos',
  },
  {
    id: 'five_collections',
    name: 'Series Builder',
    howToGet: 'Create 5 collections to organize your work.',
    flavor: 'Structure transforms scattered shots into coherent visual stories.',
    icon: 'folder',
    accentHex: '#059669',
    bgHex: '#ECFDF5',
    target: 5,
    unitLabel: 'collections',
  },
  {
    id: 'fifteen_collections',
    name: 'Exhibition Director',
    howToGet: 'Create 15 collections across your gallery.',
    flavor: 'Master-level curation with dedicated chapters for every theme.',
    icon: 'layers',
    accentHex: '#0D9488',
    bgHex: '#F0FDFA',
    target: 15,
    unitLabel: 'collections',
  },
  {
    id: 'twentyfive_followers',
    name: 'Magnetic Lens',
    howToGet: 'Reach 25 followers.',
    flavor: 'Your visual perspective draws a dedicated circle of viewers.',
    icon: 'users',
    accentHex: '#0284C7',
    bgHex: '#F0F9FF',
    target: 25,
    unitLabel: 'followers',
  },
  {
    id: 'hundred_followers',
    name: 'Visual Luminary',
    howToGet: 'Reach 100 followers.',
    flavor: 'A recognized voice shaping inspiration across StartOrigin.',
    icon: 'star',
    accentHex: '#C026D3',
    bgHex: '#FDF4FF',
    target: 100,
    unitLabel: 'followers',
  },
  {
    id: 'hundred_likes',
    name: 'Acclaimed Eye',
    howToGet: 'Receive 100 total likes across all of your photos.',
    flavor: 'Resonance measured by a hundred quiet moments of appreciation.',
    icon: 'heart',
    accentHex: '#E11D48',
    bgHex: '#FFF1F2',
    target: 100,
    unitLabel: 'likes received',
  },
  {
    id: 'grand_patron',
    name: 'Grand Patron',
    howToGet: 'Save 30 photos for inspiration and follow 15 creators.',
    flavor: 'An active collector who supports and studies fellow artists.',
    icon: 'bookmark',
    accentHex: '#EA580C',
    bgHex: '#FFF7ED',
    target: 45,
    unitLabel: 'combined actions',
  },
  {
    id: 'origin_verified',
    name: 'Origin Verified',
    howToGet: 'Hold an official Verified Creator account badge on StartOrigin.',
    flavor: 'Official account badge certifying an authentic, notable creator.',
    icon: 'shield',
    accentHex: '#007AFF',
    bgHex: '#EFF6FF',
    target: 1,
    unitLabel: 'verified account',
  },
];

export async function fetchUserAchievementMetrics(
  userId: string,
  profile?: Pick<Profile, 'username' | 'is_verified'> | null
): Promise<AchievementMetrics> {
  const [
    { data: photosRows },
    { count: collectionsCount },
    { count: subscribersCount },
    { count: followingCount },
    { count: savedCount },
    profileRowRes,
  ] = await Promise.all([
    supabase.from('photos').select('id').eq('user_id', userId),
    supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('target_user_id', userId),
    supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('subscriber_id', userId),
    supabase
      .from('saved_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    profile
      ? Promise.resolve({ data: profile })
      : supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
  ]);

  const photoIds = (photosRows || []).map((r) => r.id as string);
  let likesReceivedCount = 0;

  if (photoIds.length > 0) {
    // Query in chunks of 100 to avoid long URL query strings
    for (let i = 0; i < photoIds.length; i += 100) {
      const chunk = photoIds.slice(i, i + 100);
      const { count } = await supabase
        .from('photo_likes')
        .select('*', { count: 'exact', head: true })
        .in('photo_id', chunk);
      likesReceivedCount += count || 0;
    }
  }

  const prof = profileRowRes.data as Pick<Profile, 'username' | 'is_verified'> | null;

  return {
    photosCount: photoIds.length,
    collectionsCount: collectionsCount || 0,
    subscribersCount: subscribersCount || 0,
    followingCount: followingCount || 0,
    savedCount: savedCount || 0,
    likesReceivedCount,
    isVerified: isUserVerified(prof?.username, prof?.is_verified),
  };
}

export function evaluateAchievements(
  metrics: AchievementMetrics
): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => {
    let current = 0;
    let unlocked = false;
    let progressText = '';

    switch (def.id) {
      case 'ten_frames':
      case 'fifty_frames':
      case 'century_archive':
        current = metrics.photosCount;
        unlocked = current >= def.target;
        progressText = `${Math.min(current, def.target)} / ${def.target} photos`;
        break;
      case 'five_collections':
      case 'fifteen_collections':
        current = metrics.collectionsCount;
        unlocked = current >= def.target;
        progressText = `${Math.min(current, def.target)} / ${def.target} collections`;
        break;
      case 'twentyfive_followers':
      case 'hundred_followers':
        current = metrics.subscribersCount;
        unlocked = current >= def.target;
        progressText = `${Math.min(current, def.target)} / ${def.target} followers`;
        break;
      case 'hundred_likes':
        current = metrics.likesReceivedCount;
        unlocked = current >= def.target;
        progressText = `${Math.min(current, def.target)} / ${def.target} likes`;
        break;
      case 'grand_patron': {
        const savedPart = Math.min(metrics.savedCount, 30);
        const followPart = Math.min(metrics.followingCount, 15);
        current = savedPart + followPart;
        unlocked = metrics.savedCount >= 30 && metrics.followingCount >= 15;
        progressText = `${savedPart}/30 saved · ${followPart}/15 following`;
        break;
      }
      case 'origin_verified':
        current = metrics.isVerified ? 1 : 0;
        unlocked = metrics.isVerified;
        progressText = unlocked ? 'Verified account' : 'Unverified account';
        break;
    }

    const progressPct = Math.min(
      100,
      Math.round((Math.min(current, def.target) / def.target) * 100)
    );

    return {
      definition: def,
      unlocked,
      current,
      target: def.target,
      progressPct,
      progressText,
    };
  });
}

function getLocalNotifiedSet(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`startorigin_badges_${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalNotifiedSet(userId: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `startorigin_badges_${userId}`,
      JSON.stringify(Array.from(ids))
    );
  } catch {
    // Ignore storage quota errors
  }
}

const activeSyncPromises = new Map<string, Promise<AchievementStatus[]>>();

export async function syncAndNotifyAchievements(
  userId: string,
  profile?: Pick<Profile, 'username' | 'is_verified'> | null,
  onShowToast?: (msg: string) => void
): Promise<{ statuses: AchievementStatus[]; newlyLogged: AchievementStatus[] }> {
  let pending = activeSyncPromises.get(userId);
  if (pending) {
    const statuses = await pending;
    return { statuses, newlyLogged: [] };
  }

  const newlyLogged: AchievementStatus[] = [];

  pending = (async () => {
    const metrics = await fetchUserAchievementMetrics(userId, profile);
    const statuses = evaluateAchievements(metrics);
    // Persist progress snapshot to user_achievements if the SQL table is installed
    try {
      const nowIso = new Date().toISOString();
      const upsertRows = statuses.map((s) => ({
        user_id: userId,
        achievement_id: s.definition.id,
        progress: Math.min(s.current, s.target),
        target: s.target,
        unlocked: s.unlocked,
        unlocked_at: s.unlocked ? nowIso : null,
        updated_at: nowIso,
      }));
      await supabase
        .from('user_achievements')
        .upsert(upsertRows, { onConflict: 'user_id,achievement_id' });
    } catch {
      // Optional table: app continues tracking client-side if SQL migration hasn't run yet
    }

    const unlockedList = statuses.filter((s) => s.unlocked);

    if (unlockedList.length === 0) {
      return statuses;
    }

    const { data: existingActs } = await supabase
      .from('activity_logs')
      .select('description')
      .eq('user_id', userId)
      .or('description.ilike.Unlocked achievement:%,description.ilike.Earned badge:%');

    const loggedDescriptions = new Set(
      (existingActs || []).map((a) => String(a.description || ''))
    );
    const localKnown = getLocalNotifiedSet(userId);

    for (const status of unlockedList) {
      const expectedDesc = `Unlocked achievement: ${status.definition.name}`;
      const legacyDesc = `Earned badge: ${status.definition.name}`;
      const alreadyInActivity =
        loggedDescriptions.has(expectedDesc) || loggedDescriptions.has(legacyDesc);

      if (alreadyInActivity) {
        localKnown.add(status.definition.id);
        continue;
      }

      if (!localKnown.has(status.definition.id)) {
        localKnown.add(status.definition.id);

        // Try 'achievement' first; fall back to 'collection' if CHECK constraint rejects it
        const { error: achErr } = await supabase.from('activity_logs').insert({
          user_id: userId,
          actor_id: userId,
          action_type: 'achievement',
          description: expectedDesc,
          is_public: true,
        });

        if (achErr) {
          await supabase.from('activity_logs').insert({
            user_id: userId,
            actor_id: userId,
            action_type: 'collection',
            description: expectedDesc,
            is_public: true,
          });
        }

        newlyLogged.push(status);
      }
    }

    saveLocalNotifiedSet(userId, localKnown);
    return statuses;
  })();

  activeSyncPromises.set(userId, pending);
  try {
    const statuses = await pending;
    if (newlyLogged.length > 0 && onShowToast) {
      if (newlyLogged.length === 1) {
        onShowToast(`Achievement unlocked: ${newlyLogged[0].definition.name}`);
      } else {
        onShowToast(
          `${newlyLogged.length} achievements unlocked: ${newlyLogged
            .map((s) => s.definition.name)
            .join(', ')}`
        );
      }
    }
    return { statuses, newlyLogged };
  } finally {
    activeSyncPromises.delete(userId);
  }
}
