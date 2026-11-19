import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Folder,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CinemaPhoto, Collection, Photo } from '../types';
import { formatDate } from '../lib/utils';
import { AuthView } from './AuthView';
import { ResilientImage } from './ResilientImage';

interface GalleryViewProps {
  currentUserId: string | null;
  onAuthSuccess: () => void;
  onOpenCinema: (photo: CinemaPhoto) => void;
  onDataChanged: () => void;
  refreshKey: number;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  currentUserId,
  onAuthSuccess,
  onOpenCinema,
  onDataChanged,
  refreshKey,
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Filter by tag or date
  const [tagQuery, setTagQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Three-dot menu & action modals
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Photo | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState<Photo | null>(null);
  const [moveCollectionId, setMoveCollectionId] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadGallery = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [{ data: photosData }, { data: collectionsData }] = await Promise.all([
        supabase
          .from('photos')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false }),
        supabase
          .from('collections')
          .select('*')
          .eq('user_id', currentUserId)
          .order('updated_at', { ascending: false }),
      ]);

      setPhotos((photosData as Photo[]) || []);
      setCollections((collectionsData as Collection[]) || []);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery, refreshKey]);

  useEffect(() => {
    const closeMenu = () => setMenuOpenId(null);
    if (menuOpenId) {
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [menuOpenId]);

  const filteredPhotos = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    return photos.filter((p) => {
      const matchesDate = dateFilter
        ? (p.photo_date || p.created_at.slice(0, 10)).startsWith(dateFilter)
        : true;
      if (!matchesDate) return false;
      if (!q) return true;
      const inTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
      const inTitle = p.title.toLowerCase().includes(q);
      return inTags || inTitle;
    });
  }, [photos, tagQuery, dateFilter]);

  const unsortedPhotos = useMemo(
    () => filteredPhotos.filter((p) => !p.collection_id),
    [filteredPhotos]
  );

  // Collections sorted by relevancy (search match + recency + photo count)
  const sortedCollections = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    return [...collections]
      .map((col) => {
        const colPhotos = photos.filter((p) => p.collection_id === col.id);
        const matchingColPhotos = filteredPhotos.filter((p) => p.collection_id === col.id);
        let relevancy = colPhotos.length * 2;
        if (q && col.name.toLowerCase().includes(q)) relevancy += 50;
        if (q || dateFilter) relevancy += matchingColPhotos.length * 15;
        const recencyDays =
          (Date.now() - new Date(col.updated_at || col.created_at).getTime()) /
          (1000 * 60 * 60 * 24);
        relevancy += Math.max(0, 30 - recencyDays);
        return { col, colPhotos, matchingColPhotos, relevancy };
      })
      .sort((a, b) => b.relevancy - a.relevancy);
  }, [collections, photos, filteredPhotos, tagQuery, dateFilter]);

  if (!currentUserId) {
    return (
      <AuthView
        embedded
        onSuccess={onAuthSuccess}
        subtitle="Sign in to access your private and public photo gallery."
      />
    );
  }

  const activeCollection = collections.find((c) => c.id === selectedCollectionId) || null;
  const collectionPhotos = selectedCollectionId
    ? filteredPhotos.filter((p) => p.collection_id === selectedCollectionId)
    : [];

  const handleDeletePhoto = async (photo: Photo) => {
    setActionBusy(true);
    try {
      if (photo.storage_path) {
        await supabase.storage.from('photos').remove([photo.storage_path]);
      }
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id)
        .eq('user_id', currentUserId);
      if (!error) {
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        onDataChanged();
      }
    } finally {
      setActionBusy(false);
      setMenuOpenId(null);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    setActionBusy(true);
    try {
      const nextTitle = renameValue.trim();
      const { error } = await supabase
        .from('photos')
        .update({ title: nextTitle })
        .eq('id', renameTarget.id)
        .eq('user_id', currentUserId);
      if (!error) {
        setPhotos((prev) =>
          prev.map((p) => (p.id === renameTarget.id ? { ...p, title: nextTitle } : p))
        );
        setRenameTarget(null);
        onDataChanged();
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;
    setActionBusy(true);
    try {
      const nextColId = moveCollectionId || null;
      const { error } = await supabase
        .from('photos')
        .update({ collection_id: nextColId })
        .eq('id', moveTarget.id)
        .eq('user_id', currentUserId);
      if (!error) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === moveTarget.id ? { ...p, collection_id: nextColId } : p
          )
        );
        setMoveTarget(null);
        onDataChanged();
      }
    } finally {
      setActionBusy(false);
    }
  };

  const renderPhotoCard = (photo: Photo) => {
    const isMenuOpen = menuOpenId === photo.id;
    return (
      <div key={photo.id} className="group relative">
        {/* Click photo -> Cinema experience */}
        <button
          type="button"
          onClick={() =>
            onOpenCinema({
              id: photo.id,
              title: photo.title,
              image_url: photo.image_url,
              subtitle: `${photo.privacy === 'private' ? 'Private' : 'Public'} · ${formatDate(
                photo.photo_date || photo.created_at
              )}`,
            })
          }
          className="block w-full text-left rounded-2xl overflow-hidden focus-visible:outline-2 focus-visible:outline-black"
        >
          <ResilientImage
            src={photo.image_url}
            alt={photo.title}
            containerClassName="aspect-square rounded-2xl border border-black/[0.06]"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </button>

        {/* Three-dot action button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenId(isMenuOpen ? null : photo.id);
          }}
          aria-label={`Photo options for ${photo.title}`}
          className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-black/[0.08] text-[#0A0A0A] flex items-center justify-center shadow-xs hover:bg-white transition-colors z-10"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Three-dot popover menu */}
        {isMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-12 right-2.5 z-20 w-48 bg-white border border-black/[0.1] rounded-2xl shadow-xl p-1.5 space-y-0.5"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpenId(null);
                setRenameTarget(photo);
                setRenameValue(photo.title);
              }}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Rename</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpenId(null);
                setMoveTarget(photo);
                setMoveCollectionId(photo.collection_id || '');
              }}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
            >
              <FolderInput className="w-3.5 h-3.5" />
              <span>Move to Collection</span>
            </button>

            <button
              type="button"
              onClick={() => handleDeletePhoto(photo)}
              disabled={actionBusy}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        )}

        {/* Clean unboxed metadata */}
        <div className="mt-2 px-0.5">
          <p className="text-xs font-medium text-[#0A0A0A] truncate">{photo.title}</p>
          <p className="text-[11px] text-[#737373] truncate tabular-nums">
            {photo.privacy === 'private' ? 'Private' : 'Public'} ·{' '}
            {formatDate(photo.photo_date || photo.created_at)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        {selectedCollectionId && activeCollection ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelectedCollectionId(null)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              <span>Go Back</span>
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
                {activeCollection.name}
              </h1>
              <p className="text-xs text-[#737373] mt-1 tabular-nums">
                {collectionPhotos.length}{' '}
                {collectionPhotos.length === 1 ? 'photo' : 'photos'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
              Gallery
            </h1>
          </div>
        )}
      </div>

      {/* Filter Bar (Tag & Date) */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Filter by tag or name..."
            className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
          />
          {tagQuery && (
            <button
              type="button"
              onClick={() => setTagQuery('')}
              aria-label="Clear tag filter"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full hover:bg-black/[0.06] absolute right-1.5 top-1/2 -translate-y-1/2 text-[#737373]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Calendar
              className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
              className="w-full min-h-[44px] pl-10 pr-3 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-xs transition-colors"
            />
          </div>
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="min-h-[44px] px-3 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-[#F5F5F7]" />
          ))}
        </div>
      ) : selectedCollectionId ? (
        /* Collection Detail Grid */
        collectionPhotos.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
            <p className="text-xs text-[#737373]">
              No photos in this collection match your current filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collectionPhotos.map(renderPhotoCard)}
          </div>
        )
      ) : (
        /* Gallery Overview: Unsorted First, then Collections sorted by Relevancy */
        <div className="space-y-12">
          {/* 1. Unsorted Photos */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-semibold text-[#0A0A0A]">Unsorted Photos</h2>
              <span className="text-xs text-[#737373] tabular-nums">
                {unsortedPhotos.length}{' '}
                {unsortedPhotos.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>

            {unsortedPhotos.length === 0 ? (
              <div className="py-10 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
                <p className="text-xs text-[#737373]">
                  {tagQuery || dateFilter
                    ? 'No unsorted photos match your filter.'
                    : 'No unsorted photos yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {unsortedPhotos.map(renderPhotoCard)}
              </div>
            )}
          </section>

          {/* 2. Collections Sorted by Relevancy */}
          <section className="pt-8 border-t border-black/[0.08]">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-semibold text-[#0A0A0A]">Collections</h2>
              <span className="text-xs text-[#737373] tabular-nums">
                {sortedCollections.length}
              </span>
            </div>

            {sortedCollections.length === 0 ? (
              <div className="py-12 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA]">
                <Folder className="w-6 h-6 mx-auto text-[#737373] mb-2" strokeWidth={1.5} />
                <p className="text-xs text-[#737373]">
                  No collections yet. Create one in the Add tab.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sortedCollections.map(({ col, colPhotos }) => {
                  const previews = colPhotos.slice(0, 4);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setSelectedCollectionId(col.id)}
                      className="group text-left p-3.5 rounded-3xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] transition-colors"
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

                      <div className="flex items-baseline justify-between gap-2 px-1">
                        <h3 className="text-sm font-semibold text-[#0A0A0A] truncate">
                          {col.name}
                        </h3>
                        <span className="text-xs text-[#737373] tabular-nums shrink-0">
                          {colPhotos.length} {colPhotos.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">Rename Photo</h2>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy || !renameValue.trim()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Move to Collection Modal */}
      {moveTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleMoveSubmit}
            className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">
              Move &ldquo;{moveTarget.title}&rdquo;
            </h2>
            <select
              value={moveCollectionId}
              onChange={(e) => setMoveCollectionId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm"
            >
              <option value="">Unsorted (No Collection)</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40"
              >
                Move
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
