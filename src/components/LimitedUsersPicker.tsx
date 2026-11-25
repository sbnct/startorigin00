import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { getInitials } from '../lib/utils';
import { VerifiedBadge } from './VerifiedBadge';

type PickedUser = Pick<Profile, 'id' | 'name' | 'username' | 'avatar_url' | 'is_verified'>;

interface LimitedUsersPickerProps {
  currentUserId: string;
  selectedUserIds: string[];
  onChange: (nextUserIds: string[]) => void;
  compact?: boolean;
}

export const LimitedUsersPicker: React.FC<LimitedUsersPickerProps> = ({
  currentUserId,
  selectedUserIds,
  onChange,
  compact = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [knownProfiles, setKnownProfiles] = useState<Record<string, PickedUser>>({});

  // Resolve any selected IDs that are not yet cached locally
  useEffect(() => {
    const missingIds = selectedUserIds.filter((id) => !knownProfiles[id]);
    if (missingIds.length === 0) return;

    let active = true;
    supabase
      .from('profiles')
      .select('id, name, username, avatar_url')
      .in('id', missingIds)
      .then(({ data }) => {
        if (!active || !data) return;
        setKnownProfiles((prev) => {
          const next = { ...prev };
          for (const row of data as PickedUser[]) {
            next[row.id] = row;
          }
          return next;
        });
      });

    return () => {
      active = false;
    };
  }, [selectedUserIds, knownProfiles]);

  // Search StartOrigin users by username (or name)
  useEffect(() => {
    const clean = query.trim().replace(/^@/, '');
    if (!clean) {
      setResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const pattern = `%${clean}%`;
        const { data } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .neq('id', currentUserId)
          .or(`username.ilike.${pattern},name.ilike.${pattern}`)
          .limit(10);

        if (!active) return;
        const rows = (data as PickedUser[]) || [];
        setResults(rows);
        if (rows.length > 0) {
          setKnownProfiles((prev) => {
            const next = { ...prev };
            for (const row of rows) {
              next[row.id] = row;
            }
            return next;
          });
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, currentUserId]);

  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  const addUser = (user: PickedUser) => {
    setKnownProfiles((prev) => ({ ...prev, [user.id]: user }));
    if (!selectedSet.has(user.id)) {
      onChange([...selectedUserIds, user.id]);
    }
  };

  const removeUser = (userId: string) => {
    onChange(selectedUserIds.filter((id) => id !== userId));
  };

  return (
    <div
      className={`rounded-2xl border border-black/[0.08] bg-[#FAFAFA] ${
        compact ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#0A0A0A]">
          Chosen Users
        </span>
        <span className="text-[11px] text-[#737373] tabular-nums">
          {selectedUserIds.length}{' '}
          {selectedUserIds.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Selected users list */}
      {selectedUserIds.length === 0 ? (
        <p className="text-[11px] text-[#737373]">
          Search @username across StartOrigin to choose who can view this.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selectedUserIds.map((uid) => {
            const u = knownProfiles[uid];
            return (
              <div
                key={uid}
                className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-xl bg-white border border-black/[0.1] text-xs text-[#0A0A0A]"
              >
                {u?.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.name}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-[#0A0A0A] text-white text-[8px] font-medium flex items-center justify-center shrink-0">
                    {getInitials(u?.name || 'SO')}
                  </span>
                )}
                <span className="text-[11px] font-medium truncate max-w-[140px]">
                  @{u?.username || uid.slice(0, 6)}
                </span>
                <button
                  type="button"
                  onClick={() => removeUser(uid)}
                  aria-label={`Remove @${u?.username || 'user'}`}
                  className="w-5 h-5 rounded-lg hover:bg-black/[0.07] text-[#737373] hover:text-[#0A0A0A] flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search @username..."
          className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl bg-white border border-black/[0.1] focus:border-[#0A0A0A] outline-none text-base md:text-xs transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear user search"
            className="w-6 h-6 rounded-full hover:bg-black/[0.06] text-[#737373] flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search results */}
      {query.trim() && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-black/[0.08] bg-white divide-y divide-black/[0.05]">
          {searching ? (
            <p className="px-3 py-2.5 text-[11px] text-[#737373]">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-[11px] text-[#737373]">
              No matching users found.
            </p>
          ) : (
            results.map((u) => {
              const isAdded = selectedSet.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => (isAdded ? removeUser(u.id) : addUser(u))}
                  className="w-full px-3 py-2 flex items-center justify-between gap-2.5 hover:bg-[#F5F5F7] text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-full object-cover border border-black/[0.08] shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-[#0A0A0A] text-white text-[9px] font-medium flex items-center justify-center shrink-0">
                        {getInitials(u.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-[#0A0A0A] truncate">
                          {u.name}
                        </span>
                        <VerifiedBadge username={u.username} isVerified={u.is_verified} />
                      </div>
                      <p className="text-[11px] text-[#737373] truncate">
                        @{u.username}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 shrink-0 ${
                      isAdded
                        ? 'bg-[#0A0A0A] text-white'
                        : 'bg-[#F5F5F7] text-[#0A0A0A]'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span>Add</span>
                      </>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
