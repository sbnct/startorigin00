import React, { useCallback, useEffect, useState } from 'react';
import { Check, Compass, Link2, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CinemaPhoto, PhotoWithAuthor } from '../types';
import {
  copyTextToClipboard,
  formatDate,
  getInitials,
  getPhotoShareUrl,
} from '../lib/utils';
import { MentionText } from './MentionText';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';
import { LikeButton } from './LikeButton';
import { fetchPhotoLikesMap, togglePhotoLike } from '../lib/likes';

interface FeedViewProps {
  currentUserId: string | null;
  onOpenCinema: (photo: CinemaPhoto, collectionItems?: CinemaPhoto[]) => void;
  onOpenPost: (photoId: string) => void;
  onOpenProfile: (userId: string) => void;
  onOpenProfileByUsername: (username: string) => void;
  onRequireAuth: () => void;
  onShowToast?: (msg: string) => void;
  refreshKey: number;
}

export const FeedView: React.FC<FeedViewProps> = ({
  currentUserId,
  onOpenCinema,
  onOpenPost,
  onOpenProfile,
  onOpenProfileByUsername,
  onRequireAuth,
  onShowToast,
  refreshKey,
}) => {
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
  const [photos, setPhotos] = useState<PhotoWithAuthor[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (feedFilter === 'following') {
        if (!currentUserId) {
          setPhotos([]);
          setLoading(false);
          return;
        }

        const { data: subs, error: subsErr } = await supabase
          .from('subscriptions')
          .select('target_user_id')
          .eq('subscriber_id', currentUserId);

        if (subsErr) {
          setError(subsErr.message);
          setLoading(false);
          return;
        }

        const followedIds = (subs || []).map((s) => s.target_user_id);
        if (followedIds.length === 0) {
          setPhotos([]);
          setLoading(false);
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from('photos')
          .select(
            `
            *,
            profiles:user_id (id, name, username, avatar_url)
          `
          )
          .in('privacy', ['public', 'followers'])
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(60);

        if (fetchErr) {
          setError(fetchErr.message);
          return;
        }

        setPhotos((data as PhotoWithAuthor[]) || []);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('photos')
        .select(
          `
          *,
          profiles:user_id (id, name, username, avatar_url)
        `
        )
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .limit(60);

      if (fetchErr) {
        setError(fetchErr.message);
        return;
      }

      setPhotos((data as PhotoWithAuthor[]) || []);
    } finally {
      setLoading(false);
    }
  }, [feedFilter, currentUserId]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed, refreshKey]);

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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
            Feed
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-xl">
            <button
              type="button"
              onClick={() => setFeedFilter('all')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                feedFilter === 'all'
                  ? 'bg-white text-[#0A0A0A] shadow-xs'
                  : 'text-[#737373] hover:text-[#0A0A0A]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('following')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                feedFilter === 'following'
                  ? 'bg-white text-[#0A0A0A] shadow-xs'
                  : 'text-[#737373] hover:text-[#0A0A0A]'
              }`}
            >
              Following
            </button>
          </div>

          <button
            type="button"
            onClick={loadFeed}
            aria-label="Refresh feed"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] text-[#0A0A0A] transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 mb-6">
          {error}
        </div>
      )}

      {loading && photos.length === 0 && (
        <div className="space-y-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-[4/3] w-full rounded-2xl bg-[#F5F5F7]" />
              <div className="h-4 w-48 rounded bg-[#F5F5F7]" />
              <div className="h-3 w-32 rounded bg-[#F5F5F7]" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && feedFilter === 'following' && !currentUserId && (
        <div className="py-16 px-6 text-center space-y-4 border border-black/[0.06] rounded-3xl bg-[#FAFAFA]">
          <Users className="w-8 h-8 mx-auto text-[#737373]" strokeWidth={1.5} />
          <div className="space-y-1">
            <h2 className="text-base font-medium text-[#0A0A0A]">
              Sign in to see your Following feed
            </h2>
            <p className="text-xs text-[#737373] max-w-xs mx-auto">
              Subscribe to creators you like to view their latest public frames here.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequireAuth}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors"
          >
            Sign In
          </button>
        </div>
      )}

      {!loading &&
        !error &&
        !(feedFilter === 'following' && !currentUserId) &&
        photos.length === 0 && (
          <div className="py-20 text-center space-y-3 border border-black/[0.06] rounded-3xl bg-[#FAFAFA]">
            <Compass className="w-8 h-8 mx-auto text-[#737373]" strokeWidth={1.5} />
            <h2 className="text-base font-medium text-[#0A0A0A]">
              {feedFilter === 'following'
                ? 'No photos from followed users yet'
                : 'No public photos yet'}
            </h2>
            <p className="text-xs text-[#737373] max-w-xs mx-auto">
              {feedFilter === 'following'
                ? 'Follow creators from All or Search to fill this feed.'
                : 'Upload a public photo from the Add tab to start the chronological feed.'}
            </p>
          </div>
        )}

      <div className="space-y-10">
        {(() => {
          const cinemaList: CinemaPhoto[] = photos.map((p) => ({
            id: p.id,
            title: p.title,
            image_url: p.image_url,
            subtitle: p.profiles ? `${p.profiles.name} · @${p.profiles.username}` : undefined,
          }));
          return photos.map((photo, idx) => {
            const author = photo.profiles;
            return (
              <article
                key={photo.id}
                className="pb-8 border-b border-black/[0.08] last:border-b-0"
              >
                {/* Photo — clicking opens Cinema view */}
                <button
                  type="button"
                  onClick={() => onOpenCinema(cinemaList[idx], cinemaList)}
                  className="block w-full text-left group rounded-2xl overflow-hidden focus-visible:outline-2 focus-visible:outline-black"
                >
                <ResilientImage
                  src={photo.image_url}
                  alt={photo.title}
                  containerClassName="w-full aspect-[4/3] sm:aspect-[16/11] rounded-2xl border border-black/[0.06]"
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                />
              </button>

              {/* Below photo: Post Name (opens Post Page; @mentions open User Profile), Like Button Container & Profile Link */}
              <div className="mt-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenPost(photo.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenPost(photo.id);
                      }
                    }}
                    className="text-base font-medium text-[#0A0A0A] hover:opacity-75 transition-opacity cursor-pointer leading-snug min-w-0 pt-1"
                  >
                    <MentionText
                      text={photo.title}
                      onMentionClick={onOpenProfileByUsername}
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await copyTextToClipboard(getPhotoShareUrl(photo.id));
                        if (ok) {
                          setCopiedId(photo.id);
                          onShowToast?.('Photo link copied');
                          setTimeout(() => {
                            setCopiedId((prev) => (prev === photo.id ? null : prev));
                          }, 2000);
                        }
                      }}
                      aria-label={`Copy link for ${photo.title}`}
                      className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] hover:bg-black/[0.08] text-[#0A0A0A] inline-flex items-center justify-center transition-colors"
                    >
                      {copiedId === photo.id ? (
                        <Check className="w-4 h-4" strokeWidth={2} />
                      ) : (
                        <Link2 className="w-4 h-4" strokeWidth={1.75} />
                      )}
                    </button>

                    <LikeButton
                      liked={likedIds.has(photo.id)}
                      count={likeCounts[photo.id] || 0}
                      busy={likeBusyIds.has(photo.id)}
                      onToggle={() => handleToggleLike(photo)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-[#737373]">
                  {author ? (
                    <button
                      type="button"
                      onClick={() => onOpenProfile(author.id)}
                      className="flex items-center gap-2 hover:text-[#0A0A0A] transition-colors min-w-0"
                    >
                      {author.avatar_url ? (
                        <img
                          src={author.avatar_url}
                          alt={author.name}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover border border-black/[0.08] shrink-0"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-[#0A0A0A] text-white text-[9px] font-medium flex items-center justify-center shrink-0">
                          {getInitials(author.name)}
                        </span>
                      )}
                      <span className="font-medium text-[#0A0A0A] truncate">
                        {author.name}
                      </span>
                      <VerifiedBadge
                        username={author.username}
                        isVerified={author.is_verified}
                      />
                      <span className="truncate">@{author.username}</span>
                    </button>
                  ) : (
                    <span>StartOrigin Creator</span>
                  )}

                  <span className="tabular-nums shrink-0">
                    {photo.privacy === 'followers' ? 'Followers · ' : ''}
                    {formatDate(photo.photo_date || photo.created_at)}
                  </span>
                </div>
              </div>
              </article>
            );
          });
        })()}
      </div>
    </div>
  );
};
