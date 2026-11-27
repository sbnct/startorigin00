import React, { useEffect, useState } from 'react';
import { Award, Clock, Pin, Search as SearchIcon, User as UserIcon, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CinemaPhoto, PhotoWithAuthor, Profile } from '../types';
import { formatDate, getInitials } from '../lib/utils';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';
import { LikeButton } from './LikeButton';
import { fetchPhotoLikesMap, togglePhotoLike } from '../lib/likes';
import { SlidingTabs } from './SlidingTabs';

interface SearchViewProps {
  currentUserId: string | null;
  onOpenCinema: (photo: CinemaPhoto) => void;
  onOpenPost: (photoId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRequireAuth: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  currentUserId,
  onOpenCinema,
  onOpenPost,
  onOpenProfile,
  onRequireAuth,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'photos' | 'users'>('all');
  const [lastJoinedUser, setLastJoinedUser] = useState<Profile | null>(null);
  const [hallOfFameUsers, setHallOfFameUsers] = useState<Profile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [photos, setPhotos] = useState<PhotoWithAuthor[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (!trimmed) {
          const [
            { data: pinnedSubnocte },
            { data: latestUser },
            { data: allUsersRows },
            { data: recentPhotos },
          ] = await Promise.all([
            supabase
              .from('profiles')
              .select('*')
              .ilike('username', 'subnocte')
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(200),
            supabase
              .from('photos')
              .select('*, profiles:user_id (id, name, username, avatar_url)')
              .eq('privacy', 'public')
              .order('created_at', { ascending: false })
              .limit(24),
          ]);

          setLastJoinedUser((latestUser as Profile) || null);
          setHallOfFameUsers(pinnedSubnocte ? [pinnedSubnocte as Profile] : []);

          const combinedUsers: Profile[] = [];
          if (pinnedSubnocte) {
            combinedUsers.push(pinnedSubnocte as Profile);
          }
          for (const u of (allUsersRows as Profile[]) || []) {
            if (!combinedUsers.some((existing) => existing.id === u.id)) {
              combinedUsers.push(u);
            }
          }
          setUsers(combinedUsers);
          setPhotos((recentPhotos as PhotoWithAuthor[]) || []);
          return;
        }

        const pattern = `%${trimmed}%`;
        const [{ data: matchedUsers }, { data: matchedPhotos }] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .or(`name.ilike.${pattern},username.ilike.${pattern}`)
            .limit(40),
          supabase
            .from('photos')
            .select('*, profiles:user_id (id, name, username, avatar_url)')
            .eq('privacy', 'public')
            .ilike('title', pattern)
            .order('created_at', { ascending: false })
            .limit(40),
        ]);

        const sortedMatchedUsers = [...((matchedUsers as Profile[]) || [])].sort(
          (a, b) => {
            const aPinned = a.username.toLowerCase() === 'subnocte' ? 1 : 0;
            const bPinned = b.username.toLowerCase() === 'subnocte' ? 1 : 0;
            return bPinned - aPinned;
          }
        );

        setUsers(sortedMatchedUsers);
        setPhotos((matchedPhotos as PhotoWithAuthor[]) || []);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

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

  const showUsers = scope === 'all' || scope === 'users';
  const showPhotos = scope === 'all' || scope === 'photos';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
          Search
        </h1>
      </div>

      {/* Search Input */}
      <div className="relative mb-5">
        <SearchIcon
          className="w-4 h-4 text-[#737373] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full min-h-[48px] pl-11 pr-11 py-3 rounded-2xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-black/[0.06] absolute right-2 top-1/2 -translate-y-1/2 text-[#737373]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Segmented Bar */}
      <div className="mb-8">
        <SlidingTabs
          value={scope}
          onChange={setScope}
          items={[
            { id: 'all', label: 'All' },
            { id: 'photos', label: 'Photos' },
            { id: 'users', label: 'Users' },
          ]}
        />
      </div>

      {loading && (
        <p className="text-xs text-[#737373] mb-6">Searching...</p>
      )}

      <div key={scope} className="animate-tab-panel">
        {/* Default Discovery Sections (hidden while actively searching) */}
        {!isSearching && showUsers && (
          <>
            {/* 1. Last Joined */}
            {lastJoinedUser && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-[#737373]" strokeWidth={1.75} />
                  <h2 className="text-sm font-semibold text-[#0A0A0A]">
                    Last Joined
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(lastJoinedUser.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.08] bg-[#FAFAFA] hover:bg-[#F5F5F7] transition-colors text-left"
                  >
                    {lastJoinedUser.avatar_url ? (
                      <img
                        src={lastJoinedUser.avatar_url}
                        alt={lastJoinedUser.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover border border-black/[0.08] shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                        {getInitials(lastJoinedUser.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-[#0A0A0A] truncate">
                          {lastJoinedUser.name}
                        </p>
                        <VerifiedBadge
                          username={lastJoinedUser.username}
                          isVerified={lastJoinedUser.is_verified}
                        />
                      </div>
                      <p className="text-xs text-[#737373] truncate">
                        @{lastJoinedUser.username} · Joined{' '}
                        {formatDate(lastJoinedUser.created_at)}
                      </p>
                    </div>
                  </button>
                </div>
              </section>
            )}

            {/* 2. Hall of Fame */}
            {hallOfFameUsers.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-4 h-4 text-[#737373]" strokeWidth={1.75} />
                  <h2 className="text-sm font-semibold text-[#0A0A0A]">
                    Hall of Fame
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hallOfFameUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => onOpenProfile(u.id)}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] transition-colors text-left shadow-xs"
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-black/[0.08] shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                          {getInitials(u.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                            {u.name}
                          </p>
                          <VerifiedBadge
                            username={u.username}
                            isVerified={u.is_verified}
                          />
                        </div>
                        <p className="text-xs text-[#737373] truncate">
                          @{u.username} · CEO and Founder
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* 3. All Users / Matching Users */}
        {showUsers && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#0A0A0A]">
                {isSearching ? 'Users' : 'All Users'}
              </h2>
              <span className="text-xs text-[#737373] tabular-nums">{users.length}</span>
            </div>

            {users.length === 0 ? (
              <div className="py-8 text-center rounded-2xl border border-black/[0.06] bg-[#FAFAFA]">
                <UserIcon className="w-5 h-5 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
                <p className="text-xs text-[#737373]">No users matched your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onOpenProfile(u.id)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] transition-colors text-left"
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover border border-black/[0.08] shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                        {getInitials(u.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-[#0A0A0A] truncate">{u.name}</p>
                        <VerifiedBadge username={u.username} isVerified={u.is_verified} />
                      </div>
                      <p className="text-xs text-[#737373] truncate">@{u.username}</p>
                    </div>
                    {u.username.toLowerCase() === 'subnocte' && (
                      <Pin
                        className="w-3.5 h-3.5 text-[#737373] shrink-0"
                        strokeWidth={1.75}
                        aria-label="Pinned creator"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 4. Photos */}
        {showPhotos && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#0A0A0A]">
                Photos
              </h2>
              <span className="text-xs text-[#737373] tabular-nums">{photos.length}</span>
            </div>

            {photos.length === 0 ? (
              <div className="py-10 text-center rounded-2xl border border-black/[0.06] bg-[#FAFAFA]">
                <p className="text-xs text-[#737373]">No public photos matched your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="group flex flex-col">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenCinema({
                          id: photo.id,
                          title: photo.title,
                          image_url: photo.image_url,
                          subtitle: photo.profiles
                            ? `${photo.profiles.name} · @${photo.profiles.username}`
                            : undefined,
                        })
                      }
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
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
