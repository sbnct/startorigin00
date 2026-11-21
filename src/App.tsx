import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { CinemaPhoto, NavTab, Profile } from './types';
import { Navigation } from './components/Navigation';
import { FeedView } from './components/FeedView';
import { SearchView } from './components/SearchView';
import { AddView } from './components/AddView';
import { GalleryView } from './components/GalleryView';
import { ProfileView } from './components/ProfileView';
import { PostPageView } from './components/PostPageView';
import { CollectionView } from './components/CollectionView';
import { CinemaModal } from './components/CinemaModal';
import { AuthView } from './components/AuthView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AdminView } from './components/AdminView';
import { LandingView } from './components/LandingView';
import { syncAndNotifyAchievements } from './lib/achievements';

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('StartOrigin recovered from render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col items-center justify-center px-4 text-center space-y-4">
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-xs text-[#737373] max-w-xs">
            Please tap below to restore the view.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RouteEntry {
  tab: NavTab;
  postId?: string;
  collectionId?: string;
  profileUserId?: string;
}

interface CinemaState {
  items: CinemaPhoto[];
  index: number;
}

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.replace(/\/+$/, '') === '/admin';
}

function hasDeepLinkParam(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('photo') || params.get('collection'));
}

function getInitialRouteStack(): RouteEntry[] {
  if (typeof window === 'undefined') return [{ tab: 'feed' }];
  const params = new URLSearchParams(window.location.search);
  const photoParam = params.get('photo');
  if (photoParam) {
    return [{ tab: 'feed' }, { tab: 'feed', postId: photoParam }];
  }
  const colParam = params.get('collection');
  if (colParam) {
    return [{ tab: 'feed' }, { tab: 'feed', collectionId: colParam }];
  }
  return [{ tab: 'feed' }];
}

