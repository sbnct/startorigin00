import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Check,
  Folder,
  Link2,
  LogOut,
  Pencil,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  ActivityLog,
  CinemaPhoto,
  Collection,
  Photo,
  Profile,
  SavedPhotoItem,
} from '../types';
import {
  copyTextToClipboard,
  formatDate,
  formatRelativeTime,
  getCollectionShareUrl,
  getInitials,
  sanitizeFilename,
} from '../lib/utils';
import { AuthView } from './AuthView';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';
import { PWAInstallButton } from './PWAInstallButton';
import { LikeButton } from './LikeButton';
import { fetchPhotoLikesMap, togglePhotoLike } from '../lib/likes';
import {
  AchievementStatus,
  evaluateAchievements,
  fetchUserAchievementMetrics,
  syncAndNotifyAchievements,
} from '../lib/achievements';
import {
  AchievementBadgeIcon,
  AchievementDetailModal,
} from './AchievementBadge';

interface ProfileViewProps {
  targetUserId: string | null;
  currentUserId: string | null;
  showBackButton?: boolean;
  onBack?: () => void;
  onAuthSuccess: () => void;
  onOpenCinema: (photo: CinemaPhoto, collectionItems?: CinemaPhoto[]) => void;
  onOpenPost: (photoId: string) => void;
  onOpenCollection: (collectionId: string) => void;
  onProfileUpdated: () => void;
  onRequireAuth: () => void;
  onSignOut?: () => void;
  onShowToast?: (msg: string) => void;
  refreshKey: number;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  targetUserId,
  currentUserId,
  showBackButton = false,
  onBack,
  onAuthSuccess,
  onOpenCinema,
  onOpenPost,
  onOpenCollection,
  onProfileUpdated,
  onRequireAuth,
  onSignOut,
  onShowToast,
  refreshKey,
}) => {
  const effectiveUserId = targetUserId || currentUserId;
  const isOwnProfile = Boolean(
    currentUserId && effectiveUserId && currentUserId === effectiveUserId
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const [publicPhotos, setPublicPhotos] = useState<Photo[]>([]);
  const [publicCollections, setPublicCollections] = useState<Collection[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhotoItem[]>([]);
  const [copiedColId, setCopiedColId] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<AchievementStatus | null>(null);
  const [activeTab, setActiveTab] = useState<
    'photos' | 'collections' | 'achievements' | 'saved' | 'activity'
  >('photos');
  const [loading, setLoading] = useState(true);
  const [subBusy, setSubBusy] = useState(false);

  // Edit profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const [
        { data: profData },
        { data: photosData },
        { data: collectionsData },
        { count: subCount },
        { data: actData },
        { data: savedData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', effectiveUserId).maybeSingle(),
        supabase
          .from('photos')
          .select('*')
          .eq('user_id', effectiveUserId)
          .eq('privacy', 'public')
          .order('created_at', { ascending: false }),
        supabase
          .from('collections')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('target_user_id', effectiveUserId),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('saved_photos')
          .select(
            `
            *,
            photos:photo_id (
              *,
              profiles:user_id (id, name, username, avatar_url)
            )
          `
          )
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false }),
      ]);

      setProfile((profData as Profile) || null);
      setPublicPhotos((photosData as Photo[]) || []);
      setPublicCollections(
        ((collectionsData as Collection[]) || []).filter(
          (c) => (c.privacy || 'public') === 'public'
        )
      );
      setSubscribersCount(subCount || 0);
      setActivities((actData as ActivityLog[]) || []);

      const rawSaved = (savedData as SavedPhotoItem[]) || [];
      setSavedPhotos(
        rawSaved.filter(
          (item) =>
            item.photos &&
            (item.photos.privacy === 'public' || item.photos.user_id === currentUserId)
        )
      );

      if (currentUserId && currentUserId !== effectiveUserId) {
        const { data: mySub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('subscriber_id', currentUserId)
          .eq('target_user_id', effectiveUserId)
          .maybeSingle();
        setIsSubscribed(Boolean(mySub));
      } else {
        setIsSubscribed(false);
      }

      const typedProfile = (profData as Profile) || null;
      if (currentUserId && currentUserId === effectiveUserId) {
        const { statuses, newlyLogged } = await syncAndNotifyAchievements(
          effectiveUserId,
          typedProfile,
          onShowToast
        );
        setAchievements(statuses);
        if (newlyLogged.length > 0) {
          const { data: refreshedActs } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('user_id', effectiveUserId)
            .order('created_at', { ascending: false })
            .limit(30);
          setActivities((refreshedActs as ActivityLog[]) || []);
        }
      } else {
        const metrics = await fetchUserAchievementMetrics(
          effectiveUserId,
          typedProfile
        );
        setAchievements(evaluateAchievements(metrics));
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, currentUserId, onShowToast]);

  useEffect(() => {
    setActiveTab('photos');
  }, [effectiveUserId]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData, refreshKey]);

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const showCollectionsTab = isOwnProfile || publicCollections.length > 0;
  const showAchievementsTab = isOwnProfile || unlockedAchievements.length > 0;
  const showSavedTab = isOwnProfile || savedPhotos.length > 0;

  useEffect(() => {
    if (loading) return;
    if (activeTab === 'collections' && !showCollectionsTab) setActiveTab('photos');
    if (activeTab === 'achievements' && !showAchievementsTab) setActiveTab('photos');
    if (activeTab === 'saved' && !showSavedTab) setActiveTab('photos');
  }, [loading, activeTab, showCollectionsTab, showAchievementsTab, showSavedTab]);

  useEffect(() => {
    let active = true;
    const ids = Array.from(
      new Set([
        ...publicPhotos.map((p) => p.id),
        ...savedPhotos.map((s) => s.photos?.id).filter((id): id is string => Boolean(id)),
      ])
    );
    if (ids.length === 0) {
      setLikeCounts({});
      setLikedIds(new Set());
      return;
    }
    fetchPhotoLikesMap(ids, currentUserId).then((res) => {
      if (!active) return;
      setLikeCounts(res.counts);
      setLikedIds(res.likedIds);
    });
    return () => {
      active = false;
    };
  }, [publicPhotos, savedPhotos, currentUserId]);

  const handleToggleLike = async (photo: { id: string; title: string }) => {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }
    if (likeBusyIds.has(photo.id)) return;

    const currentlyLiked = likedIds.has(photo.id);
    setLikeBusyIds((prev) => new Set(prev).add(photo.id));
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [photo.id]: Math.max(0, (prev[photo.id] || 0) + (currentlyLiked ? -1 : 1)),
    }));

    try {
      const ok = await togglePhotoLike(
        photo.id,
        photo.title,
        currentUserId,
        currentlyLiked
      );
      if (!ok) {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (currentlyLiked) next.add(photo.id);
          else next.delete(photo.id);
          return next;
        });
        setLikeCounts((prev) => ({
          ...prev,
          [photo.id]: Math.max(0, (prev[photo.id] || 0) + (currentlyLiked ? 1 : -1)),
        }));
      }
    } finally {
      setLikeBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
    }
  };

  if (!effectiveUserId) {
    return (
      <AuthView
        embedded
        onSuccess={onAuthSuccess}
        subtitle="Sign in to view and manage your StartOrigin profile."
      />
    );
  }

  const handleToggleSubscribe = async () => {
    if (!currentUserId || !profile || isOwnProfile || subBusy) return;
    setSubBusy(true);
    try {
      if (isSubscribed) {
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('subscriber_id', currentUserId)
          .eq('target_user_id', profile.id);
        if (!error) {
          setIsSubscribed(false);
          setSubscribersCount((c) => Math.max(0, c - 1));
        }
      } else {
        const { error } = await supabase.from('subscriptions').insert({
          subscriber_id: currentUserId,
          target_user_id: profile.id,
        });
        if (!error) {
          setIsSubscribed(true);
          setSubscribersCount((c) => c + 1);
          await supabase.from('activity_logs').insert({
            user_id: currentUserId,
            actor_id: currentUserId,
            action_type: 'subscribe',
            target_id: profile.id,
            description: `Subscribed to @${profile.username}`,
            is_public: true,
          });
          syncAndNotifyAchievements(currentUserId, undefined, onShowToast);
        }
      }
    } finally {
      setSubBusy(false);
    }
  };

  const openEditModal = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditUsername(profile.username);
    setEditBio(profile.bio || '');
    setEditAvatarPreview(profile.avatar_url || '');
    setEditAvatarFile(null);
    setEditError(null);
    setEditOpen(true);
  };

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !currentUserId) return;
    setEditError(null);

    const nextName = editName.trim();
    const nextUsername = editUsername.trim();
    const nextBio = editBio.trim();

    if (!nextName || !nextUsername) {
      setEditError('Name and username are required.');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(nextUsername)) {
      setEditError('Username must be 3–24 characters (letters, numbers, _, ., -).');
      return;
    }

    setEditSaving(true);
    try {
      // Check case-insensitive username availability if username changed
      if (nextUsername.toLowerCase() !== profile.username.toLowerCase()) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', nextUsername)
          .neq('id', currentUserId)
          .maybeSingle();

        if (existing) {
          setEditError('That username is already taken.');
          setEditSaving(false);
          return;
        }
      }

      let nextAvatarUrl = profile.avatar_url;
      if (editAvatarFile) {
        const safeName = sanitizeFilename(editAvatarFile.name || 'avatar.jpg');
        const path = `${currentUserId}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, editAvatarFile, { upsert: true });

        if (uploadErr) {
          setEditError(`Avatar upload failed: ${uploadErr.message}`);
          setEditSaving(false);
          return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        nextAvatarUrl = urlData.publicUrl;
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          name: nextName,
          username: nextUsername,
          bio: nextBio,
          avatar_url: nextAvatarUrl,
        })
        .eq('id', currentUserId);

      if (updateErr) {
        setEditError(updateErr.message);
        return;
      }

      setEditOpen(false);
      await loadProfileData();
      onProfileUpdated();
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-pulse space-y-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-[#F5F5F7]" />
          <div className="space-y-2.5">
            <div className="h-5 w-44 rounded bg-[#F5F5F7]" />
            <div className="h-3 w-28 rounded bg-[#F5F5F7]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-[#F5F5F7]" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F5F7] text-xs font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        )}
        <p className="text-sm text-[#737373]">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {showBackButton && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 mb-6 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Go Back</span>
        </button>
      )}

      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-8 border-b border-black/[0.08]">
        <div className="flex items-start gap-5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border border-black/[0.08] shrink-0"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#0A0A0A] text-white text-xl font-semibold flex items-center justify-center shrink-0">
              {getInitials(profile.name)}
            </div>
          )}

          <div className="space-y-2 min-w-0">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                  {profile.name}
                </h1>
                <VerifiedBadge
                  username={profile.username}
                  isVerified={profile.is_verified}
                  size="md"
                />
              </div>
              <p className="text-xs text-[#737373]">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="text-xs sm:text-sm text-[#404040] leading-relaxed max-w-lg">
                {profile.bio}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-[#525252] pt-1 tabular-nums">
              <span>
                <strong className="font-semibold text-[#0A0A0A]">
                  {publicPhotos.length}
                </strong>{' '}
                {publicPhotos.length === 1 ? 'photo' : 'photos'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="font-semibold text-[#0A0A0A]">
                  {subscribersCount}
                </strong>{' '}
                {subscribersCount === 1 ? 'subscriber' : 'subscribers'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isOwnProfile ? (
            <>
              <PWAInstallButton compact />
              <button
                type="button"
                onClick={openEditModal}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Edit Profile</span>
              </button>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="md:hidden min-h-[44px] px-3.5 py-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#525252] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Sign Out</span>
                </button>
              )}
            </>
          ) : currentUserId ? (
            <button
              type="button"
              onClick={handleToggleSubscribe}
              disabled={subBusy}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                isSubscribed
                  ? 'bg-[#F5F5F7] text-[#0A0A0A] border border-black/[0.1]'
                  : 'bg-[#0A0A0A] text-white hover:bg-black/85'
              }`}
            >
              {isSubscribed ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Subscribed</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Subscribe</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-xl my-6 w-full sm:w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'photos'
              ? 'bg-white text-[#0A0A0A] shadow-xs'
              : 'text-[#737373] hover:text-[#0A0A0A]'
          }`}
        >
          Photos
        </button>
        {showCollectionsTab && (
          <button
            type="button"
            onClick={() => setActiveTab('collections')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'collections'
                ? 'bg-white text-[#0A0A0A] shadow-xs'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Collections
          </button>
        )}
        {showAchievementsTab && (
          <button
            type="button"
            onClick={() => setActiveTab('achievements')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'achievements'
                ? 'bg-white text-[#0A0A0A] shadow-xs'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Achievements
          </button>
        )}
        {showSavedTab && (
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === 'saved'
                ? 'bg-white text-[#0A0A0A] shadow-xs'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Saved Photos
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-white text-[#0A0A0A] shadow-xs'
              : 'text-[#737373] hover:text-[#0A0A0A]'
          }`}
        >
          Recent Activity
        </button>
      </div>

      {/* Tab 1: Public Photos Grid (Photo -> Cinema, Name -> Post Page) */}
      {activeTab === 'photos' && (
        <div>
          {publicPhotos.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
              <Camera className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#737373]">No public photos published yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {(() => {
                const cinemaList: CinemaPhoto[] = publicPhotos.map((p) => ({
                  id: p.id,
                  title: p.title,
                  image_url: p.image_url,
                  subtitle: `${profile.name} · @${profile.username}`,
                }));
                return publicPhotos.map((photo, idx) => (
                  <div key={photo.id} className="group flex flex-col">
                    <button
                      type="button"
                      onClick={() => onOpenCinema(cinemaList[idx], cinemaList)}
                      className="block w-full text-left focus-visible:outline-2 focus-visible:outline-black rounded-2xl"
                    >
                    <ResilientImage
                      src={photo.image_url}
                      alt={photo.title}
                      containerClassName="aspect-square rounded-2xl border border-black/[0.06]"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </button>
                  <div className="flex items-start justify-between gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => onOpenPost(photo.id)}
                      className="text-left min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-black rounded-lg"
                    >
                      <p className="text-xs font-medium text-[#0A0A0A] truncate hover:underline">
                        {photo.title}
                      </p>
                      <p className="text-[11px] text-[#737373] tabular-nums">
                        {formatDate(photo.photo_date || photo.created_at)}
                      </p>
                    </button>
                    <LikeButton
                      compact
                      liked={likedIds.has(photo.id)}
                      count={likeCounts[photo.id] || 0}
                      busy={likeBusyIds.has(photo.id)}
                      onToggle={() => handleToggleLike(photo)}
                    />
                  </div>
                </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Public Collections Grid */}
      {activeTab === 'collections' && (
        <div>
          {publicCollections.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
              <Folder className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#737373]">No public collections yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicCollections.map((col) => {
                const colPhotos = publicPhotos.filter((p) => p.collection_id === col.id);
                const previews = colPhotos.slice(0, 4);
                const isCopied = copiedColId === col.id;
                return (
                  <div
                    key={col.id}
                    className="group p-3.5 rounded-3xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] transition-colors flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCollection(col.id)}
                      className="block w-full text-left focus-visible:outline-2 focus-visible:outline-black rounded-2xl"
                    >
                      <div className="grid grid-cols-2 gap-1.5 aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F5F7] mb-3">
                        {previews.length === 0 ? (
                          <div className="col-span-2 flex flex-col items-center justify-center text-[#737373]">
                            <Folder className="w-6 h-6 opacity-40" strokeWidth={1.5} />
                          </div>
                        ) : (
                          previews.map((p) => (
                            <ResilientImage
                              key={p.id}
                              src={p.image_url}
                              alt={p.title}
                              containerClassName="w-full h-full"
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                            />
                          ))
                        )}
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => onOpenCollection(col.id)}
                        className="text-left min-w-0 flex-1"
                      >
                        <h3 className="text-sm font-semibold text-[#0A0A0A] truncate">
                          {col.name}
                        </h3>
                        <p className="text-xs text-[#737373] tabular-nums">
                          {colPhotos.length} {colPhotos.length === 1 ? 'photo' : 'photos'}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await copyTextToClipboard(
                            getCollectionShareUrl(col.id)
                          );
                          if (ok) {
                            setCopiedColId(col.id);
                            onShowToast?.('Collection link copied');
                            setTimeout(() => {
                              setCopiedColId((prev) => (prev === col.id ? null : prev));
                            }, 2000);
                          }
                        }}
                        aria-label={`Copy link to ${col.name}`}
                        className="min-h-[36px] min-w-[36px] px-2.5 rounded-xl border border-black/[0.08] bg-white hover:bg-black/[0.05] text-[#0A0A0A] inline-flex items-center justify-center gap-1 text-xs font-medium shrink-0 transition-colors"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Achievements */}
      {activeTab === 'achievements' && showAchievementsTab && (
        <div className="space-y-6">
          {(() => {
            const unlockedCount = unlockedAchievements.length;
            const totalCount = achievements.length || 10;
            const overallPct = Math.round((unlockedCount / totalCount) * 100);
            const visibleAchievements = isOwnProfile
              ? achievements
              : unlockedAchievements;
            return (
              <>
                <div className="p-5 rounded-3xl border border-black/[0.08] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#0A0A0A]">
                      Achievements
                    </h2>
                    <p className="text-xs text-[#737373] mt-0.5 tabular-nums">
                      {unlockedCount} of {totalCount} unlocked · Click any achievement to see how to unlock it
                    </p>
                  </div>
                  <div className="w-full sm:w-48 space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0A0A0A] transition-all duration-300"
                        style={{ width: `${overallPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#737373] sm:text-right tabular-nums">
                      {overallPct}% complete
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {visibleAchievements.map((status) => {
                    const { definition, unlocked, progressPct, progressText } = status;
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        onClick={() => setSelectedBadge(status)}
                        className={`p-4 rounded-3xl border text-left transition-all flex items-start gap-3.5 group ${
                          unlocked
                            ? 'border-black/[0.1] bg-white hover:bg-[#F5F5F7]'
                            : 'border-black/[0.06] bg-[#FAFAFA] hover:bg-white'
                        }`}
                      >
                        <AchievementBadgeIcon status={status} size="md" />

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-[#0A0A0A] truncate group-hover:underline">
                                {definition.name}
                              </h3>
                              <p className="text-[11px] text-[#737373]">
                                {definition.category} · {definition.tier}
                              </p>
                            </div>
                            {unlocked && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669] shrink-0">
                                <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                                <span>Unlocked</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[#525252] line-clamp-2">
                            {definition.howToGet}
                          </p>

                          <div className="space-y-1 pt-0.5">
                            <div className="h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${progressPct}%`,
                                  backgroundColor: unlocked
                                    ? definition.accentHex
                                    : '#0A0A0A',
                                }}
                              />
                            </div>
                            <p className="text-[11px] text-[#737373] tabular-nums">
                              {progressText}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Tab 4: Saved Photos */}
      {activeTab === 'saved' && (
        <div>
          {savedPhotos.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
              <Bookmark className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#737373]">
                No saved photos yet. Save a photo from any post page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {(() => {
                const validSaved = savedPhotos.filter((it) => Boolean(it.photos));
                const savedCinemaList: CinemaPhoto[] = validSaved.map((it) => {
                  const p = it.photos!;
                  return {
                    id: p.id,
                    title: p.title,
                    image_url: p.image_url,
                    subtitle: p.profiles
                      ? `${p.profiles.name} · @${p.profiles.username}`
                      : undefined,
                  };
                });
                return validSaved.map((item, idx) => {
                  const photo = item.photos!;
                  return (
                    <div key={item.id} className="group flex flex-col">
                      <button
                        type="button"
                        onClick={() => onOpenCinema(savedCinemaList[idx], savedCinemaList)}
                        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-black rounded-2xl"
                      >
                      <ResilientImage
                        src={photo.image_url}
                        alt={photo.title}
                        containerClassName="aspect-square rounded-2xl border border-black/[0.06]"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </button>
                    <div className="flex items-start justify-between gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => onOpenPost(photo.id)}
                        className="text-left min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-black rounded-lg"
                      >
                        <p className="text-xs font-medium text-[#0A0A0A] truncate hover:underline">
                          {photo.title}
                        </p>
                        <p className="text-[11px] text-[#737373] truncate tabular-nums">
                          {photo.profiles ? `@${photo.profiles.username} · ` : ''}
                          {formatDate(photo.photo_date || photo.created_at)}
                        </p>
                      </button>
                      <LikeButton
                        compact
                        liked={likedIds.has(photo.id)}
                        count={likeCounts[photo.id] || 0}
                        busy={likeBusyIds.has(photo.id)}
                        onToggle={() => handleToggleLike(photo)}
                      />
                    </div>
                  </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Recent Activity */}
      {activeTab === 'activity' && (
        <div>
          {activities.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
              <p className="text-xs text-[#737373]">No recent activity recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.06] border border-black/[0.08] rounded-3xl bg-white overflow-hidden">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="px-5 py-4 flex items-center justify-between gap-4"
                >
                  <p className="text-xs sm:text-sm text-[#0A0A0A]">{act.description}</p>
                  <span className="text-[11px] text-[#737373] tabular-nums shrink-0">
                    {formatRelativeTime(act.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-md bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0A0A0A]">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close edit profile"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-[#F5F5F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {editError}
              </div>
            )}

            <div className="flex items-center gap-4">
              {editAvatarPreview ? (
                <img
                  src={editAvatarPreview}
                  alt={editName}
                  className="w-16 h-16 rounded-full object-cover border border-black/[0.08]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#0A0A0A] text-white text-base font-medium flex items-center justify-center">
                  {getInitials(editName)}
                </div>
              )}

              <label className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] cursor-pointer inline-flex items-center">
                <span>Change Avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelected}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                Bio
              </label>
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell others about your photography..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Badge Detail Modal */}
      <AchievementDetailModal
        status={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </div>
  );
};
