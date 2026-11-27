import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Bookmark,
  Camera,
  Check,
  Flag,
  Folder,
  Link2,
  LogOut,
  Pencil,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Users,
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
  canAccessLimited,
  copyTextToClipboard,
  formatDate,
  formatRelativeTime,
  getCollectionShareUrl,
  getInitials,
  getProfileShareUrl,
  sanitizeFilename,
} from '../lib/utils';
import { AuthView } from './AuthView';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';
import { PWAInstallButton } from './PWAInstallButton';
import { LikeButton } from './LikeButton';
import { SlidingTabs } from './SlidingTabs';
import { ModalPortal } from './ModalPortal';
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
  onOpenProfile?: (userId: string) => void;
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
  onOpenProfile,
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
  const [copiedProfileLink, setCopiedProfileLink] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isRestrictedByOwner, setIsRestrictedByOwner] = useState(false);
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<AchievementStatus | null>(null);
  const [activeTab, setActiveTab] = useState<
    'photos' | 'collections' | 'achievements' | 'saved' | 'activity'
  >('photos');
  const [loading, setLoading] = useState(true);
  const [subBusy, setSubBusy] = useState(false);

  // Connections modal (Followers | Following | Restricted) on own profile
  const [subscribersModalOpen, setSubscribersModalOpen] = useState(false);
  const [subscribersModalTab, setSubscribersModalTab] = useState<
    'followers' | 'following' | 'restricted'
  >('followers');
  const [subscribersList, setSubscribersList] = useState<
    Array<{ id: string; name: string; username: string; avatar_url: string }>
  >([]);
  const [restrictedList, setRestrictedList] = useState<
    Array<{ id: string; name: string; username: string; avatar_url: string }>
  >([]);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [subscriberActionId, setSubscriberActionId] = useState<string | null>(null);
  const [subscribersError, setSubscribersError] = useState<string | null>(null);

  // Edit profile modal state (General only)
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Following list state (shown inside Connections modal)
  const [followingList, setFollowingList] = useState<
    Array<{ id: string; name: string; username: string; avatar_url: string; is_verified?: boolean }>
  >([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followingActionId, setFollowingActionId] = useState<string | null>(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [followingQuery, setFollowingQuery] = useState('');

  const loadProfileData = useCallback(async () => {
    if (!effectiveUserId) {
      setProfile(null);
      setPublicPhotos([]);
      setPublicCollections([]);
      setSavedPhotos([]);
      setActivities([]);
      setAchievements([]);
      setSubscribersCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let viewerIsSubscriber = false;
      let viewerIsRestricted = false;
      const myFollowingIds = new Set<string>();

      if (currentUserId) {
        const { data: myFollowingRows } = await supabase
          .from('subscriptions')
          .select('target_user_id')
          .eq('subscriber_id', currentUserId);
        for (const r of myFollowingRows || []) {
          myFollowingIds.add(String(r.target_user_id));
        }
        if (currentUserId !== effectiveUserId) {
          viewerIsSubscriber = myFollowingIds.has(effectiveUserId);
          try {
            const { data: restrRow } = await supabase
              .from('subscription_restrictions')
              .select('id')
              .eq('owner_id', effectiveUserId)
              .eq('restricted_user_id', currentUserId)
              .maybeSingle();
            viewerIsRestricted = Boolean(restrRow);
          } catch {
            viewerIsRestricted = false;
          }
        }
      }

      const canSeeFollowersContent =
        (Boolean(currentUserId) && currentUserId === effectiveUserId) || viewerIsSubscriber;

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
          .in('privacy', currentUserId ? ['public', 'followers', 'limited'] : ['public'])
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
      setPublicPhotos(
        ((photosData as Photo[]) || []).filter((p) => {
          if (p.privacy === 'public') return true;
          if (p.privacy === 'followers') return canSeeFollowersContent;
          if (p.privacy === 'limited') {
            return canAccessLimited(effectiveUserId, p.allowed_user_ids, currentUserId);
          }
          return false;
        })
      );
      setPublicCollections(
        ((collectionsData as Collection[]) || []).filter((c) => {
          const priv = c.privacy || 'public';
          if (priv === 'public') return true;
          if (priv === 'followers') return canSeeFollowersContent;
          if (priv === 'limited') {
            return canAccessLimited(effectiveUserId, c.allowed_user_ids, currentUserId);
          }
          return false;
        })
      );
      setSubscribersCount(subCount || 0);
      setActivities((actData as ActivityLog[]) || []);
      setIsSubscribed(viewerIsSubscriber);
      setIsRestrictedByOwner(viewerIsRestricted);

      const rawSaved = (savedData as SavedPhotoItem[]) || [];
      setSavedPhotos(
        rawSaved.filter((item) => {
          const ph = item.photos;
          if (!ph) return false;
          if (ph.privacy === 'public') return true;
          if (currentUserId && ph.user_id === currentUserId) return true;
          if (ph.privacy === 'followers' && myFollowingIds.has(ph.user_id)) return true;
          if (
            ph.privacy === 'limited' &&
            canAccessLimited(ph.user_id, ph.allowed_user_ids, currentUserId)
          ) {
            return true;
          }
          return false;
        })
      );

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

  useEffect(() => {
    if (!editOpen && !subscribersModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditOpen(false);
        setSubscribersModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editOpen, subscribersModalOpen]);

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

  const loadSubscribersModal = useCallback(async () => {
    if (!currentUserId || !isOwnProfile) return;
    setSubscribersLoading(true);
    setSubscribersError(null);
    try {
      const [{ data: subRows, error: subErr }, restrRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('subscriber_id, profiles:subscriber_id (id, name, username, avatar_url)')
          .eq('target_user_id', currentUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('subscription_restrictions')
          .select('restricted_user_id, profiles:restricted_user_id (id, name, username, avatar_url)')
          .eq('owner_id', currentUserId)
          .order('created_at', { ascending: false }),
      ]);

      if (subErr) {
        setSubscribersError(subErr.message);
      } else {
        const parsedSubs = (subRows || [])
          .map((row: any) => row.profiles)
          .filter(Boolean);
        setSubscribersList(parsedSubs);
      }

      if (!restrRes.error) {
        const parsedRestr = (restrRes.data || [])
          .map((row: any) => row.profiles)
          .filter(Boolean);
        setRestrictedList(parsedRestr);
      }
    } finally {
      setSubscribersLoading(false);
    }
  }, [currentUserId, isOwnProfile]);

  const loadFollowingModal = useCallback(async () => {
    if (!currentUserId || !isOwnProfile) return;
    setFollowingLoading(true);
    setFollowingError(null);
    try {
      const { data: followRows, error: followErr } = await supabase
        .from('subscriptions')
        .select('target_user_id, profiles:target_user_id (id, name, username, avatar_url)')
        .eq('subscriber_id', currentUserId)
        .order('created_at', { ascending: false });

      if (followErr) {
        setFollowingError(followErr.message);
      } else {
        const parsed = (followRows || [])
          .map((row: any) => row.profiles)
          .filter(Boolean);
        setFollowingList(parsed);
      }
    } finally {
      setFollowingLoading(false);
    }
  }, [currentUserId, isOwnProfile]);

  if (!effectiveUserId) {
    return (
      <AuthView
        embedded
        onSuccess={onAuthSuccess}
        subtitle="Sign in to view and manage your StartOrigin profile."
      />
    );
  }

  const openSubscribersModal = () => {
    if (!isOwnProfile) return;
    setSubscribersModalTab('followers');
    setFollowingQuery('');
    setFollowingError(null);
    setSubscribersError(null);
    setSubscribersModalOpen(true);
    loadSubscribersModal();
    loadFollowingModal();
  };

  const handleRemoveSubscriber = async (subUser: {
    id: string;
    name: string;
    username: string;
    avatar_url: string;
  }) => {
    if (!currentUserId || subscriberActionId) return;
    setSubscriberActionId(subUser.id);
    setSubscribersError(null);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('subscriber_id', subUser.id)
        .eq('target_user_id', currentUserId);
      if (error) {
        setSubscribersError(error.message);
        return;
      }
      setSubscribersList((prev) => prev.filter((u) => u.id !== subUser.id));
      setSubscribersCount((c) => Math.max(0, c - 1));
      onShowToast?.(`Removed @${subUser.username} from followers`);
    } finally {
      setSubscriberActionId(null);
    }
  };

  const handleRestrictSubscriber = async (subUser: {
    id: string;
    name: string;
    username: string;
    avatar_url: string;
  }) => {
    if (!currentUserId || subscriberActionId) return;
    setSubscriberActionId(subUser.id);
    setSubscribersError(null);
    try {
      const { error: delErr } = await supabase
        .from('subscriptions')
        .delete()
        .eq('subscriber_id', subUser.id)
        .eq('target_user_id', currentUserId);
      if (delErr) {
        setSubscribersError(delErr.message);
        return;
      }

      const { error: restrErr } = await supabase
        .from('subscription_restrictions')
        .upsert(
          {
            owner_id: currentUserId,
            restricted_user_id: subUser.id,
          },
          { onConflict: 'owner_id,restricted_user_id' }
        );

      if (restrErr) {
        setSubscribersError(restrErr.message);
        return;
      }

      setSubscribersList((prev) => prev.filter((u) => u.id !== subUser.id));
      setRestrictedList((prev) =>
        prev.some((u) => u.id === subUser.id) ? prev : [subUser, ...prev]
      );
      setSubscribersCount((c) => Math.max(0, c - 1));
      onShowToast?.(`Restricted @${subUser.username} from following`);
    } finally {
      setSubscriberActionId(null);
    }
  };

  const handleAllowUser = async (user: {
    id: string;
    name: string;
    username: string;
    avatar_url: string;
  }) => {
    if (!currentUserId || subscriberActionId) return;
    setSubscriberActionId(user.id);
    setSubscribersError(null);
    try {
      const { error } = await supabase
        .from('subscription_restrictions')
        .delete()
        .eq('owner_id', currentUserId)
        .eq('restricted_user_id', user.id);

      if (error) {
        setSubscribersError(error.message);
        return;
      }
      setRestrictedList((prev) => prev.filter((u) => u.id !== user.id));
      onShowToast?.(`Allowed @${user.username} to follow again`);
    } finally {
      setSubscriberActionId(null);
    }
  };

  const handleToggleSubscribe = async () => {
    if (!currentUserId || !profile || isOwnProfile || subBusy) return;
    if (!isSubscribed && isRestrictedByOwner) {
      onShowToast?.('You cannot follow this user.');
      return;
    }
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
        if (error) {
          onShowToast?.('You are restricted from following this user.');
          return;
        }
        setIsSubscribed(true);
        setSubscribersCount((c) => c + 1);
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          actor_id: currentUserId,
          action_type: 'subscribe',
          target_id: profile.id,
          description: `Followed @${profile.username}`,
          is_public: true,
        });
        syncAndNotifyAchievements(currentUserId, undefined, onShowToast);
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

  const handleUnfollowUser = async (targetUser: {
    id: string;
    name: string;
    username: string;
  }) => {
    if (!currentUserId || followingActionId) return;
    setFollowingActionId(targetUser.id);
    setFollowingError(null);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('subscriber_id', currentUserId)
        .eq('target_user_id', targetUser.id);
      if (error) {
        setFollowingError(error.message);
        return;
      }
      setFollowingList((prev) => prev.filter((u) => u.id !== targetUser.id));
      onShowToast?.(`Unfollowed @${targetUser.username}`);
      onProfileUpdated();
    } finally {
      setFollowingActionId(null);
    }
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
              className="w-20 h-20 rounded-full object-cover border border-black/[0.08] shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#0A0A0A] text-white text-xl font-medium flex items-center justify-center shrink-0">
              {getInitials(profile.name)}
            </div>
          )}

          <div className="space-y-2 min-w-0">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-semibold text-[#0A0A0A] tracking-tight">
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
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={openSubscribersModal}
                  className="hover:text-[#0A0A0A] hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-black rounded"
                >
                  <strong className="font-semibold text-[#0A0A0A]">
                    {subscribersCount}
                  </strong>{' '}
                  {subscribersCount === 1 ? 'follower' : 'followers'}
                </button>
              ) : (
                <span>
                  <strong className="font-semibold text-[#0A0A0A]">
                    {subscribersCount}
                  </strong>{' '}
                  {subscribersCount === 1 ? 'follower' : 'followers'}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>
                <strong className="font-semibold text-[#0A0A0A]">
                  {publicPhotos.length}
                </strong>{' '}
                {publicPhotos.length === 1 ? 'photo' : 'photos'}
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
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyTextToClipboard(getProfileShareUrl(profile.id));
                  if (ok) {
                    setCopiedProfileLink(true);
                    onShowToast?.('Profile link copied');
                    setTimeout(() => setCopiedProfileLink(false), 2000);
                  }
                }}
                aria-label="Copy profile link"
                title="Copy profile link"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#525252] hover:text-[#0A0A0A] inline-flex items-center justify-center transition-colors shrink-0"
              >
                {copiedProfileLink ? (
                  <Check className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <Link2 className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="md:hidden min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#525252] hover:text-[#0A0A0A] inline-flex items-center justify-center transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
            </>
          ) : (
            <>
              {currentUserId &&
                (isRestrictedByOwner ? (
                  <span className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-xs font-medium text-[#737373] inline-flex items-center gap-2 whitespace-nowrap">
                    <Ban className="w-3.5 h-3.5" />
                    <span>Restricted</span>
                  </span>
                ) : (
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
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                ))}

              <button
                type="button"
                onClick={async () => {
                  const ok = await copyTextToClipboard(getProfileShareUrl(profile.id));
                  if (ok) {
                    setCopiedProfileLink(true);
                    onShowToast?.('Profile link copied');
                    setTimeout(() => setCopiedProfileLink(false), 2000);
                  }
                }}
                aria-label="Copy profile link"
                title="Copy profile link"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#525252] hover:text-[#0A0A0A] inline-flex items-center justify-center transition-colors shrink-0"
              >
                {copiedProfileLink ? (
                  <Check className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <Link2 className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>

              <a
                href="https://forms.gle/HgAKvJoMa3mBU3Bd6"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Report user"
                title="Report"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#525252] hover:text-[#0A0A0A] inline-flex items-center justify-center transition-colors shrink-0"
              >
                <Flag className="w-4 h-4" strokeWidth={1.75} />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Segmented Tabs with sliding focus pill */}
      <div className="my-6 w-full sm:w-fit overflow-x-auto">
        <SlidingTabs
          value={activeTab}
          onChange={setActiveTab}
          className="w-max min-w-full sm:min-w-0"
          buttonClassName="min-h-[38px] px-4 py-1.5 text-xs"
          items={[
            { id: 'photos', label: 'Photos' },
            ...(showCollectionsTab
              ? [{ id: 'collections' as const, label: 'Collections' }]
              : []),
            ...(showAchievementsTab
              ? [{ id: 'achievements' as const, label: 'Achievements' }]
              : []),
            ...(showSavedTab ? [{ id: 'saved' as const, label: 'Saved Photos' }] : []),
            { id: 'activity', label: 'Recent Activity' },
          ]}
        />
      </div>

      <div key={activeTab} className="animate-tab-panel">

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
                          {colPhotos.length}
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
                      {unlockedCount} of {totalCount} unlocked
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
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-[#0A0A0A] truncate group-hover:underline min-w-0">
                              {definition.name}
                            </h3>
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

      </div>

      {/* Edit Profile Modal (General Only) */}
      {editOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Edit Profile"
            onClick={() => setEditOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white text-[#0A0A0A] border border-black/[0.08] rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl animate-modal-pop"
            >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#0A0A0A]">
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close edit profile"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-[#F5F5F7] text-[#0A0A0A] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
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
          </div>
        </ModalPortal>
      )}

      {/* Connections Modal: Followers | Following | Restricted (Own Profile) */}
      {subscribersModalOpen && isOwnProfile && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Manage followers and following"
            onClick={() => setSubscribersModalOpen(false)}
          >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] flex flex-col bg-white border border-black/[0.08] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#0A0A0A]">
                Connections
              </h2>
              <button
                type="button"
                onClick={() => setSubscribersModalOpen(false)}
                aria-label="Close connections"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] text-[#0A0A0A] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <SlidingTabs
                value={subscribersModalTab}
                onChange={setSubscribersModalTab}
                className="w-max min-w-full sm:min-w-0"
                buttonClassName="min-h-[36px] px-3 py-1.5 text-xs tabular-nums"
                items={[
                  { id: 'followers', label: `Followers (${subscribersList.length})` },
                  { id: 'following', label: `Following (${followingList.length})` },
                  { id: 'restricted', label: `Restricted (${restrictedList.length})` },
                ]}
              />
            </div>

            {(subscribersError || followingError) && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
                {subscribersError || followingError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1">
              <div key={subscribersModalTab} className="space-y-2.5 animate-tab-panel">
                {subscribersModalTab === 'followers' ? (
                  subscribersLoading ? (
                    <div className="py-10 text-center text-xs text-[#737373]">
                      Loading...
                    </div>
                  ) : subscribersList.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-black/[0.06] bg-[#FAFAFA]">
                      <Users className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
                      <p className="text-xs text-[#737373]">No followers yet.</p>
                    </div>
                  ) : (
                    subscribersList.map((subUser) => {
                      const busy = subscriberActionId === subUser.id;
                      return (
                        <div
                          key={subUser.id}
                          className="p-3 rounded-2xl border border-black/[0.08] bg-white flex items-center justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSubscribersModalOpen(false);
                              onOpenProfile?.(subUser.id);
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                          >
                            {subUser.avatar_url ? (
                              <img
                                src={subUser.avatar_url}
                                alt={subUser.name}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover border border-black/[0.08] shrink-0"
                              />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                                {getInitials(subUser.name)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-semibold text-[#0A0A0A] truncate group-hover:underline">
                                  {subUser.name}
                                </p>
                                <VerifiedBadge username={subUser.username} />
                              </div>
                              <p className="text-[11px] text-[#737373] truncate">
                                @{subUser.username}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRemoveSubscriber(subUser)}
                              className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-[11px] font-medium text-[#0A0A0A] inline-flex items-center gap-1 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRestrictSubscriber(subUser)}
                              className="min-h-[34px] px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Restrict</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : subscribersModalTab === 'following' ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        strokeWidth={1.75}
                      />
                      <input
                        type="text"
                        value={followingQuery}
                        onChange={(e) => setFollowingQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-xs"
                      />
                    </div>

                    {followingLoading ? (
                      <div className="py-10 text-center text-xs text-[#737373]">
                        Loading...
                      </div>
                    ) : (
                      (() => {
                        const q = followingQuery.trim().toLowerCase().replace(/^@/, '');
                        const filtered = followingList.filter(
                          (u) =>
                            !q ||
                            u.name.toLowerCase().includes(q) ||
                            u.username.toLowerCase().includes(q)
                        );
                        if (filtered.length === 0) {
                          return (
                            <div className="py-10 text-center rounded-2xl border border-black/[0.06] bg-[#FAFAFA]">
                              <Users
                                className="w-6 h-6 mx-auto text-[#737373] mb-2"
                                strokeWidth={1.5}
                              />
                              <p className="text-xs text-[#737373]">
                                {followingList.length === 0
                                  ? 'You are not following anyone yet.'
                                  : 'No matching users found.'}
                              </p>
                            </div>
                          );
                        }
                        return filtered.map((u) => {
                          const busy = followingActionId === u.id;
                          return (
                            <div
                              key={u.id}
                              className="p-3 rounded-2xl border border-black/[0.08] bg-white flex items-center justify-between gap-3"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSubscribersModalOpen(false);
                                  onOpenProfile?.(u.id);
                                }}
                                className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                              >
                                {u.avatar_url ? (
                                  <img
                                    src={u.avatar_url}
                                    alt={u.name}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-full object-cover border border-black/[0.08] shrink-0"
                                  />
                                ) : (
                                  <span className="w-9 h-9 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                                    {getInitials(u.name)}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-semibold text-[#0A0A0A] truncate group-hover:underline">
                                      {u.name}
                                    </p>
                                    <VerifiedBadge
                                      username={u.username}
                                      isVerified={u.is_verified}
                                    />
                                  </div>
                                  <p className="text-[11px] text-[#737373] truncate">
                                    @{u.username}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleUnfollowUser(u)}
                                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-[11px] font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>Unfollow</span>
                              </button>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                ) : subscribersLoading ? (
                  <div className="py-10 text-center text-xs text-[#737373]">
                    Loading...
                  </div>
                ) : restrictedList.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-black/[0.06] bg-[#FAFAFA]">
                    <Ban className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
                    <p className="text-xs text-[#737373]">No restricted users.</p>
                  </div>
                ) : (
                  restrictedList.map((user) => {
                    const busy = subscriberActionId === user.id;
                    return (
                      <div
                        key={user.id}
                        className="p-3 rounded-2xl border border-black/[0.08] bg-white flex items-center justify-between gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSubscribersModalOpen(false);
                            onOpenProfile?.(user.id);
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                        >
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-black/[0.08] shrink-0"
                            />
                          ) : (
                            <span className="w-9 h-9 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                              {getInitials(user.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-semibold text-[#0A0A0A] truncate group-hover:underline">
                                {user.name}
                              </p>
                              <VerifiedBadge username={user.username} />
                            </div>
                            <p className="text-[11px] text-[#737373] truncate">
                              @{user.username}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleAllowUser(user)}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#0A0A0A] hover:bg-black/85 text-white text-[11px] font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Allow</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Achievement Detail Modal */}
      <AchievementDetailModal
        status={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </div>
  );
};
