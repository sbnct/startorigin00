export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function isMissingSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const code = e.code || '';
  const msg = (e.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42883' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getInitials(name?: string | null): string {
  if (!name) return 'SO';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getPhotoShareUrl(photoId: string): string {
  if (typeof window === 'undefined') return `/?photo=${encodeURIComponent(photoId)}`;
  return `${window.location.origin}/?photo=${encodeURIComponent(photoId)}`;
}

export function getCollectionShareUrl(collectionId: string): string {
  if (typeof window === 'undefined') return `/?collection=${encodeURIComponent(collectionId)}`;
  return `${window.location.origin}/?collection=${encodeURIComponent(collectionId)}`;
}

export function getProfileShareUrl(userId: string): string {
  if (typeof window === 'undefined') return `/?user=${encodeURIComponent(userId)}`;
  return `${window.location.origin}/?user=${encodeURIComponent(userId)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function getVisibilityLabel(privacy?: string | null): string {
  if (privacy === 'private') return 'Private';
  if (privacy === 'unlisted') return 'By Link';
  if (privacy === 'followers') return 'Followers';
  if (privacy === 'limited') return 'Limited';
  return 'Public';
}

export function canAccessLimited(
  ownerId: string,
  allowedUserIds: string[] | null | undefined,
  viewerId: string | null
): boolean {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  return Array.isArray(allowedUserIds) && allowedUserIds.includes(viewerId);
}