function syncUrlForRoute(entry: RouteEntry) {
  if (typeof window === 'undefined' || isAdminPath()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete('photo');
  url.searchParams.delete('collection');
  if (entry.postId) {
    url.searchParams.set('photo', entry.postId);
  } else if (entry.collectionId) {
    url.searchParams.set('collection', entry.collectionId);
  }
  window.history.replaceState({}, '', url.pathname + url.search);
}

function AppContent() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(isAdminPath);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [browseAsGuest, setBrowseAsGuest] = useState<boolean>(hasDeepLinkParam);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [routeStack, setRouteStack] = useState<RouteEntry[]>(getInitialRouteStack);
  const [cinemaState, setCinemaState] = useState<CinemaState | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentRoute = routeStack[routeStack.length - 1] || { tab: 'feed' };

  useEffect(() => {
    const onPopState = () => {
      setIsAdminRoute(isAdminPath());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    syncUrlForRoute(currentRoute);
  }, [currentRoute]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const loadCurrentProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setCurrentUserProfile(null);
      return;
    }

    try {
      const user = activeSession.user;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setCurrentUserProfile(data as Profile);
        return;
      }

      const meta = user.user_metadata || {};
      const fallbackUsername =
        (meta.username as string) ||
        `user_${user.id.replace(/-/g, '').slice(0, 8)}`;
      const fallbackName =
        (meta.name as string) || (user.email ? user.email.split('@')[0] : 'Creator');

      const { data: inserted } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            name: fallbackName,
            username: fallbackUsername,
            email: user.email || '',
          },
          { onConflict: 'id' }
        )
        .select()
        .maybeSingle();

      if (inserted) {
        setCurrentUserProfile(inserted as Profile);
      }
    } catch {
      // Non-fatal; keep session intact even if profile fetch momentarily fails
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        loadCurrentProfile(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setAuthModalOpen(false);
      }
      loadCurrentProfile(nextSession);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [loadCurrentProfile]);

  useEffect(() => {
    if (!session?.user?.id) return;
    syncAndNotifyAchievements(session.user.id, currentUserProfile, showToast).catch(
      () => {}
    );
  }, [
    session?.user?.id,
    currentUserProfile?.username,
    currentUserProfile?.is_verified,
    refreshKey,
    showToast,
  ]);

  const openCinema = useCallback(
    (photo: CinemaPhoto, collectionItems?: CinemaPhoto[]) => {
      if (collectionItems && collectionItems.length > 0) {
        const idx = collectionItems.findIndex((it) => it.id === photo.id);
        setCinemaState({
          items: collectionItems,
          index: idx >= 0 ? idx : 0,
        });
      } else {
        setCinemaState({ items: [photo], index: 0 });
      }
    },
    []
  );

  const openAuth = useCallback((initialMode: 'signin' | 'signup' = 'signin') => {
    setAuthInitialMode(initialMode);
    setAuthModalOpen(true);
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    setRouteStack([{ tab }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPost = (photoId: string) => {
    setRouteStack((prev) => [...prev, { tab: currentRoute.tab, postId: photoId }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCollection = (collectionId: string) => {
    setRouteStack((prev) => [
      ...prev,
      { tab: currentRoute.tab, collectionId },
    ]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProfile = (userId: string) => {
    if (session?.user?.id === userId) {
      setRouteStack([{ tab: 'profile' }]);
    } else {
      setRouteStack((prev) => [
        ...prev,
        { tab: currentRoute.tab, profileUserId: userId },
      ]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProfileByUsername = async (username: string) => {
    const clean = username.trim();
    if (!clean) return;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', clean)
      .maybeSingle();

    if (!data?.id) {
      showToast(`No user found with @${clean}`);
      return;
    }
    handleOpenProfile(data.id);
  };

  const handleBack = () => {
    setRouteStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ensure local session clears cleanly even if signOut request fails
    } finally {
      setSession(null);
      setCurrentUserProfile(null);
      setAuthModalOpen(false);
      setBrowseAsGuest(false);
      setRouteStack([{ tab: 'feed' }]);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleExitAdmin = () => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
    setRefreshKey((k) => k + 1);
  };

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  if (isAdminRoute) {
    return (
      <>
        <AdminView onExitAdmin={handleExitAdmin} onOpenCinema={openCinema} />
        <CinemaModal
          items={cinemaState?.items || []}
          initialIndex={cinemaState?.index || 0}
          onClose={() => setCinemaState(null)}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (!authReady) {
    return <div className="min-h-screen bg-white" />;
  }

  const showLanding =
    !session?.user &&
    !browseAsGuest &&
    !currentRoute.postId &&
    !currentRoute.collectionId;

  if (showLanding) {
    return (
      <>
        <LandingView
          onGetStarted={() => openAuth('signup')}
          onSignIn={() => openAuth('signin')}
          onExploreFeed={() => {
            setBrowseAsGuest(true);
            handleSelectTab('feed');
          }}
        />
        {authModalOpen && (
          <AuthView
            initialMode={authInitialMode}
            onSuccess={() => {
              setAuthModalOpen(false);
              bumpRefresh();
            }}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
        <OfflineIndicator />
        {toastMessage && (
          <div
            role="status"
            className="fixed bottom-6 right-4 sm:right-6 z-50 px-4 py-3 rounded-2xl bg-[#0A0A0A] text-white text-xs font-medium shadow-xl"
          >
            {toastMessage}
          </div>
        )}
      </>
    );
  }

  const renderMainContent = () => {
    if (currentRoute.postId) {
      return (
        <PostPageView
          photoId={currentRoute.postId}
          currentUserId={session?.user?.id || null}
          onBack={handleBack}
          onOpenCinema={openCinema}
          onOpenPost={handleOpenPost}
          onOpenCollection={handleOpenCollection}
          onOpenProfile={handleOpenProfile}
          onOpenProfileByUsername={handleOpenProfileByUsername}
          onRequireAuth={() => openAuth('signin')}
          onShowToast={showToast}
        />
      );
    }

    if (currentRoute.collectionId) {
      return (
        <CollectionView
          collectionId={currentRoute.collectionId}
          currentUserId={session?.user?.id || null}
          onBack={handleBack}
          onOpenPost={handleOpenPost}
          onOpenCinema={openCinema}
          onOpenProfile={handleOpenProfile}
          onRequireAuth={() => openAuth('signin')}
          onShowToast={showToast}
        />
      );
    }

    if (currentRoute.profileUserId) {
      return (
        <ProfileView
          targetUserId={currentRoute.profileUserId}
          currentUserId={session?.user?.id || null}
          showBackButton={routeStack.length > 1}
          onBack={handleBack}
          onAuthSuccess={() => {
            setAuthModalOpen(false);
            bumpRefresh();
          }}
          onOpenCinema={openCinema}
          onOpenPost={handleOpenPost}
          onOpenCollection={handleOpenCollection}
          onProfileUpdated={() => {
            loadCurrentProfile(session);
            bumpRefresh();
          }}
          onRequireAuth={() => openAuth('signin')}
          onSignOut={handleSignOut}
          onShowToast={showToast}
          refreshKey={refreshKey}
        />
      );
    }

    switch (currentRoute.tab) {
      case 'feed':
        return (
          <FeedView
            currentUserId={session?.user?.id || null}
            onOpenCinema={openCinema}
            onOpenPost={handleOpenPost}
            onOpenProfile={handleOpenProfile}
            onOpenProfileByUsername={handleOpenProfileByUsername}
            onRequireAuth={() => openAuth('signin')}
            onShowToast={showToast}
            refreshKey={refreshKey}
          />
        );
      case 'search':
        return (
          <SearchView
            currentUserId={session?.user?.id || null}
            onOpenCinema={openCinema}
            onOpenPost={handleOpenPost}
            onOpenProfile={handleOpenProfile}
            onRequireAuth={() => openAuth('signin')}
          />
        );
      case 'add':
        return (
          <AddView
            currentUserId={session?.user?.id || null}
            onAuthSuccess={() => {
              setAuthModalOpen(false);
              bumpRefresh();
            }}
            onNavigateGallery={() => handleSelectTab('gallery')}
            onDataChanged={bumpRefresh}
            onShowToast={showToast}
          />
        );
      case 'gallery':
        return (
          <GalleryView
            currentUserId={session?.user?.id || null}
            onAuthSuccess={() => {
              setAuthModalOpen(false);
              bumpRefresh();
            }}
            onOpenCinema={openCinema}
            onOpenPost={handleOpenPost}
            onDataChanged={bumpRefresh}
            onShowToast={showToast}
            refreshKey={refreshKey}
          />
        );
      case 'profile':
        return (
          <ProfileView
            targetUserId={session?.user?.id || null}
            currentUserId={session?.user?.id || null}
            onAuthSuccess={() => {
              setAuthModalOpen(false);
              bumpRefresh();
            }}
            onOpenCinema={openCinema}
            onOpenPost={handleOpenPost}
            onOpenCollection={handleOpenCollection}
            onProfileUpdated={() => {
              loadCurrentProfile(session);
              bumpRefresh();
            }}
            onRequireAuth={() => openAuth('signin')}
            onSignOut={handleSignOut}
            onShowToast={showToast}
            refreshKey={refreshKey}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col md:flex-row">
      <Navigation
        activeTab={currentRoute.tab}
        onSelectTab={handleSelectTab}
        onBrandClick={
          !session?.user
            ? () => {
                setBrowseAsGuest(false);
                setRouteStack([{ tab: 'feed' }]);
              }
            : undefined
        }
        currentUserProfile={currentUserProfile}
        isAuthenticated={Boolean(session?.user)}
        onOpenAuth={() => openAuth('signin')}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 min-w-0 pb-24 md:pb-12">{renderMainContent()}</main>

      <CinemaModal
        items={cinemaState?.items || []}
        initialIndex={cinemaState?.index || 0}
        onClose={() => setCinemaState(null)}
      />

      {authModalOpen && (
        <AuthView
          initialMode={authInitialMode}
          onSuccess={() => {
            setAuthModalOpen(false);
            bumpRefresh();
          }}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      <OfflineIndicator />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 px-4 py-3 rounded-2xl bg-[#0A0A0A] text-white text-xs font-medium shadow-xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
