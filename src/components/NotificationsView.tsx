import React from 'react';
import { AuthView } from './AuthView';
import { NotificationsPanel } from './NotificationsPanel';

interface NotificationsViewProps {
  currentUserId: string | null;
  onAuthSuccess: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenPost: (photoId: string) => void;
  onShowToast?: (msg: string) => void;
  onMarkedRead?: () => void;
  refreshKey: number;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  currentUserId,
  onAuthSuccess,
  onOpenProfile,
  onOpenPost,
  onShowToast,
  onMarkedRead,
  refreshKey,
}) => {
  if (!currentUserId) {
    return (
      <AuthView
        embedded
        onSuccess={onAuthSuccess}
        subtitle="Sign in to view your notifications."
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A]">
          Notifications
        </h1>
      </div>

      <NotificationsPanel
        currentUserId={currentUserId}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
        onShowToast={onShowToast}
        onMarkedRead={onMarkedRead}
        refreshKey={refreshKey}
      />
    </div>
  );
};
