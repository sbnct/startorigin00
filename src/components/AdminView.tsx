import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { CinemaPhoto, PhotoWithAuthor } from '../types';
import { formatDate, getInitials } from '../lib/utils';
import { ResilientImage } from './ResilientImage';
import { VerifiedBadge } from './VerifiedBadge';

interface AdminViewProps {
  onExitAdmin: () => void;
  onOpenCinema: (photo: CinemaPhoto) => void;
}

const ADMIN_TOKEN_STORAGE_KEY = 'startorigin_admin_token';

export const AdminView: React.FC<AdminViewProps> = ({
  onExitAdmin,
  onOpenCinema,
}) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [photos, setPhotos] = useState<PhotoWithAuthor[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearToken = useCallback(() => {
    setToken(null);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    if (!token) return;
    setLoadingPhotos(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/photos', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        clearToken();
        setAuthError('Session expired. Enter admin password again.');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load posts.');
        return;
      }
      setPhotos((data.photos as PhotoWithAuthor[]) || []);
    } catch {
      setError('Network error while loading posts.');
    } finally {
      setLoadingPhotos(false);
    }
  }, [token, clearToken]);

  useEffect(() => {
    if (token) {
      loadPhotos();
    }
  }, [token, loadPhotos]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!password) {
      setAuthError('Enter the admin password.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Invalid password.');
        return;
      }
      setToken(data.token);
      setPassword('');
      try {
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
      } catch {
        // ignore
      }
    } catch {
      setAuthError('Unable to reach server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeletePost = async (photo: PhotoWithAuthor) => {
    if (!token) return;
    setDeletingId(photo.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        clearToken();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete post.');
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setConfirmDeleteId(null);
      setNotice(`Deleted "${photo.title}".`);
    } catch {
      setError('Network error while deleting post.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPhotos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return photos;
    return photos.filter((p) => {
      const titleMatch = p.title.toLowerCase().includes(q);
      const userMatch = (p.profiles?.username || '').toLowerCase().includes(q);
      const nameMatch = (p.profiles?.name || '').toLowerCase().includes(q);
      return titleMatch || userMatch || nameMatch;
    });
  }, [photos, query]);

  if (!token) {
    return (
      <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={onExitAdmin}
            className="min-h-[40px] px-3.5 py-2 mb-6 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to StartOrigin</span>
          </button>

          <form
            onSubmit={handleLogin}
            className="bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[#0A0A0A]">
                  Admin
                </h1>
                <p className="text-xs text-[#737373]">StartOrigin Moderation</p>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors disabled:opacity-50"
            >
              {authLoading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                Admin Panel
              </h1>
              <p className="text-xs text-[#737373] tabular-nums">
                {photos.length} total {photos.length === 1 ? 'post' : 'posts'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadPhotos}
              aria-label="Refresh posts"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingPhotos ? 'animate-spin' : ''}`}
                strokeWidth={1.75}
              />
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </button>

            <button
              type="button"
              onClick={clearToken}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative my-6">
          <Search
            className="w-4 h-4 text-[#737373] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter posts by title or @username..."
            className="w-full min-h-[44px] pl-11 pr-10 py-2.5 rounded-2xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear filter"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full hover:bg-black/[0.06] absolute right-2 top-1/2 -translate-y-1/2 text-[#737373]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {notice && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.08] text-xs font-medium text-[#0A0A0A]">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {loadingPhotos && photos.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-[#F5F5F7]" />
            ))}
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
            <p className="text-xs text-[#737373]">No posts found.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06] border border-black/[0.08] rounded-3xl bg-white overflow-hidden">
            {filteredPhotos.map((photo) => {
              const author = photo.profiles;
              const isConfirming = confirmDeleteId === photo.id;
              const isDeleting = deletingId === photo.id;

              return (
                <div
                  key={photo.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenCinema({
                          id: photo.id,
                          title: photo.title,
                          image_url: photo.image_url,
                          subtitle: author
                            ? `${author.name} · @${author.username}`
                            : undefined,
                        })
                      }
                      className="shrink-0 rounded-xl overflow-hidden focus-visible:outline-2 focus-visible:outline-black"
                    >
                      <ResilientImage
                        src={photo.image_url}
                        alt={photo.title}
                        containerClassName="w-16 h-16 rounded-xl border border-black/[0.08]"
                        className="w-full h-full object-cover"
                      />
                    </button>

                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-[#0A0A0A] truncate">
                        {photo.title}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#737373]">
                        {author ? (
                          <span className="inline-flex items-center gap-1 text-[#0A0A0A] font-medium">
                            {author.avatar_url ? (
                              <img
                                src={author.avatar_url}
                                alt={author.name}
                                referrerPolicy="no-referrer"
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-[#0A0A0A] text-white text-[8px] flex items-center justify-center">
                                {getInitials(author.name)}
                              </span>
                            )}
                            <span>{author.name}</span>
                            <VerifiedBadge
                              username={author.username}
                              isVerified={author.is_verified}
                            />
                            <span className="text-[#737373] font-normal">
                              @{author.username}
                            </span>
                          </span>
                        ) : (
                          <span>Unknown user</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{photo.privacy}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {formatDate(photo.photo_date || photo.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isDeleting}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(photo)}
                          disabled={isDeleting}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
                        >
                          {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(photo.id)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
