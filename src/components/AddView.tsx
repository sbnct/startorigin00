import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FolderPlus,
  ImagePlus,
  Layers,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Collection, PhotoPrivacy } from '../types';
import { sanitizeFilename } from '../lib/utils';
import { AuthView } from './AuthView';

interface AddViewProps {
  currentUserId: string | null;
  onAuthSuccess: () => void;
  onNavigateGallery: () => void;
  onDataChanged: () => void;
}

interface PendingPhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  privacy: PhotoPrivacy;
  collectionId: string;
  tagsText: string;
}

export const AddView: React.FC<AddViewProps> = ({
  currentUserId,
  onAuthSuccess,
  onNavigateGallery,
  onDataChanged,
}) => {
  const [mode, setMode] = useState<'choose' | 'photo' | 'collection'>('choose');
  const [collections, setCollections] = useState<Collection[]>([]);

  // Add Photo state
  const [items, setItems] = useState<PendingPhotoItem[]>([]);
  const [useUnified, setUseUnified] = useState(true);
  const [unifiedTitle, setUnifiedTitle] = useState('');
  const [unifiedPrivacy, setUnifiedPrivacy] = useState<PhotoPrivacy>('public');
  const [unifiedCollectionId, setUnifiedCollectionId] = useState('');
  const [unifiedTags, setUnifiedTags] = useState('');
  const [fileLimitNotice, setFileLimitNotice] = useState<string | null>(null);

  // Add Collection state
  const [collectionName, setCollectionName] = useState('');

  // Submission & confirmation state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from('collections')
      .select('*')
      .eq('user_id', currentUserId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setCollections((data as Collection[]) || []);
      });
  }, [currentUserId, mode]);

  useEffect(() => {
    return () => {
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
  }, [items]);

  if (!currentUserId) {
    return (
      <AuthView
        embedded
        onSuccess={onAuthSuccess}
        subtitle="Sign in to upload photos or create collections."
      />
    );
  }

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setFileLimitNotice(null);
    setConfirmationMessage(null);
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const remainingSlots = Math.max(0, 10 - items.length);
    if (fileList.length > remainingSlots) {
      setFileLimitNotice(
        `Maximum 10 photos per upload. Added ${remainingSlots} ${
          remainingSlots === 1 ? 'photo' : 'photos'
        }.`
      );
    }

    const accepted = fileList.slice(0, remainingSlots).map((file, index) => {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        title: baseName || `Photo ${items.length + index + 1}`,
        privacy: 'public' as PhotoPrivacy,
        collectionId: '',
        tagsText: '',
      };
    });

    setItems((prev) => [...prev, ...accepted]);
    e.target.value = '';
  };

  const removePendingItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const updatePendingItem = (id: string, patch: Partial<PendingPhotoItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const parseTags = (raw: string): string[] => {
    return raw
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 12);
  };

  const handleUploadPhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationMessage(null);

    if (items.length === 0) {
      setError('Please select at least 1 photo (up to 10).');
      return;
    }

    if (useUnified && !unifiedTitle.trim()) {
      setError('Please enter a photo name in unified settings.');
      return;
    }

    if (!useUnified && items.some((it) => !it.title.trim())) {
      setError('Every photo needs a name.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedRows: {
        user_id: string;
        collection_id: string | null;
        title: string;
        image_url: string;
        storage_path: string;
        privacy: PhotoPrivacy;
        tags: string[];
        photo_date: string;
      }[] = [];

      const today = new Date().toISOString().slice(0, 10);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const safeName = sanitizeFilename(item.file.name || `photo-${i}.jpg`);
        const storagePath = `${currentUserId}/${Date.now()}-${i}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from('photos')
          .upload(storagePath, item.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(
            `Storage upload failed (${uploadErr.message}). Ensure the "photos" bucket and policies from the SQL script are active.`
          );
        }

        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(storagePath);

        const resolvedTitle = useUnified
          ? items.length === 1
            ? unifiedTitle.trim()
            : `${unifiedTitle.trim()} ${i + 1}`
          : item.title.trim();

        const resolvedPrivacy = useUnified ? unifiedPrivacy : item.privacy;
        const resolvedCollectionId = useUnified
          ? unifiedCollectionId || null
          : item.collectionId || null;
        const resolvedTags = parseTags(useUnified ? unifiedTags : item.tagsText);

        uploadedRows.push({
          user_id: currentUserId,
          collection_id: resolvedCollectionId,
          title: resolvedTitle,
          image_url: urlData.publicUrl,
          storage_path: storagePath,
          privacy: resolvedPrivacy,
          tags: resolvedTags,
          photo_date: today,
        });
      }

      const { error: insertErr } = await supabase.from('photos').insert(uploadedRows);
      if (insertErr) {
        throw new Error(insertErr.message);
      }

      // Log activity
      const hasPublic = uploadedRows.some((r) => r.privacy === 'public');
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        actor_id: currentUserId,
        action_type: 'upload',
        description:
          uploadedRows.length === 1
            ? `Uploaded "${uploadedRows[0].title}"`
            : `Uploaded ${uploadedRows.length} photos`,
        is_public: hasPublic,
      });

      const targetCol = collections.find((c) => c.id === unifiedCollectionId);
      const destinationLabel = useUnified
        ? targetCol
          ? `to "${targetCol.name}"`
          : 'to Unsorted'
        : 'to your Gallery';

      setConfirmationMessage(
        `${uploadedRows.length} ${
          uploadedRows.length === 1 ? 'photo' : 'photos'
        } uploaded successfully ${destinationLabel}.`
      );

      // Clear pending items
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      setItems([]);
      setUnifiedTitle('');
      setUnifiedTags('');
      setFileLimitNotice(null);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationMessage(null);

    const trimmed = collectionName.trim();
    if (!trimmed) {
      setError('Please enter a collection name.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: created, error: createErr } = await supabase
        .from('collections')
        .insert({
          user_id: currentUserId,
          name: trimmed,
        })
        .select()
        .single();

      if (createErr) {
        throw new Error(createErr.message);
      }

      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        actor_id: currentUserId,
        action_type: 'collection',
        target_id: created?.id || null,
        description: `Created collection "${trimmed}"`,
        is_public: true,
      });

      setConfirmationMessage(`Collection "${trimmed}" was created successfully.`);
      setCollectionName('');
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-[calc(100vh-140px)] md:min-h-[calc(100vh-40px)] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
            Add
          </h1>
        </div>

        <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setMode('photo');
              setError(null);
              setConfirmationMessage(null);
            }}
            className="group p-7 rounded-3xl border border-black/[0.08] bg-white hover:bg-[#0A0A0A] hover:text-white transition-all text-left space-y-4 shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] group-hover:bg-white/15 flex items-center justify-center transition-colors">
              <ImagePlus className="w-6 h-6 text-[#0A0A0A] group-hover:text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold">Add Photo</h2>
              <p className="text-xs text-[#737373] group-hover:text-white/70 mt-1">
                Up to 10 photos
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('collection');
              setError(null);
              setConfirmationMessage(null);
            }}
            className="group p-7 rounded-3xl border border-black/[0.08] bg-white hover:bg-[#0A0A0A] hover:text-white transition-all text-left space-y-4 shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] group-hover:bg-white/15 flex items-center justify-center transition-colors">
              <FolderPlus className="w-6 h-6 text-[#0A0A0A] group-hover:text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold">Add Collection</h2>
              <p className="text-xs text-[#737373] group-hover:text-white/70 mt-1">
                Group your photos
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] md:min-h-[calc(100vh-40px)] flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <button
          type="button"
          onClick={() => {
            setMode('choose');
            setError(null);
            setConfirmationMessage(null);
          }}
          className="min-h-[44px] px-4 py-2 mb-6 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Back</span>
        </button>

        {confirmationMessage && (
          <div className="mb-6 p-5 rounded-3xl bg-[#F5F5F7] border border-black/[0.1] space-y-3">
            <div className="flex items-start gap-2.5 text-[#0A0A0A]">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold">Success</p>
                <p className="text-xs text-[#525252] mt-0.5">{confirmationMessage}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onNavigateGallery}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors"
              >
                Open Gallery
              </button>
              <button
                type="button"
                onClick={() => setConfirmationMessage(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white border border-black/[0.1] text-xs font-medium text-[#0A0A0A] hover:bg-black/[0.04] transition-colors"
              >
                {mode === 'photo' ? 'Upload More' : 'Create Another'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {mode === 'collection' ? (
          <form
            onSubmit={handleCreateCollection}
            className="bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                New Collection
              </h1>
              <p className="text-xs text-[#737373] mt-1">
                Give your collection a clear name.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                Collection Name
              </label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Kyoto Autumn 2026"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Collection'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleUploadPhotos}
            className="bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                  Add Photos
                </h1>
                <p className="text-xs text-[#737373] mt-1 tabular-nums">
                  {items.length} / 10 photos selected
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-xl self-start">
                <button
                  type="button"
                  onClick={() => setUseUnified(true)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    useUnified
                      ? 'bg-white text-[#0A0A0A] shadow-xs'
                      : 'text-[#737373] hover:text-[#0A0A0A]'
                  }`}
                >
                  Unified Settings
                </button>
                <button
                  type="button"
                  onClick={() => setUseUnified(false)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    !useUnified
                      ? 'bg-white text-[#0A0A0A] shadow-xs'
                      : 'text-[#737373] hover:text-[#0A0A0A]'
                  }`}
                >
                  Per Photo
                </button>
              </div>
            </div>

            {/* File Picker Dropzone */}
            {items.length < 10 && (
              <label className="block border border-dashed border-black/20 hover:border-[#0A0A0A] rounded-2xl p-6 text-center cursor-pointer bg-[#FAFAFA] hover:bg-[#F5F5F7] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <Upload className="w-6 h-6 mx-auto text-[#0A0A0A] mb-2" strokeWidth={1.75} />
                <p className="text-xs font-medium text-[#0A0A0A]">
                  Choose up to {10 - items.length} more{' '}
                  {10 - items.length === 1 ? 'photo' : 'photos'}
                </p>
                <p className="text-[11px] text-[#737373] mt-1">
                  PNG, JPG, WEBP, or HEIC supported
                </p>
              </label>
            )}

            {fileLimitNotice && (
              <p className="text-xs text-[#525252] bg-[#F5F5F7] px-3.5 py-2.5 rounded-xl">
                {fileLimitNotice}
              </p>
            )}

            {/* Selected Previews Strip */}
            {items.length > 0 && useUnified && (
              <div className="grid grid-cols-5 gap-2.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-xl overflow-hidden border border-black/[0.08] bg-[#F5F5F7]"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingItem(item.id)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center hover:bg-black"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Unified Settings Form */}
            {useUnified ? (
              <div className="space-y-4 pt-2 border-t border-black/[0.06]">
                <div>
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                    Name {items.length > 1 ? '(applied with index)' : ''}
                  </label>
                  <input
                    type="text"
                    value={unifiedTitle}
                    onChange={(e) => setUnifiedTitle(e.target.value)}
                    placeholder="e.g. Morning Light @alex"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                      Privacy
                    </label>
                    <select
                      value={unifiedPrivacy}
                      onChange={(e) => setUnifiedPrivacy(e.target.value as PhotoPrivacy)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm"
                    >
                      <option value="public">Public (Feed &amp; Profile)</option>
                      <option value="private">Private (Gallery only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                      Collection
                    </label>
                    <select
                      value={unifiedCollectionId}
                      onChange={(e) => setUnifiedCollectionId(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm"
                    >
                      <option value="">Unsorted (No Collection)</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                    Tags (optional, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={unifiedTags}
                    onChange={(e) => setUnifiedTags(e.target.value)}
                    placeholder="architecture, monochrome, japan"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-sm transition-colors"
                  />
                </div>
              </div>
            ) : (
              /* Individual Settings per Photo */
              <div className="space-y-4 pt-2 border-t border-black/[0.06]">
                {items.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#737373] flex flex-col items-center gap-2">
                    <Layers className="w-5 h-5 opacity-50" />
                    <span>Select photos above to customize each one individually.</span>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-black/[0.08] bg-[#FAFAFA] space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={item.previewUrl}
                          alt={item.title}
                          className="w-16 h-16 rounded-xl object-cover border border-black/[0.08] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-medium text-[#737373] tabular-nums">
                              Photo {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removePendingItem(item.id)}
                              className="text-xs text-[#737373] hover:text-red-600 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) =>
                              updatePendingItem(item.id, { title: e.target.value })
                            }
                            placeholder="Photo name"
                            className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] focus:border-[#0A0A0A] outline-none text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <select
                          value={item.privacy}
                          onChange={(e) =>
                            updatePendingItem(item.id, {
                              privacy: e.target.value as PhotoPrivacy,
                            })
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-xs"
                        >
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                        </select>

                        <select
                          value={item.collectionId}
                          onChange={(e) =>
                            updatePendingItem(item.id, { collectionId: e.target.value })
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-xs"
                        >
                          <option value="">Unsorted</option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={item.tagsText}
                          onChange={(e) =>
                            updatePendingItem(item.id, { tagsText: e.target.value })
                          }
                          placeholder="Tags (comma-separated)"
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-xs"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors disabled:opacity-40"
            >
              {submitting
                ? 'Uploading...'
                : `Upload ${items.length || ''} ${
                    items.length === 1 ? 'Photo' : 'Photos'
                  }`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
