import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban,
  Bell,
  Heart,
  Image as ImageIcon,
  RefreshCw,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppNotification } from '../types';
import {
  fetchNotifications,
  markNotificationsAsRead,
} from '../lib/notifications';
import { formatRelativeTime, getInitials } from '../lib/utils';
import { VerifiedBadge } from './VerifiedBadge';
import { ResilientImage } from './ResilientImage';
import { syncAndNotifyAchievements } from '../lib/achievements';

interface NotificationsPanelProps {
  currentUserId: string;
  onOpenProfile: (userId: string) => void;
  onOpenPost: (photoId: string) => void;
  onShowToast?: (msg: string) => void;
  onMarkedRead?: () => void;
  onCloseModal?: () => void;
  refreshKey?: number;
  compact?: boolean;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  currentUserId,
  onOpenProfile,
  onOpenPost,
  onShowToast,
  onMarkedRead,
  onCloseModal,
  refreshKey = 0,
  compact = false,
}) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [restrictedIds, setRestrictedIds] = useState<Set<string>>(new Set());
  const [busyActorId, setBusyActorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const onMarkedReadRef = useRef(onMarkedRead);
  useEffect(() => {
    onMarkedReadRef.current = onMarkedRead;
  }, [onMarkedRead]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, followingRes, restrictedRes] = await Promise.all([
        fetchNotifications(currentUserId),
        supabase
          .from('subscriptions')
          .select('target_user_id')
          .eq('subscriber_id', currentUserId),
        supabase
          .from('subscription_restrictions')
          .select('restricted_user_id')
          .eq('owner_id', currentUserId),
      ]);

      setItems(notifRes.items);
      setSchemaMissing(notifRes.schemaMissing);

      const nextFollowing = new Set<string>();
      for (const r of followingRes.data || []) {
        nextFollowing.add(String(r.target_user_id));
      }
      setFollowingIds(nextFollowing);

      const nextRestricted = new Set<string>();
      for (const r of restrictedRes.data || []) {
        nextRestricted.add(String(r.restricted_user_id));
      }
      setRestrictedIds(nextRestricted);

      const unreadIds = notifRes.items.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await markNotificationsAsRead(currentUserId, unreadIds);
        onMarkedReadRef.current?.();
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  const handleFollowBack = async (
    e: React.MouseEvent,
    actor: NonNullable<AppNotification['actor']>
  ) => {
    e.stopPropagation();
    if (busyActorId || followingIds.has(actor.id)) return;
    setBusyActorId(actor.id);
    try {
      const { error } = await supabase.from('subscriptions').insert({
        subscriber_id: currentUserId,
        target_user_id: actor.id,
      });
      if (error) {
        onShowToast?.('Could not follow this user.');
        return;
      }
      setFollowingIds((prev) => new Set(prev).add(actor.id));
      try {
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          actor_id: currentUserId,
          action_type: 'subscribe',
          target_id: actor.id,
          description: `Followed @${actor.username}`,
          is_public: true,
        });
      } catch {
        // Non-fatal
      }
      syncAndNotifyAchievements(currentUserId, undefined, onShowToast);
      onShowToast?.(`Followed @${actor.username}`);
    } finally {
      setBusyActorId(null);
    }
  };

  const handleRestrict = async (
    e: React.MouseEvent,
    actor: NonNullable<AppNotification['actor']>
  ) => {
    e.stopPropagation();
    if (busyActorId || restrictedIds.has(actor.id)) return;
    setBusyActorId(actor.id);
    try {
      await supabase
        .from('subscriptions')
        .delete()
        .eq('subscriber_id', actor.id)
        .eq('target_user_id', currentUserId);

      const { error } = await supabase
        .from('subscription_restrictions')
        .upsert(
          {
            owner_id: currentUserId,
            restricted_user_id: actor.id,
          },
          { onConflict: 'owner_id,restricted_user_id' }
        );

      if (error) {
        onShowToast?.(error.message);
        return;
      }

      setRestrictedIds((prev) => new Set(prev).add(actor.id));
      onShowToast?.(`Restricted @${actor.username} from following`);
    } finally {
      setBusyActorId(null);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-3 animate-pulse py-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-2xl bg-[#F5F5F7] border border-black/[0.04]"
          />
        ))}
      </div>
    );
  }

  if (schemaMissing) {
    return (
      <div className="py-10 px-4 text-center rounded-2xl border border-black/[0.06] bg-[#FAFAFA] space-y-2">
        <Bell className="w-6 h-6 mx-auto text-[#737373]" strokeWidth={1.5} />
        <p className="text-xs font-medium text-[#0A0A0A]">
          Notifications table not installed yet
        </p>
        <p className="text-[11px] text-[#737373] max-w-xs mx-auto">
          Run the latest SQL script in your Supabase SQL Editor to enable live notifications.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 px-4 text-center rounded-3xl border border-black/[0.06] bg-[#FAFAFA] space-y-2.5">
        <Bell className="w-7 h-7 mx-auto text-[#737373]" strokeWidth={1.5} />
        <p className="text-sm font-medium text-[#0A0A0A]">No notifications yet</p>
        <p className="text-xs text-[#737373] max-w-xs mx-auto">
          You will be notified when someone follows you, likes your photo, or when creators you follow post new photos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {!compact && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={loadAll}
            aria-label="Refresh notifications"
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.08] text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {items.map((notif) => {
        const actor = notif.actor;
        const photo = notif.photo;
        const actorLabel = actor ? `@${actor.username}` : 'Someone';
        const isFollowingBack = actor ? followingIds.has(actor.id) : false;
        const isRestricted = actor ? restrictedIds.has(actor.id) : false;
        const isBusy = actor ? busyActorId === actor.id : false;

        const handleOpenTarget = () => {
          if (notif.type === 'follow' && actor) {
            onCloseModal?.();
            onOpenProfile(actor.id);
          } else if (notif.photo_id) {
            onCloseModal?.();
            onOpenPost(notif.photo_id);
          } else if (actor) {
            onCloseModal?.();
            onOpenProfile(actor.id);
          }
        };

        return (
          <div
            key={notif.id}
            onClick={handleOpenTarget}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenTarget();
              }
            }}
            className={`p-3.5 rounded-2xl border transition-colors flex items-center justify-between gap-3 cursor-pointer text-left ${
              !notif.is_read
                ? 'border-black/[0.14] bg-[#FAFAFA] hover:bg-[#F5F5F7]'
                : 'border-black/[0.08] bg-white hover:bg-[#F5F5F7]'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Actor avatar */}
              <div className="relative shrink-0">
                {actor?.avatar_url ? (
                  <img
                    src={actor.avatar_url}
                    alt={actor.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-black/[0.08]"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center">
                    {getInitials(actor?.name || 'SO')}
                  </span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border border-black/[0.08] flex items-center justify-center">
                  {notif.type === 'follow' ? (
                    <UserPlus className="w-2.5 h-2.5 text-[#0A0A0A]" strokeWidth={2.2} />
                  ) : notif.type === 'like' ? (
                    <Heart className="w-2.5 h-2.5 text-[#E11D48] fill-[#E11D48]" strokeWidth={2} />
                  ) : (
                    <ImageIcon className="w-2.5 h-2.5 text-[#0A0A0A]" strokeWidth={2.2} />
                  )}
                </span>
              </div>

              {/* Message */}
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-[#0A0A0A] leading-snug">
                  <span className="inline-flex items-center gap-1 font-semibold align-baseline">
                    <span>{actorLabel}</span>
                    {actor && (
                      <VerifiedBadge
                        username={actor.username}
                        isVerified={actor.is_verified}
                      />
                    )}
                  </span>{' '}
                  {notif.type === 'follow' ? (
                    <span>just started following you!</span>
                  ) : notif.type === 'like' ? (
                    <span>
                      liked your photo
                      {photo?.title ? ` "${photo.title}"` : ''}
                    </span>
                  ) : (
                    <span>
                      posted a new photo
                      {photo?.title ? ` "${photo.title}"` : ''}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-[#737373] mt-0.5 tabular-nums">
                  {formatRelativeTime(notif.created_at)}
                </p>
              </div>
            </div>

            {/* Right controls */}
            {notif.type === 'follow' && actor ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isBusy || isRestricted}
                  onClick={(e) => handleRestrict(e, actor)}
                  aria-label={isRestricted ? 'Restricted' : `Restrict @${actor.username}`}
                  title={isRestricted ? 'Restricted' : 'Restrict from following'}
                  className={`min-h-[36px] min-w-[36px] p-2 rounded-xl border inline-flex items-center justify-center transition-colors disabled:opacity-50 ${
                    isRestricted
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-black/[0.1] bg-white hover:bg-red-50 hover:border-red-200 text-[#525252] hover:text-red-600'
                  }`}
                >
                  <Ban className="w-4 h-4" strokeWidth={1.75} />
                </button>

                <button
                  type="button"
                  disabled={isBusy || isFollowingBack}
                  onClick={(e) => handleFollowBack(e, actor)}
                  aria-label={
                    isFollowingBack
                      ? `Following @${actor.username}`
                      : `Follow back @${actor.username}`
                  }
                  title={isFollowingBack ? 'Following' : 'Follow back'}
                  className={`min-h-[36px] min-w-[36px] p-2 rounded-xl inline-flex items-center justify-center transition-colors disabled:opacity-75 ${
                    isFollowingBack
                      ? 'bg-[#F5F5F7] text-[#0A0A0A] border border-black/[0.1]'
                      : 'bg-[#0A0A0A] hover:bg-black/85 text-white'
                  }`}
                >
                  {isFollowingBack ? (
                    <UserCheck className="w-4 h-4" strokeWidth={1.85} />
                  ) : (
                    <UserPlus className="w-4 h-4" strokeWidth={1.85} />
                  )}
                </button>
              </div>
            ) : photo?.image_url ? (
              <ResilientImage
                src={photo.image_url}
                alt={photo.title}
                containerClassName="w-11 h-11 rounded-xl border border-black/[0.08] shrink-0"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
