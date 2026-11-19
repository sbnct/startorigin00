import React, { useState } from 'react';
import {
  Compass,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  User,
} from 'lucide-react';
import { NavTab, Profile } from '../types';
import { getInitials } from '../lib/utils';
import { VerifiedBadge } from './VerifiedBadge';
import { PWAInstallButton } from './PWAInstallButton';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUserProfile: Profile | null;
  isAuthenticated: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: 'feed', label: 'Feed', icon: Compass },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'add', label: 'Add', icon: Plus },
  { id: 'gallery', label: 'Gallery', icon: LayoutGrid },
  { id: 'profile', label: 'Profile', icon: User },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  currentUserProfile,
  isAuthenticated,
  onOpenAuth,
  onSignOut,
}) => {
  const [sidebarHidden, setSidebarHidden] = useState(false);

  return (
    <>
      {/* Floating Restore Menu Button when Desktop Sidebar is Hidden */}
      {sidebarHidden && (
        <button
          type="button"
          onClick={() => setSidebarHidden(false)}
          aria-label="Show navigation menu"
          title="Show menu"
          className="hidden md:flex fixed top-5 left-5 z-30 min-h-[44px] px-3.5 py-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-black/[0.1] shadow-sm items-center gap-2 text-xs font-medium text-[#0A0A0A] hover:bg-[#F5F5F7] transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
          <span>Menu</span>
        </button>
      )}

      {/* Desktop Collapsible Left Sidebar */}
      {!sidebarHidden && (
        <aside className="hidden md:flex flex-col justify-between w-64 shrink-0 border-r border-black/[0.08] bg-white h-screen sticky top-0 px-5 py-7">
          <div>
            <div className="flex items-center justify-between gap-2 px-2 mb-8">
              <button
                type="button"
                onClick={() => onSelectTab('feed')}
                className="text-left py-1 focus-visible:outline-2 focus-visible:outline-black rounded-lg"
              >
                <span className="text-xl font-semibold tracking-tight text-[#0A0A0A] whitespace-nowrap">
                  StartOrigin
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarHidden(true)}
                aria-label="Hide navigation menu"
                title="Hide menu"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F5F5F7] transition-colors shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <nav aria-label="Main navigation" className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isAdd = item.id === 'add';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 text-sm transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#0A0A0A] text-white font-medium'
                        : isAdd
                        ? 'text-[#0A0A0A] bg-[#F5F5F7] hover:bg-black/[0.08] font-medium'
                        : 'text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F5F5F7] font-normal'
                    }`}
                  >
                    <Icon
                      className="w-[18px] h-[18px] shrink-0"
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-black/[0.08]">
            <PWAInstallButton />

            {isAuthenticated && currentUserProfile ? (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => onSelectTab('profile')}
                  className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  {currentUserProfile.avatar_url ? (
                    <img
                      src={currentUserProfile.avatar_url}
                      alt={currentUserProfile.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover border border-black/[0.08] shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#0A0A0A] text-white text-xs font-medium flex items-center justify-center shrink-0">
                      {getInitials(currentUserProfile.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold text-[#0A0A0A] truncate">
                        {currentUserProfile.name}
                      </p>
                      <VerifiedBadge
                        username={currentUserProfile.username}
                        isVerified={currentUserProfile.is_verified}
                      />
                    </div>
                    <p className="text-[11px] text-[#737373] truncate">
                      @{currentUserProfile.username}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F5F5F7] transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (No top header) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-black/[0.08] pb-safe [transform:translateZ(0)]"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isAdd = item.id === 'add';

            if (isAdd) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-label="Add photo or collection"
                  className="flex flex-col items-center justify-center min-h-[44px]"
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                      isActive
                        ? 'bg-[#0A0A0A] text-white ring-2 ring-black/15'
                        : 'bg-[#0A0A0A] text-white'
                    }`}
                  >
                    <Plus className="w-5 h-5" strokeWidth={2} />
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                  isActive ? 'text-[#0A0A0A]' : 'text-[#737373]'
                }`}
              >
                <Icon className="w-[21px] h-[21px]" strokeWidth={isActive ? 2.1 : 1.65} />
                <span
                  className={`text-[10px] mt-1 tracking-tight ${
                    isActive ? 'font-semibold' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
