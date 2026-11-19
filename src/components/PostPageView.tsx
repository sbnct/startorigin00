import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, Heart, Maximize2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CinemaPhoto, PhotoWithAuthor } from '../types';
import { formatDate, getInitials } from '../lib/utils';
import { MentionText } from './MentionText';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';

interface PostPageViewProps {
  photoId: string;
  currentUserId: string | null;
  onBack: () => void;
  onOpenCinema: (photo: CinemaPhoto) => void;
  onOpenPost: (photoId: string) => void;
  onOpenProfile: (userId: string) => void;
  onOpenProfileByUsername: (username: string) => void;
  onRequireAuth: () => void;
}

export const PostPageView: React.FC<PostPageViewProps> = ({
  photoId,
  currentUserId,
  onBack,
  onOpenCinema,
  onOpenPost,
  onOpenProfile,
  onOpenProfileByUsername,
  onRequireAuth,
}) => {
  const [photo, setPhoto] = useState<PhotoWithAuthor | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [collectionSaved, setCollectionSaved] = useState(false);
  const [recommended, setRecommended] = useState<PhotoWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const { data: photoData, error: photoErr } = await supabase
        .from('photos')
        .select(
          `
          *,
          profiles:user_id (id, name, username, avatar_url),
          collections:collection_id (id, name)
        `
        )
        .eq('id', photoId)
        .maybeSingle();

      if (photoErr || !photoData) {
        setPhoto(null);
        setLoading(false);
        return;
      }

      const typedPhoto = photoData as PhotoWithAuthor;
      setPhoto(typedPhoto);

      // Load likes count & whether current user liked
      const { count } = await supabase
        .from('photo_likes')
        .select('*', { count: 'exact', head: true })
        .eq('photo_id', photoId);

      setLikesCount(count || 0);

      if (currentUserId) {
        const { data: myLike } = await supabase
          .from('photo_likes')
          .select('id')
          .eq('photo_id', photoId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        setLikedByMe(Boolean(myLike));

        if (typedPhoto.collection_id) {
          const { data: savedRow } = await supabase
            .from('saved_collections')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('collection_id', typedPhoto.collection_id)
            .maybeSingle();
          setCollectionSaved(Boolean(savedRow));
        } else {
          setCollectionSaved(false);
        }
      } else {
        setLikedByMe(false);
        setCollectionSaved(false);
      }

      // Load up to 20 similar / recommended public photos
      const { data: candidates } = await supabase
        .from('photos')
        .select(
          `
          *,
          profiles:user_id (id, name, username, avatar_url)
        `
        )
        .eq('privacy', 'public')
        .neq('id', photoId)
        .order('created_at', { ascending: false })
        .limit(60);

      const list = (candidates as PhotoWithAuthor[]) || [];
      const currentTags = new Set((typedPhoto.tags || []).map((t) => t.toLowerCase()));

      const scored = list
        .map((item) => {
          let score = 0;
          if (item.user_id === typedPhoto.user_id) score += 2;
          for (const tag of item.tags || []) {
            if (currentTags.has(tag.toLowerCase())) score += 5;
          }
          if (
            typedPhoto.collection_id &&
            item.collection_id === typedPhoto.collection_id
          ) {
            score += 4;
          }
          return { item, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((entry) => entry.item);

      setRecommended(scored);
    } finally {
      setLoading(false);
    }
  }, [photoId, currentUserId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleToggleLike = async () => {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }
    if (!photo || likeBusy) return;
    setLikeBusy(true);
    try {
      if (likedByMe) {
        const { error } = await supabase
          .from('photo_likes')
          .delete()
          .eq('photo_id', photo.id)
          .eq('user_id', currentUserId);
        if (!error) {
          setLikedByMe(false);
          setLikesCount((c) => Math.max(0, c - 1));
        }
      } else {
        const { error } = await supabase.from('photo_likes').insert({
          photo_id: photo.id,
          user_id: currentUserId,
        });
        if (!error) {
          setLikedByMe(true);
          setLikesCount((c) => c + 1);
          await supabase.from('activity_logs').insert({
            user_id: currentUserId,
            actor_id: currentUserId,
            action_type: 'like',
            target_id: photo.id,
            description: `Liked "${photo.title}"`,
            is_public: true,
          });
        }
      }
    } finally {
      setLikeBusy(false);
    }
  };

  const handleToggleSaveCollection = async () => {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }
    if (!photo?.collection_id || saveBusy) return;
    setSaveBusy(true);
    try {
      if (collectionSaved) {
        const { error } = await supabase
          .from('saved_collections')
          .delete()
          .eq('user_id', currentUserId)
          .eq('collection_id', photo.collection_id);
        if (!error) setCollectionSaved(false);
      } else {
        const { error } = await supabase.from('saved_collections').insert({
          user_id: currentUserId,
          collection_id: photo.collection_id,
        });
        if (!error) {
          setCollectionSaved(true);
          await supabase.from('activity_logs').insert({
            user_id: currentUserId,
            actor_id: currentUserId,
            action_type: 'save_collection',
            target_id: photo.collection_id,
            description: `Saved collection "${photo.collections?.name || 'Collection'}"`,
            is_public: true,
          });
        }
      }
    } finally {
      setSaveBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-pulse space-y-6">
        <div className="h-9 w-24 rounded-xl bg-[#F5F5F7]" />
        <div className="aspect-[4/3] w-full rounded-3xl bg-[#F5F5F7]" />
        <div className="h-6 w-64 rounded bg-[#F5F5F7]" />
      </div>
    );
  }

  if (!photo) {
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
        <p className="text-sm text-[#737373]">This photo is unavailable or private.</p>
      </div>
    );
  }

  const author = photo.profiles;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Go Back</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenCinema({
              id: photo.id,
              title: photo.title,
              image_url: photo.image_url,
              subtitle: author ? `${author.name} · @${author.username}` : undefined,
            })
          }
          className="min-h-[44px] px-4 py-2 rounded-xl border border-black/[0.1] hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Cinema View</span>
        </button>
      </div>

      {/* Main Photo */}
      <div
        onClick={() =>
          onOpenCinema({
            id: photo.id,
            title: photo.title,
            image_url: photo.image_url,
            subtitle: author ? `${author.name} · @${author.username}` : undefined,
          })
        }
        className="cursor-zoom-in rounded-3xl overflow-hidden border border-black/[0.08] bg-[#F5F5F7]"
      >
        <img
          src={photo.image_url}
          alt={photo.title}
          referrerPolicy="no-referrer"
          className="w-full max-h-[72vh] object-contain mx-auto"
        />
      </div>

      {/* Photo Info & Like / Save Controls */}
      <div className="mt-6 pb-8 border-b border-black/[0.08] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div className="space-y-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A] leading-snug">
            <MentionText text={photo.title} onMentionClick={onOpenProfileByUsername} />
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373]">
            <span className="tabular-nums">
              {formatDate(photo.photo_date || photo.created_at)}
            </span>
            {photo.collections?.name && (
              <>
                <span aria-hidden="true">·</span>
                <span>{photo.collections.name}</span>
              </>
            )}
            {photo.tags && photo.tags.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{photo.tags.join(' · ')}</span>
              </>
            )}
          </div>

          {author && (
            <button
              type="button"
              onClick={() => onOpenProfile(author.id)}
              className="inline-flex items-center gap-2.5 pt-1 group"
            >
              {author.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt={author.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-black/[0.08]"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center">
                  {getInitials(author.name)}
                </span>
              )}
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-[#0A0A0A] group-hover:underline">
                    {author.name}
                  </p>
                  <VerifiedBadge
                    username={author.username}
                    isVerified={author.is_verified}
                  />
                </div>
                <p className="text-[11px] text-[#737373]">@{author.username}</p>
              </div>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={likeBusy}
            className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-colors tabular-nums ${
              likedByMe
                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                : 'bg-white text-[#0A0A0A] border-black/[0.12] hover:bg-[#F5F5F7]'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${likedByMe ? 'fill-white' : ''}`}
              strokeWidth={1.75}
            />
            <span>{likesCount}</span>
            <span>{likesCount === 1 ? 'Like' : 'Likes'}</span>
          </button>

          {photo.collection_id && (
            <button
              type="button"
              onClick={handleToggleSaveCollection}
              disabled={saveBusy}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-colors ${
                collectionSaved
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white text-[#0A0A0A] border-black/[0.12] hover:bg-[#F5F5F7]'
              }`}
            >
              <Bookmark
                className={`w-4 h-4 ${collectionSaved ? 'fill-white' : ''}`}
                strokeWidth={1.75}
              />
              <span>{collectionSaved ? 'Saved' : 'Save Collection'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 20 Similar / Recommended Photos */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-base font-semibold text-[#0A0A0A]">
            Similar &amp; Recommended
          </h2>
          <span className="text-xs text-[#737373] tabular-nums">
            {recommended.length} {recommended.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {recommended.length === 0 ? (
          <p className="text-xs text-[#737373] py-6">
            No additional public photos to recommend yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {recommended.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenPost(item.id)}
                className="group text-left focus-visible:outline-2 focus-visible:outline-black rounded-2xl"
              >
                <ResilientImage
                  src={item.image_url}
                  alt={item.title}
                  containerClassName="aspect-square rounded-2xl border border-black/[0.06]"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
                <p className="text-xs font-medium text-[#0A0A0A] truncate mt-2">
                  {item.title}
                </p>
                {item.profiles && (
                  <p className="text-[11px] text-[#737373] truncate">
                    @{item.profiles.username}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
