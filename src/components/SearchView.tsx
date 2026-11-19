import React, { useEffect, useState } from 'react';
import { Search as SearchIcon, User as UserIcon, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PhotoWithAuthor, Profile } from '../types';
import { formatDate, getInitials } from '../lib/utils';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';

interface SearchViewProps {
  onOpenPost: (photoId: string) => void;
  onOpenProfile: (userId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onOpenPost,
  onOpenProfile,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'photos' | 'users'>('all');
  const [users, setUsers] = useState<Profile[]>([]);
  const [photos, setPhotos] = useState<PhotoWithAuthor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (!trimmed) {
          const [{ data: recentUsers }, { data: recentPhotos }] = await Promise.all([
            supabase
              .from('profiles')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(12),
            supabase
              .from('photos')
              .select('*, profiles:user_id (id, name, username, avatar_url)')
              .eq('privacy', 'public')
              .order('created_at', { ascending: false })
              .limit(18),
          ]);
          setUsers((recentUsers as Profile[]) || []);
          setPhotos((recentPhotos as PhotoWithAuthor[]) || []);
          return;
        }

        const pattern = `%${trimmed}%`;
        const [{ data: matchedUsers }, { data: matchedPhotos }] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .or(`name.ilike.${pattern},username.ilike.${pattern}`)
            .limit(24),
          supabase
            .from('photos')
            .select('*, profiles:user_id (id, name, username, avatar_url)')
            .eq('privacy', 'public')
            .ilike('title', pattern)
            .order('created_at', { ascending: false })
            .limit(36),
        ]);

        setUsers((matchedUsers as Profile[]) || []);
        setPhotos((matchedPhotos as PhotoWithAuthor[]) || []);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

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
          placeholder="Search users or photos by name..."
          className="w-full min-h-[48px] pl-11 pr-11 py-3 rounded-2xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
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
      <div className="inline-flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-xl mb-8">
        {(['all', 'photos', 'users'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setScope(tab)}
            className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all whitespace-nowrap ${
              scope === tab
                ? 'bg-white text-[#0A0A0A] shadow-xs'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-xs text-[#737373] mb-6">Searching...</p>
      )}

      {/* Users Results */}
      {showUsers && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">
              {query.trim() ? 'Matching Users' : 'Creators'}
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium text-[#0A0A0A] truncate">{u.name}</p>
                      <VerifiedBadge username={u.username} isVerified={u.is_verified} />
                    </div>
                    <p className="text-xs text-[#737373] truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Photos Results */}
      {showPhotos && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">
              {query.trim() ? 'Matching Photos' : 'Recent Public Photos'}
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
                  <p className="text-[11px] text-[#737373] truncate">
                    {photo.profiles ? `@${photo.profiles.username} · ` : ''}
                    {formatDate(photo.photo_date || photo.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
