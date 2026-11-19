import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Check,
  Folder,
  LogOut,
  Pencil,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  ActivityLog,
  Photo,
  Profile,
  SavedCollectionItem,
} from '../types';
import {
  formatDate,
  formatRelativeTime,
  getInitials,
  sanitizeFilename,
} from '../lib/utils';
import { AuthView } from './AuthView';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';
import { PWAInstallButton } from './PWAInstallButton';

interface ProfileViewProps {
  targetUserId: string | null;
  currentUserId: string | null;
  showBackButton?: boolean;
  onBack?: () => void;
  onAuthSuccess: () => void;
  onOpenPost: (photoId: string) => void;
  onProfileUpdated: () => void;
  onSignOut?: () => void;
  refreshKey: number;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  targetUserId,
  currentUserId,
  showBackButton = false,
  onBack,
  onAuthSuccess,
  onOpenPost,
  onProfileUpdated,
  onSignOut,
  refreshKey,
}) => {
  const effectiveUserId = targetUserId || currentUserId;
  const isOwnProfile = Boolean(
    currentUserId && effectiveUserId && currentUserId === effectiveUserId
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const [publicPhotos, setPublicPhotos] = useState<Photo[]>([]);
  const [savedCollections, setSavedCollections] = useState<SavedCollectionItem[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeTab, setActiveTab] = useState<'photos' | 'saved' | 'activity'>('photos');
  const [openedSavedCollection, setOpenedSavedCollection] = useState<{
    id: string;
    name: string;
    photos: Photo[];
  } | null>(null);
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
          .from('saved_collections')
          .select(
            `
            *,
            collections:collection_id (
              id,
              user_id,
              name,
              created_at,
              updated_at,
              profiles:user_id (id, name, username, avatar_url)
            )
          `
          )
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false }),
      ]);

      setProfile((profData as Profile) || null);
      setPublicPhotos((photosData as Photo[]) || []);
      setSubscribersCount(subCount || 0);
      setActivities((actData as ActivityLog[]) || []);

      // Load preview public photos for each saved collection
      const rawSaved = (savedData as SavedCollectionItem[]) || [];
      const colIds = rawSaved.map((s) => s.collection_id).filter(Boolean);
      if (colIds.length > 0) {
        const { data: colPhotos } = await supabase
          .from('photos')
          .select('*')
          .in('collection_id', colIds)
          .eq('privacy', 'public')
          .order('created_at', { ascending: false });

        const allColPhotos = (colPhotos as Photo[]) || [];
        const enriched = rawSaved.map((item) => {
          const matching = allColPhotos.filter((p) => p.collection_id === item.collection_id);
          return {
            ...item,
            collections: item.collections
              ? {
                  ...item.collections,
                  preview_photos: matching.slice(0, 4),
                  photo_count: matching.length,
                }
              : null,
          };
        });
        setSavedCollections(enriched);
      } else {
        setSavedCollections([]);
      }

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
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, currentUserId]);

  useEffect(() => {
    setOpenedSavedCollection(null);
    loadProfileData();
  }, [loadProfileData, refreshKey]);

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

  const handleOpenSavedCollection = async (item: SavedCollectionItem) => {
    if (!item.collections) return;
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('collection_id', item.collection_id)
      .eq('privacy', 'public')
      .order('created_at', { ascending: false });
    setOpenedSavedCollection({
      id: item.collection_id,
      name: item.collections.name,
      photos: (data as Photo[]) || [],
    });
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
          onClick={() => {
            setActiveTab('photos');
            setOpenedSavedCollection(null);
          }}
          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'photos'
              ? 'bg-white text-[#0A0A0A] shadow-xs'
              : 'text-[#737373] hover:text-[#0A0A0A]'
          }`}
        >
          Photos
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('saved');
            setOpenedSavedCollection(null);
          }}
          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'saved'
              ? 'bg-white text-[#0A0A0A] shadow-xs'
              : 'text-[#737373] hover:text-[#0A0A0A]'
          }`}
        >
          Saved Collections
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('activity');
            setOpenedSavedCollection(null);
          }}
          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'activity'
              ? 'bg-white text-[#0A0A0A] shadow-xs'
              : 'text-[#737373] hover:text-[#0A0A0A]'
          }`}
        >
          Recent Activity
        </button>
      </div>

      {/* Tab 1: Public Photos Grid (Clicking opens Post Page) */}
      {activeTab === 'photos' && (
        <div>
          {publicPhotos.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
              <Camera className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#737373]">No public photos published yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {publicPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenPost(photo.id)}
                  className="group text-left focus-visible:outline-2 focus-visible:outline-black rounded-2xl"
                >
                  <ResilientImage
                    src={photo.image_url}
                    alt={photo.title}
                    containerClassName="aspect-square rounded-2xl border border-black/[0.06]"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  <p className="text-xs font-medium text-[#0A0A0A] truncate mt-2">
                    {photo.title}
                  </p>
                  <p className="text-[11px] text-[#737373] tabular-nums">
                    {formatDate(photo.photo_date || photo.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Saved Collections */}
      {activeTab === 'saved' && (
        <div>
          {openedSavedCollection ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => setOpenedSavedCollection(null)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Saved Collections</span>
              </button>
              <h2 className="text-base font-semibold text-[#0A0A0A]">
                {openedSavedCollection.name}
              </h2>
              {openedSavedCollection.photos.length === 0 ? (
                <p className="text-xs text-[#737373]">
                  No public photos in this collection.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {openedSavedCollection.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => onOpenPost(photo.id)}
                      className="group text-left rounded-2xl"
                    >
                      <ResilientImage
                        src={photo.image_url}
                        alt={photo.title}
                        containerClassName="aspect-square rounded-2xl border border-black/[0.06]"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <p className="text-xs font-medium text-[#0A0A0A] truncate mt-2">
                        {photo.title}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : savedCollections.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
              <Bookmark className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
              <p className="text-xs text-[#737373]">
                No saved collections yet. Save a collection from any post page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedCollections.map((item) => {
                const col = item.collections;
                if (!col) return null;
                const previews = col.preview_photos || [];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenSavedCollection(item)}
                    className="group text-left p-3.5 rounded-3xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] transition-colors"
                  >
                    <div className="grid grid-cols-2 gap-1.5 aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F5F7] mb-3">
                      {previews.length === 0 ? (
                        <div className="col-span-2 flex items-center justify-center text-[#737373]">
                          <Folder className="w-5 h-5 opacity-40" />
                        </div>
                      ) : (
                        previews.map((p) => (
                          <ResilientImage
                            key={p.id}
                            src={p.image_url}
                            alt={p.title}
                            containerClassName="w-full h-full"
                            className="w-full h-full object-cover"
                          />
                        ))
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                      {col.name}
                    </p>
                    <p className="text-[11px] text-[#737373] tabular-nums">
                      {col.profiles ? `@${col.profiles.username} · ` : ''}
                      {col.photo_count || 0} photos
                    </p>
                  </button>
                );
              })}
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
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm"
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
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm resize-none"
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
    </div>
  );
};
