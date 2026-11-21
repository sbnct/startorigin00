import React, { useEffect, useState } from 'react';
import { Layers, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Collection, PhotoPrivacy } from '../types';
import { sanitizeFilename } from '../lib/utils';
import {
  acceptUploadRules,
  formatCooldownDuration,
  getUploadCooldownRemainingMs,
  hasAcceptedUploadRules,
  recordPhotoUploadTimestamp,
  syncUploadCooldownFromServer,
} from '../lib/uploadGuard';
import { RulesModal } from './RulesModal';

interface AddPhotoModalProps {
  isOpen: boolean;
  currentUserId: string;
  collections: Collection[];
  defaultCollectionId: string;
  onClose: () => void;
  onSuccess: (uploadedCount: number, destinationLabel: string) => void;
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

export const AddPhotoModal: React.FC<AddPhotoModalProps> = ({
  isOpen,
  currentUserId,
  collections,
  defaultCollectionId,
  onClose,
  onSuccess,
}) => {
  const [items, setItems] = useState<PendingPhotoItem[]>([]);
  const [useUnified, setUseUnified] = useState(true);
  const [unifiedTitle, setUnifiedTitle] = useState('');
  const [unifiedPrivacy, setUnifiedPrivacy] = useState<PhotoPrivacy>('public');
  const [unifiedCollectionId, setUnifiedCollectionId] = useState(defaultCollectionId);
  const [unifiedTags, setUnifiedTags] = useState('');
  const [fileLimitNotice, setFileLimitNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [rulesConfirmOpen, setRulesConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUnifiedCollectionId(defaultCollectionId);
      setError(null);
      setFileLimitNotice(null);
      syncUploadCooldownFromServer(currentUserId).then(setCooldownMs);
    }
  }, [isOpen, defaultCollectionId, currentUserId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => {
      setCooldownMs(getUploadCooldownRemainingMs(currentUserId));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, currentUserId]);

  useEffect(() => {
    return () => {
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
  }, [items]);

  if (!isOpen) return null;

  const targetCollection = collections.find((c) => c.id === defaultCollectionId);
  const destinationName = targetCollection ? targetCollection.name : 'Unsorted';

  const handleClose = () => {
    if (submitting) return;
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setUnifiedTitle('');
    setUnifiedTags('');
    setFileLimitNotice(null);
    setError(null);
    onClose();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setFileLimitNotice(null);
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
        collectionId: defaultCollectionId,
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

  const performUpload = async () => {
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
          throw new Error(`Storage upload failed (${uploadErr.message}).`);
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

      recordPhotoUploadTimestamp(currentUserId);
      setCooldownMs(getUploadCooldownRemainingMs(currentUserId));

      const hasPublic = uploadedRows.some((r) => r.privacy === 'public');
      try {
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
      } catch {
        // Non-fatal
      }

      const selectedCol = collections.find((c) => c.id === unifiedCollectionId);
      const destinationLabel = useUnified
        ? selectedCol
          ? `to "${selectedCol.name}"`
          : 'to Unsorted'
        : `to "${destinationName}"`;

      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      setItems([]);
      setUnifiedTitle('');
      setUnifiedTags('');
      setFileLimitNotice(null);
      onSuccess(uploadedRows.length, destinationLabel);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadPhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const remaining = await syncUploadCooldownFromServer(currentUserId);
    if (remaining > 0) {
      setCooldownMs(remaining);
      setError(
        `Please wait ${formatCooldownDuration(remaining)} before uploading more photos.`
      );
      return;
    }

    if (items.length === 0) {
      setError('Please select at least 1 photo (up to 10).');
      return;
    }

    if (useUnified && !unifiedTitle.trim()) {
      setError('Please enter a photo name.');
      return;
    }

    if (!useUnified && items.some((it) => !it.title.trim())) {
      setError('Every photo needs a name.');
      return;
    }

    if (!hasAcceptedUploadRules(currentUserId)) {
      setRulesConfirmOpen(true);
      return;
    }

    await performUpload();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Add photo to ${destinationName}`}
      onClick={handleClose}
    >
      <form
        onSubmit={handleUploadPhotos}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-black/[0.08] rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#0A0A0A] truncate">
              Add to {destinationName}
            </h2>
            <p className="text-xs text-[#737373] mt-0.5 tabular-nums">
              {items.length} / 10 photos selected
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close add photo modal"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-black/[0.08] text-[#0A0A0A] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-xl">
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

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {items.length < 10 && (
          <label className="block border border-dashed border-black/20 hover:border-[#0A0A0A] rounded-2xl p-5 text-center cursor-pointer bg-[#FAFAFA] hover:bg-[#F5F5F7] transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <Upload className="w-5 h-5 mx-auto text-[#0A0A0A] mb-2" strokeWidth={1.75} />
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
                placeholder="e.g. Morning Light"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                  Privacy
                </label>
                <select
                  value={unifiedPrivacy}
                  onChange={(e) => setUnifiedPrivacy(e.target.value as PhotoPrivacy)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
                >
                  <option value="public">Public (Feed &amp; Profile)</option>
                  <option value="followers">Followers (Only subscribers)</option>
                  <option value="unlisted">By Link (Only via shared link)</option>
                  <option value="private">Private (Gallery only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                  Destination
                </label>
                <select
                  value={unifiedCollectionId}
                  onChange={(e) => setUnifiedCollectionId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm"
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
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent focus:bg-white focus:border-[#0A0A0A] outline-none text-base md:text-sm transition-colors"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 pt-2 border-t border-black/[0.06]">
            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#737373] flex flex-col items-center gap-2">
                <Layers className="w-5 h-5 opacity-50" />
                <span>Select photos above to customize each one individually.</span>
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-black/[0.08] bg-[#FAFAFA] space-y-2.5"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      className="w-14 h-14 rounded-xl object-cover border border-black/[0.08] shrink-0"
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
                        className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] focus:border-[#0A0A0A] outline-none text-base md:text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={item.privacy}
                      onChange={(e) =>
                        updatePendingItem(item.id, {
                          privacy: e.target.value as PhotoPrivacy,
                        })
                      }
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-base md:text-xs"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers</option>
                      <option value="unlisted">By Link</option>
                      <option value="private">Private</option>
                    </select>

                    <select
                      value={item.collectionId}
                      onChange={(e) =>
                        updatePendingItem(item.id, { collectionId: e.target.value })
                      }
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-base md:text-xs"
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
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-base md:text-xs"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {cooldownMs > 0 && (
          <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.08] text-xs text-[#525252] tabular-nums">
            Rate limit active: you can upload your next photos in{' '}
            <strong className="font-semibold text-[#0A0A0A]">
              {formatCooldownDuration(cooldownMs)}
            </strong>
            .
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06]">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#525252] hover:bg-[#F5F5F7] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || items.length === 0 || cooldownMs > 0}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs sm:text-sm font-medium hover:bg-black/85 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {submitting
              ? 'Uploading...'
              : cooldownMs > 0
              ? `Wait ${formatCooldownDuration(cooldownMs)}`
              : `Upload ${items.length || ''} ${
                  items.length === 1 ? 'Photo' : 'Photos'
                }`}
          </button>
        </div>
      </form>

      <RulesModal
        isOpen={rulesConfirmOpen}
        onClose={() => setRulesConfirmOpen(false)}
        requireAcknowledge
        onAcknowledge={() => {
          acceptUploadRules(currentUserId);
          setRulesConfirmOpen(false);
          performUpload();
        }}
      />
    </div>
  );
};
