import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Folder,
  FolderInput,
  Globe,
  Info,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  CinemaPhoto,
  Collection,
  CollectionPrivacy,
  Photo,
  PhotoPrivacy,
  VisibilityLevel,
} from '../types';
import {
  copyTextToClipboard,
  formatDate,
  getCollectionShareUrl,
  getPhotoShareUrl,
  getVisibilityLabel,
} from '../lib/utils';
import { AuthView } from './AuthView';
import { ResilientImage } from './ResilientImage';
import { AddPhotoModal } from './AddPhotoModal';
import { RulesModal } from './RulesModal';
import { LimitedUsersPicker } from './LimitedUsersPicker';
import { ModalPortal } from './ModalPortal';

interface GalleryViewProps {
  currentUserId: string | null;
  onAuthSuccess: () => void;
  onOpenCinema: (photo: CinemaPhoto, collectionItems?: CinemaPhoto[]) => void;
  onOpenPost: (photoId: string) => void;
  onDataChanged: () => void;
  onShowToast?: (msg: string) => void;
  refreshKey: number;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  currentUserId,
  onAuthSuccess,
  onOpenCinema,
  onOpenPost,
  onDataChanged,
  onShowToast,
  refreshKey,
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Filter by tag or date
  const [tagQuery, setTagQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Three-dot menus & action modals
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [colMenuOpenId, setColMenuOpenId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Photo | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState<Photo | null>(null);
  const [moveCollectionId, setMoveCollectionId] = useState<string>('');
  const [photoPrivacyTarget, setPhotoPrivacyTarget] = useState<Photo | null>(null);
  const [photoPrivacyValue, setPhotoPrivacyValue] = useState<PhotoPrivacy>('public');
  const [photoAllowedIds, setPhotoAllowedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);

  // Collection action modals
  const [colRenameTarget, setColRenameTarget] = useState<Collection | null>(null);
  const [colRenameValue, setColRenameValue] = useState('');
  const [colPrivacyTarget, setColPrivacyTarget] = useState<Collection | null>(null);
  const [colPrivacyValue, setColPrivacyValue] = useState<CollectionPrivacy>('public');
  const [colAllowedIds, setColAllowedIds] = useState<string[]>([]);
  const [colDeleteTarget, setColDeleteTarget] = useState<Collection | null>(null);
  const [colDeletePhotosToo, setColDeletePhotosToo] = useState(false);

  const [modalError, setModalError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [addModalState, setAddModalState] = useState<{
    open: boolean;
    collectionId: string;
  }>({ open: false, collectionId: '' });
  const [rulesOpen, setRulesOpen] = useState(false);

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
    const closeMenu = () => {
      setMenuOpenId(null);
      setColMenuOpenId(null);
    };
    if (menuOpenId || colMenuOpenId) {
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [menuOpenId, colMenuOpenId]);

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

  const selectCollection = (collectionId: string | null) => {
    setMenuOpenId(null);
    setColMenuOpenId(null);
    setSelectedCollectionId(collectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        setDeleteTarget(null);
        onDataChanged();
        onShowToast?.('Photo deleted');
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

  const handlePhotoPrivacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPrivacyTarget) return;
    setActionBusy(true);
    setModalError(null);
    try {
      const nextAllowed = photoPrivacyValue === 'limited' ? photoAllowedIds : [];
      let { error } = await supabase
        .from('photos')
        .update({ privacy: photoPrivacyValue, allowed_user_ids: nextAllowed })
        .eq('id', photoPrivacyTarget.id)
        .eq('user_id', currentUserId);

      if (
        error &&
        error.message?.toLowerCase().includes('allowed_user_ids') &&
        photoPrivacyValue !== 'limited'
      ) {
        const retry = await supabase
          .from('photos')
          .update({ privacy: photoPrivacyValue })
          .eq('id', photoPrivacyTarget.id)
          .eq('user_id', currentUserId);
        error = retry.error;
      }

      if (error) {
        setModalError(error.message);
        return;
      }
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoPrivacyTarget.id
            ? { ...p, privacy: photoPrivacyValue, allowed_user_ids: nextAllowed }
            : p
        )
      );
      setPhotoPrivacyTarget(null);
      onDataChanged();
      onShowToast?.(`Photo set to ${getVisibilityLabel(photoPrivacyValue)}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleColRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colRenameTarget || !colRenameValue.trim()) return;
    setActionBusy(true);
    setModalError(null);
    try {
      const nextName = colRenameValue.trim();
      const { error } = await supabase
        .from('collections')
        .update({ name: nextName })
        .eq('id', colRenameTarget.id)
        .eq('user_id', currentUserId);
      if (error) {
        setModalError(error.message);
        return;
      }
      setCollections((prev) =>
        prev.map((c) => (c.id === colRenameTarget.id ? { ...c, name: nextName } : c))
      );
      setColRenameTarget(null);
      onDataChanged();
    } finally {
      setActionBusy(false);
    }
  };

  const handleColPrivacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colPrivacyTarget) return;
    setActionBusy(true);
    setModalError(null);
    try {
      const nextAllowed = colPrivacyValue === 'limited' ? colAllowedIds : [];
      let { error } = await supabase
        .from('collections')
        .update({ privacy: colPrivacyValue, allowed_user_ids: nextAllowed })
        .eq('id', colPrivacyTarget.id)
        .eq('user_id', currentUserId);

      if (
        error &&
        error.message?.toLowerCase().includes('allowed_user_ids') &&
        colPrivacyValue !== 'limited'
      ) {
        const retry = await supabase
          .from('collections')
          .update({ privacy: colPrivacyValue })
          .eq('id', colPrivacyTarget.id)
          .eq('user_id', currentUserId);
        error = retry.error;
      }

      if (error) {
        setModalError(error.message);
        return;
      }
      setCollections((prev) =>
        prev.map((c) =>
          c.id === colPrivacyTarget.id
            ? { ...c, privacy: colPrivacyValue, allowed_user_ids: nextAllowed }
            : c
        )
      );
      setColPrivacyTarget(null);
      onDataChanged();
      onShowToast?.(`Collection set to ${getVisibilityLabel(colPrivacyValue)}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteCollection = async (col: Collection) => {
    if (!currentUserId) return;
    setActionBusy(true);
    setModalError(null);
    try {
      const insidePhotos = photos.filter((p) => p.collection_id === col.id);

      if (colDeletePhotosToo && insidePhotos.length > 0) {
        const storagePaths = insidePhotos
          .map((p) => p.storage_path)
          .filter((p): p is string => Boolean(p));
        if (storagePaths.length > 0) {
          await supabase.storage.from('photos').remove(storagePaths);
        }

        const { error: photosDelErr } = await supabase
          .from('photos')
          .delete()
          .eq('collection_id', col.id)
          .eq('user_id', currentUserId);
        if (photosDelErr) {
          setModalError(photosDelErr.message);
          return;
        }
      } else if (insidePhotos.length > 0) {
        const { error: unlinkErr } = await supabase
          .from('photos')
          .update({ collection_id: null })
          .eq('collection_id', col.id)
          .eq('user_id', currentUserId);
        if (unlinkErr) {
          setModalError(unlinkErr.message);
          return;
        }
      }

      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', col.id)
        .eq('user_id', currentUserId);

      if (error) {
        setModalError(error.message);
        return;
      }

      setCollections((prev) => prev.filter((c) => c.id !== col.id));
      if (colDeletePhotosToo) {
        setPhotos((prev) => prev.filter((p) => p.collection_id !== col.id));
      } else {
        setPhotos((prev) =>
          prev.map((p) => (p.collection_id === col.id ? { ...p, collection_id: null } : p))
        );
      }

      if (selectedCollectionId === col.id) {
        selectCollection(null);
      }
      setColDeleteTarget(null);
      onDataChanged();
      onShowToast?.(
        colDeletePhotosToo ? 'Collection and its photos deleted' : 'Collection deleted'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyPhotoLink = async (photo: Photo) => {
    const ok = await copyTextToClipboard(getPhotoShareUrl(photo.id));
    setMenuOpenId(null);
    if (ok) {
      onShowToast?.('Photo link copied');
    }
  };

  const handleCopyCollectionLink = async (col: Collection) => {
    const ok = await copyTextToClipboard(getCollectionShareUrl(col.id));
    setColMenuOpenId(null);
    if (ok) {
      onShowToast?.('Collection link copied');
    }
  };

  const renderPrivacyIcon = (privacy?: VisibilityLevel) => {
    if (privacy === 'private') return <Lock className="w-3 h-3" strokeWidth={1.75} />;
    if (privacy === 'unlisted') return <Link2 className="w-3 h-3" strokeWidth={1.75} />;
    if (privacy === 'followers') return <Users className="w-3 h-3" strokeWidth={1.75} />;
    if (privacy === 'limited') return <UserCheck className="w-3 h-3" strokeWidth={1.75} />;
    return <Globe className="w-3 h-3" strokeWidth={1.75} />;
  };

  const toCinemaPhoto = (photo: Photo): CinemaPhoto => ({
    id: photo.id,
    title: photo.title,
    image_url: photo.image_url,
    subtitle: `${getVisibilityLabel(photo.privacy)} · ${formatDate(
      photo.photo_date || photo.created_at
    )}`,
  });

  const renderPhotoCard = (photo: Photo, idx: number, swipeList?: Photo[]) => {
    const isMenuOpen = menuOpenId === photo.id;
    const isLeftColumnMobile = idx % 2 === 0;
    return (
      <div key={photo.id} className="group relative">
        {/* Click photo -> Cinema experience */}
        <button
          type="button"
          onClick={() =>
            onOpenCinema(
              toCinemaPhoto(photo),
              swipeList ? swipeList.map(toCinemaPhoto) : undefined
            )
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
            setColMenuOpenId(null);
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
            className={`absolute top-12 ${
              isLeftColumnMobile ? 'left-2.5 sm:left-auto sm:right-2.5' : 'right-2.5'
            } z-20 w-52 max-w-[calc(100vw-2rem)] bg-white border border-black/[0.1] rounded-2xl shadow-xl p-1.5 space-y-0.5 animate-popover-in`}
          >
            <button
              type="button"
              onClick={() => handleCopyPhotoLink(photo)}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpenId(null);
                setModalError(null);
                setPhotoPrivacyTarget(photo);
                setPhotoPrivacyValue(photo.privacy);
                setPhotoAllowedIds(
                  Array.isArray(photo.allowed_user_ids) ? photo.allowed_user_ids : []
                );
              }}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
            >
              {renderPrivacyIcon(photo.privacy)}
              <span>Change Privacy</span>
            </button>

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
              onClick={() => {
                setMenuOpenId(null);
                setDeleteTarget(photo);
              }}
              disabled={actionBusy}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        )}

        {/* Clean unboxed metadata (clicking name opens Post Page) */}
        <div className="mt-2 px-0.5">
          <button
            type="button"
            onClick={() => onOpenPost(photo.id)}
            className="block w-full text-left focus-visible:outline-2 focus-visible:outline-black rounded"
          >
            <p className="text-xs font-medium text-[#0A0A0A] truncate hover:underline">
              {photo.title}
            </p>
          </button>
          <p className="text-[11px] text-[#737373] truncate tabular-nums">
            {getVisibilityLabel(photo.privacy)} ·{' '}
            {formatDate(photo.photo_date || photo.created_at)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div key={selectedCollectionId || 'overview'} className="animate-tab-panel">
      {/* Header */}
      <div className="mb-6">
        {selectedCollectionId && activeCollection ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => selectCollection(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                <span>Go Back</span>
              </button>

              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAddModalState({ open: true, collectionId: activeCollection.id })
                  }
                  aria-label="Add photo"
                  title="Add photo"
                  className="min-h-[40px] min-w-[40px] p-2.5 rounded-xl bg-[#0A0A0A] hover:bg-black/85 text-white inline-flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(null);
                    setColMenuOpenId(
                      colMenuOpenId === activeCollection.id ? null : activeCollection.id
                    );
                  }}
                  aria-label={`Collection options for ${activeCollection.name}`}
                  title="Collection options"
                  className="min-h-[40px] min-w-[40px] p-2.5 rounded-xl border border-black/[0.1] bg-white hover:bg-[#F5F5F7] text-[#0A0A0A] inline-flex items-center justify-center transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {colMenuOpenId === activeCollection.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-12 right-0 z-20 w-52 bg-white border border-black/[0.1] rounded-2xl shadow-xl p-1.5 space-y-0.5 animate-popover-in"
                  >
                    <button
                      type="button"
                      onClick={() => handleCopyCollectionLink(activeCollection)}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setColMenuOpenId(null);
                        setModalError(null);
                        setColPrivacyTarget(activeCollection);
                        setColPrivacyValue(activeCollection.privacy || 'public');
                        setColAllowedIds(
                          Array.isArray(activeCollection.allowed_user_ids)
                            ? activeCollection.allowed_user_ids
                            : []
                        );
                      }}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
                    >
                      {renderPrivacyIcon(activeCollection.privacy || 'public')}
                      <span>Change Privacy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setColMenuOpenId(null);
                        setModalError(null);
                        setColRenameTarget(activeCollection);
                        setColRenameValue(activeCollection.name);
                      }}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Rename Collection</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setColMenuOpenId(null);
                        setModalError(null);
                        setColDeletePhotosToo(false);
                        setColDeleteTarget(activeCollection);
                      }}
                      disabled={actionBusy}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Collection</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
                {activeCollection.name}
              </h1>
              <p className="text-xs text-[#737373] mt-1 tabular-nums">
                {getVisibilityLabel(activeCollection.privacy || 'public')} ·{' '}
                {collectionPhotos.length}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
              Gallery
            </h1>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              aria-label="Open StartOrigin rules"
              title="Rules"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] text-[#0A0A0A] transition-colors"
            >
              <Info className="w-4 h-4" strokeWidth={1.75} />
            </button>
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
            placeholder="Search..."
            className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
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
              className="w-full min-h-[44px] pl-10 pr-3 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-xs transition-colors"
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
            {collectionPhotos.map((photo, idx) =>
              renderPhotoCard(photo, idx, collectionPhotos)
            )}
          </div>
        )
      ) : (
        /* Gallery Overview: Unsorted First, then Collections sorted by Relevancy */
        <div className="space-y-12">
          {/* 1. Unsorted Photos */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-baseline gap-2.5 min-w-0">
                <h2 className="text-base font-semibold text-[#0A0A0A]">Unsorted Photos</h2>
                <span className="text-xs text-[#737373] tabular-nums">
                  {unsortedPhotos.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAddModalState({ open: true, collectionId: '' })}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0A0A0A] hover:bg-black/85 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Add Photo</span>
              </button>
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
                {unsortedPhotos.map((photo, idx) =>
                  renderPhotoCard(photo, idx, unsortedPhotos)
                )}
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
                  const isColMenuOpen = colMenuOpenId === col.id;
                  const colPrivacy = col.privacy || 'public';
                  return (
                    <div
                      key={col.id}
                      className="group relative p-3.5 rounded-3xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => selectCollection(col.id)}
                        className="block w-full text-left"
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

                      {/* Three-dot collection button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          setColMenuOpenId(isColMenuOpen ? null : col.id);
                        }}
                        aria-label={`Collection options for ${col.name}`}
                        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-black/[0.08] text-[#0A0A0A] flex items-center justify-center shadow-xs hover:bg-white transition-colors z-10"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {isColMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-15 right-5 z-20 w-52 bg-white border border-black/[0.1] rounded-2xl shadow-xl p-1.5 space-y-0.5 animate-popover-in"
                        >
                          <button
                            type="button"
                            onClick={() => handleCopyCollectionLink(col)}
                            className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setColMenuOpenId(null);
                              setModalError(null);
                              setColPrivacyTarget(col);
                              setColPrivacyValue(colPrivacy);
                              setColAllowedIds(
                                Array.isArray(col.allowed_user_ids)
                                  ? col.allowed_user_ids
                                  : []
                              );
                            }}
                            className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
                          >
                            {renderPrivacyIcon(colPrivacy)}
                            <span>Change Privacy</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setColMenuOpenId(null);
                              setModalError(null);
                              setColRenameTarget(col);
                              setColRenameValue(col.name);
                            }}
                            className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] flex items-center gap-2.5 text-left"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Rename Collection</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setColMenuOpenId(null);
                              setModalError(null);
                              setColDeletePhotosToo(false);
                              setColDeleteTarget(col);
                            }}
                            disabled={actionBusy}
                            className="w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Collection</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => selectCollection(col.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <h3 className="text-sm font-semibold text-[#0A0A0A] truncate">
                            {col.name}
                          </h3>
                          <p className="text-[11px] text-[#737373] inline-flex items-center gap-1.5 mt-0.5 tabular-nums">
                            {renderPrivacyIcon(colPrivacy)}
                            <span>{getVisibilityLabel(colPrivacy)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{colPhotos.length}</span>
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddModalState({ open: true, collectionId: col.id });
                          }}
                          aria-label={`Add photo to ${col.name}`}
                          title="Add photo"
                          className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white border border-black/[0.1] hover:bg-[#0A0A0A] hover:text-white hover:border-[#0A0A0A] text-[#0A0A0A] inline-flex items-center justify-center transition-colors shrink-0"
                        >
                          <Plus className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete photo"
          onClick={() => !actionBusy && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-[#0A0A0A]">Are you sure?</h2>
              <p className="text-xs text-[#737373] leading-relaxed">
                This action can&apos;t be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setDeleteTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleDeletePhoto(deleteTarget)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-40"
              >
                {actionBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setRenameTarget(null)}
        >
          <form
            onSubmit={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">Rename Photo</h2>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
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
        </ModalPortal>
      )}

      {/* Move to Collection Modal */}
      {moveTarget && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setMoveTarget(null)}
        >
          <form
            onSubmit={handleMoveSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">
              Move &ldquo;{moveTarget.title}&rdquo;
            </h2>
            <select
              value={moveCollectionId}
              onChange={(e) => setMoveCollectionId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
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
        </ModalPortal>
      )}

      {/* Photo Privacy Modal */}
      {photoPrivacyTarget && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setPhotoPrivacyTarget(null)}
        >
          <form
            onSubmit={handlePhotoPrivacySubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">
              Privacy for &ldquo;{photoPrivacyTarget.title}&rdquo;
            </h2>
            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {modalError}
              </div>
            )}
            <div className="space-y-2">
              {(
                [
                  {
                    value: 'public',
                    label: 'Public',
                    desc: 'Shown in Feed, Search, and Profile',
                  },
                  {
                    value: 'followers',
                    label: 'Followers',
                    desc: 'Visible only to your followers',
                  },
                  {
                    value: 'limited',
                    label: 'Limited',
                    desc: 'Visible only to chosen StartOrigin users',
                  },
                  {
                    value: 'unlisted',
                    label: 'By Link',
                    desc: 'Hidden from feeds; viewable only with copied link',
                  },
                  {
                    value: 'private',
                    label: 'Private',
                    desc: 'Only visible to you in Gallery',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPhotoPrivacyValue(opt.value)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                    photoPrivacyValue === opt.value
                      ? 'border-[#0A0A0A] bg-[#F5F5F7]'
                      : 'border-black/[0.08] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A]">{opt.label}</p>
                    <p className="text-[11px] text-[#737373] mt-0.5">{opt.desc}</p>
                  </div>
                  {photoPrivacyValue === opt.value && (
                    <Check className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {photoPrivacyValue === 'limited' && (
              <LimitedUsersPicker
                compact
                currentUserId={currentUserId}
                selectedUserIds={photoAllowedIds}
                onChange={setPhotoAllowedIds}
              />
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPhotoPrivacyTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40"
              >
                {actionBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Collection Rename Modal */}
      {colRenameTarget && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setColRenameTarget(null)}
        >
          <form
            onSubmit={handleColRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">Rename Collection</h2>
            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {modalError}
              </div>
            )}
            <input
              type="text"
              value={colRenameValue}
              onChange={(e) => setColRenameValue(e.target.value)}
              autoFocus
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setColRenameTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy || !colRenameValue.trim()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Collection Privacy Modal */}
      {colPrivacyTarget && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setColPrivacyTarget(null)}
        >
          <form
            onSubmit={handleColPrivacySubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
          >
            <h2 className="text-base font-semibold text-[#0A0A0A]">
              Privacy for &ldquo;{colPrivacyTarget.name}&rdquo;
            </h2>
            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {modalError}
              </div>
            )}
            <div className="space-y-2">
              {(
                [
                  {
                    value: 'public',
                    label: 'Public',
                    desc: 'Visible on Profile & linked from public photo pages',
                  },
                  {
                    value: 'followers',
                    label: 'Followers',
                    desc: 'Visible only to your followers (even with shared link)',
                  },
                  {
                    value: 'limited',
                    label: 'Limited',
                    desc: 'Visible only to chosen StartOrigin users',
                  },
                  {
                    value: 'unlisted',
                    label: 'By Link',
                    desc: 'Hidden from Profile & photo pages; viewable only via link',
                  },
                  {
                    value: 'private',
                    label: 'Private',
                    desc: 'Only visible to you in Gallery',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColPrivacyValue(opt.value)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                    colPrivacyValue === opt.value
                      ? 'border-[#0A0A0A] bg-[#F5F5F7]'
                      : 'border-black/[0.08] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A]">{opt.label}</p>
                    <p className="text-[11px] text-[#737373] mt-0.5">{opt.desc}</p>
                  </div>
                  {colPrivacyValue === opt.value && (
                    <Check className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {colPrivacyValue === 'limited' && (
              <LimitedUsersPicker
                compact
                currentUserId={currentUserId}
                selectedUserIds={colAllowedIds}
                onChange={setColAllowedIds}
              />
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setColPrivacyTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40"
              >
                {actionBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Collection Delete Confirmation Modal */}
      {colDeleteTarget && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete collection"
            onClick={() => !actionBusy && setColDeleteTarget(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-pop"
            >
              <div className="space-y-1.5">
                <h2 className="text-base font-semibold text-[#0A0A0A]">Are you sure?</h2>
                <p className="text-xs text-[#737373] leading-relaxed">
                  Deleting &ldquo;{colDeleteTarget.name}&rdquo; can&apos;t be undone.
                </p>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {modalError}
                </div>
              )}

              {(() => {
                const count = photos.filter((p) => p.collection_id === colDeleteTarget.id).length;
                if (count === 0) return null;
                return (
                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#FAFAFA] border border-black/[0.08] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colDeletePhotosToo}
                      onChange={(e) => setColDeletePhotosToo(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-[#0A0A0A]"
                    />
                    <span className="text-xs leading-snug">
                      <span className="font-medium text-[#0A0A0A] block">
                        Also delete {count} {count === 1 ? 'photo' : 'photos'} inside
                      </span>
                      <span className="text-[11px] text-[#737373]">
                        {colDeletePhotosToo
                          ? 'Photos inside will be permanently deleted.'
                          : 'Leave unchecked to move photos to Unsorted.'}
                      </span>
                    </span>
                  </label>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setColDeleteTarget(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleDeleteCollection(colDeleteTarget)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-40"
                >
                  {actionBusy ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add Photo to Unsorted or Collection Modal */}
      {currentUserId && (
        <AddPhotoModal
          isOpen={addModalState.open}
          currentUserId={currentUserId}
          collections={collections}
          defaultCollectionId={addModalState.collectionId}
          onClose={() => setAddModalState((prev) => ({ ...prev, open: false }))}
          onSuccess={(count, destinationLabel) => {
            loadGallery();
            onDataChanged();
            onShowToast?.(
              `${count} ${count === 1 ? 'photo' : 'photos'} uploaded ${destinationLabel}.`
            );
          }}
        />
      )}
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
};
