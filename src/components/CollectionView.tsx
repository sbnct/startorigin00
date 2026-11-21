import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Folder,
  Globe,
  Info,
  Link2,
  Lock,
  Plus,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  CinemaPhoto,
  Collection,
  CollectionPrivacy,
  PhotoWithAuthor,
  Profile,
} from '../types';
import {
  copyTextToClipboard,
  formatDate,
  getCollectionShareUrl,
  getInitials,
  getVisibilityLabel,
} from '../lib/utils';
import { fetchPhotoLikesMap, togglePhotoLike } from '../lib/likes';
import { LikeButton } from './LikeButton';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';
import { AddPhotoModal } from './AddPhotoModal';
import { syncAndNotifyAchievements } from '../lib/achievements';
import { RulesModal } from './RulesModal';

interface CollectionWithAuthor extends Collection {
  profiles?: Pick<Profile, 'id' | 'name' | 'username' | 'avatar_url' | 'is_verified'> | null;
}

interface CollectionViewProps {
  collectionId: string;
  currentUserId: string | null;
  onBack: () => void;
  onOpenPost: (photoId: string) => void;
  onOpenCinema: (photo: CinemaPhoto, collectionItems?: CinemaPhoto[]) => void;
  onOpenProfile: (userId: string) => void;
  onRequireAuth: () => void;
  onShowToast?: (msg: string) => void;
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  collectionId,
  currentUserId,
  onBack,
  onOpenPost,
  onOpenCinema,
  onOpenProfile,
  onRequireAuth,
  onShowToast,
}) => {
  const [collection, setCollection] = useState<CollectionWithAuthor | null>(null);
  const [photos, setPhotos] = useState<PhotoWithAuthor[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [ownerCollections, setOwnerCollections] = useState<Collection[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  const loadCollection = useCallback(async () => {
    setLoading(true);
    try {
      const { data: colData, error: colErr } = await supabase
        .from('collections')
        .select(
          `
          *,
          profiles:user_id (id, name, username, avatar_url)
        `
        )
        .eq('id', collectionId)
        .maybeSingle();

      if (colErr || !colData) {
        setCollection(null);
        setPhotos([]);
        return;
      }

      const typedCol = colData as CollectionWithAuthor;
      const colPrivacy = (typedCol.privacy || 'public') as CollectionPrivacy;
      const isOwner = Boolean(currentUserId && typedCol.user_id === currentUserId);
      let isFollower = false;

      if (!isOwner && currentUserId) {
        const { data: subRow } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('subscriber_id', currentUserId)
          .eq('target_user_id', typedCol.user_id)
          .maybeSingle();
        isFollower = Boolean(subRow);
      }

      if (colPrivacy === 'private' && !isOwner) {
        setCollection(null);
        setPhotos([]);
        return;
      }

      if (colPrivacy === 'followers' && !isOwner && !isFollower) {
        setCollection(null);
        setPhotos([]);
        return;
      }

      setCollection(typedCol);

      let query = supabase
        .from('photos')
        .select(
          `
          *,
          profiles:user_id (id, name, username, avatar_url)
        `
        )
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false });

      if (!isOwner) {
        if (isFollower) {
          if (colPrivacy === 'unlisted') {
            query = query.in('privacy', ['public', 'followers', 'unlisted']);
          } else {
            query = query.in('privacy', ['public', 'followers']);
          }
        } else {
          if (colPrivacy === 'unlisted') {
            query = query.in('privacy', ['public', 'unlisted']);
          } else {
            query = query.eq('privacy', 'public');
          }
        }
      }

      const { data: photoRows } = await query;
      setPhotos((photoRows as PhotoWithAuthor[]) || []);

      if (currentUserId && typedCol.user_id === currentUserId) {
        const { data: myCols } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', currentUserId)
          .order('updated_at', { ascending: false });
        setOwnerCollections((myCols as Collection[]) || [typedCol]);
      } else {
        setOwnerCollections([]);
      }
    } finally {
      setLoading(false);
    }
  }, [collectionId, currentUserId]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  useEffect(() => {
    let active = true;
    const ids = photos.map((p) => p.id);
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
  }, [photos, currentUserId]);

  const handleToggleLike = async (photo: PhotoWithAuthor) => {
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

  const handleCopyCollectionLink = async () => {
    if (!collection) return;
    const ok = await copyTextToClipboard(getCollectionShareUrl(collection.id));
    if (ok) {
      setCopiedLink(true);
      onShowToast?.('Collection link copied');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-pulse space-y-6">
        <div className="h-9 w-24 rounded-xl bg-[#F5F5F7]" />
        <div className="h-8 w-56 rounded bg-[#F5F5F7]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-[#F5F5F7]" />
          ))}
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>
        <p className="text-sm text-[#737373]">
          This collection is private, for followers only, or unavailable.
        </p>
        {!currentUserId && (
          <button
            type="button"
            onClick={onRequireAuth}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors"
          >
            Sign In to Check Access
          </button>
        )}
      </div>
    );
  }

  const author = collection.profiles;
  const colPrivacy = (collection.privacy || 'public') as CollectionPrivacy;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Go Back</span>
        </button>

        <div className="flex items-center gap-2">
          {currentUserId && collection.user_id === currentUserId && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              aria-label="Add photo"
              title="Add photo"
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-[#0A0A0A] hover:bg-black/85 text-white inline-flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyCollectionLink}
            aria-label={copiedLink ? 'Link copied' : 'Copy link'}
            title={copiedLink ? 'Link copied' : 'Copy link'}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#0A0A0A] inline-flex items-center justify-center transition-colors"
          >
            {copiedLink ? (
              <Check className="w-4 h-4" strokeWidth={2} />
            ) : (
              <Link2 className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            aria-label="Open StartOrigin rules"
            title="Rules"
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#0A0A0A] inline-flex items-center justify-center transition-colors"
          >
            <Info className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Collection Header */}
      <div className="pb-6 mb-8 border-b border-black/[0.08] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[11px] font-medium text-[#525252]">
            {colPrivacy === 'private' ? (
              <Lock className="w-3 h-3" strokeWidth={1.75} />
            ) : colPrivacy === 'unlisted' ? (
              <Link2 className="w-3 h-3" strokeWidth={1.75} />
            ) : colPrivacy === 'followers' ? (
              <Users className="w-3 h-3" strokeWidth={1.75} />
            ) : (
              <Globe className="w-3 h-3" strokeWidth={1.75} />
            )}
            <span>{getVisibilityLabel(colPrivacy)} Collection</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
            {collection.name}
          </h1>

          {author && (
            <button
              type="button"
              onClick={() => onOpenProfile(author.id)}
              className="inline-flex items-center gap-2 group"
            >
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt={author.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover border border-black/[0.08]"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-[#0A0A0A] text-white text-[10px] font-medium flex items-center justify-center">
                  {getInitials(author.name)}
                </span>
              )}
              <span className="text-xs font-medium text-[#0A0A0A] group-hover:underline">
                {author.name}
              </span>
              <VerifiedBadge
                username={author.username}
                isVerified={author.is_verified}
              />
              <span className="text-xs text-[#737373]">@{author.username}</span>
            </button>
          )}
        </div>

        <p className="text-xs text-[#737373] tabular-nums">
          {photos.length}
        </p>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
          <Folder className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
          <p className="text-xs text-[#737373]">No public photos in this collection yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(() => {
            const cinemaList: CinemaPhoto[] = photos.map((p) => ({
              id: p.id,
              title: p.title,
              image_url: p.image_url,
              subtitle: p.profiles
                ? `${p.profiles.name} · @${p.profiles.username}`
                : collection.name,
            }));

            return photos.map((photo, idx) => (
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

      {currentUserId && collection.user_id === currentUserId && (
        <AddPhotoModal
          isOpen={addModalOpen}
          currentUserId={currentUserId}
          collections={ownerCollections.length > 0 ? ownerCollections : [collection]}
          defaultCollectionId={collection.id}
          onClose={() => setAddModalOpen(false)}
          onSuccess={(count, destinationLabel) => {
            loadCollection();
            onShowToast?.(
              `${count} ${count === 1 ? 'photo' : 'photos'} uploaded ${destinationLabel}.`
            );
            syncAndNotifyAchievements(currentUserId, undefined, onShowToast);
          }}
        />
      )}
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
};
