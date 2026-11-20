import React from 'react';
import { ArrowRight, FolderKanban, Link2, Maximize2 } from 'lucide-react';
import { ResilientImage } from './ResilientImage';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onExploreFeed: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onSignIn,
  onExploreFeed,
}) => {
  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col">
      {/* Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-black/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            className="text-lg font-semibold tracking-tight text-[#0A0A0A] whitespace-nowrap shrink-0"
          >
            StartOrigin
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#525252]"
          >
            <a
              href="#features"
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#organize"
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Gallery
            </a>
            <a
              href="#share"
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Sharing
            </a>
            <button
              type="button"
              onClick={onExploreFeed}
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Explore Feed
            </button>
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium text-[#737373] tracking-tight">
                Photo Storage · Curated Gallery · Visual Inspiration
              </p>

              <h1 className="text-[clamp(2.25rem,4.4vw,3.6rem)] font-semibold tracking-tight text-[#0A0A0A] leading-[1.08] text-balance">
                Store every frame. Sort your gallery. Share inspiration.
              </h1>

              <p className="text-sm sm:text-base text-[#525252] leading-relaxed max-w-xl">
                StartOrigin is a quiet home for your photography—archive high-resolution
                shots, sort them into collections inside your personal gallery, and share
                selected frames with others to spark inspiration.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="min-h-[46px] px-6 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Start Your Gallery</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                </button>

                <button
                  type="button"
                  onClick={onExploreFeed}
                  className="min-h-[46px] px-5 py-3 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#0A0A0A] text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Browse Public Feed
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] sm:min-h-[380px] rounded-3xl overflow-hidden border border-black/[0.08] bg-[#F5F5F7]">
                <ResilientImage
                  src="/src/assets/images/landing_hero_gallery_1795167856088.jpg"
                  alt="Sunlit architectural gallery interior showcasing framed photography"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="border-t border-black/[0.08] bg-[#FAFAFA] py-16 sm:py-24"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#0A0A0A] text-balance">
                Built for storing, organizing, and sharing visual work
              </h2>
              <p className="text-sm sm:text-base text-[#525252] leading-relaxed">
                Keep uncollected shots tidy, curate cohesive collections, and decide
                exactly what stays private, shared by link, or published to the feed.
              </p>
            </div>

            {/* Asymmetric Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Feature 01 */}
              <article
                id="organize"
                className="lg:col-span-7 bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[#737373] tabular-nums">
                      01. Organize
                    </span>
                    <FolderKanban className="w-4 h-4 text-[#0A0A0A]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">
                    Sort into collections in your gallery
                  </h3>
                  <p className="text-sm text-[#525252] leading-relaxed">
                    Upload up to 10 photos at a time with unified or per-photo settings.
                    Keep unsorted frames at the top, group shoots into collections, rename
                    or move items anytime, and filter instantly by tag or date.
                  </p>
                </div>

                <div className="rounded-2xl overflow-hidden border border-black/[0.06] aspect-[16/10] bg-[#F5F5F7]">
                  <ResilientImage
                    src="/src/assets/images/landing_feature_sort_1795167854450.jpg"
                    alt="Grid of sorted monochrome architectural photographic prints"
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover"
                  />
                </div>
              </article>

              {/* Feature 02 */}
              <article
                id="share"
                className="lg:col-span-5 bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[#737373] tabular-nums">
                      02. Control &amp; Share
                    </span>
                    <Link2 className="w-4 h-4 text-[#0A0A0A]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">
                    Public, by link, or private
                  </h3>
                  <p className="text-sm text-[#525252] leading-relaxed">
                    Set visibility on every photo and collection. Keep drafts private,
                    copy a direct link for friends, or publish to inspire the community.
                  </p>
                </div>

                <div className="rounded-2xl overflow-hidden border border-black/[0.06] aspect-[4/3] bg-[#F5F5F7]">
                  <ResilientImage
                    src="/src/assets/images/landing_feature_share_1795167855352.jpg"
                    alt="Alpine mountain ridges emerging from morning mist"
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover"
                  />
                </div>
              </article>

              {/* Feature 03 */}
              <article className="lg:col-span-12 bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-[#737373] tabular-nums">
                      03. Experience &amp; Inspire
                    </span>
                    <Maximize2 className="w-4 h-4 text-[#0A0A0A]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                    Cinema view with collection swipe and social discovery
                  </h3>
                  <p className="text-sm text-[#525252] leading-relaxed">
                    Tap any photograph to inspect details in full-screen Cinema zoom,
                    swipe smoothly across every shot in a collection, like frames from any
                    grid, and follow photographers whose work inspires your own.
                  </p>
                </div>

                <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-black/[0.06] aspect-[16/10] bg-[#F5F5F7]">
                  <ResilientImage
                    src="/src/assets/images/landing_feature_cinema_1795167855094.jpg"
                    alt="Minimalist monochrome coastal horizon long-exposure print"
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover"
                  />
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 sm:py-24 border-t border-black/[0.08] bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#0A0A0A] text-balance">
              Create your StartOrigin archive
            </h2>
            <p className="text-sm sm:text-base text-[#525252] max-w-lg mx-auto">
              Store your favorite frames, keep collections organized, and share visual
              inspiration on your terms.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onGetStarted}
                className="min-h-[46px] px-6 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors whitespace-nowrap"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={onExploreFeed}
                className="min-h-[46px] px-5 py-3 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#0A0A0A] text-sm font-medium transition-colors whitespace-nowrap"
              >
                Browse Public Feed
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-black/[0.08] bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#737373]">
          <span className="font-semibold text-[#0A0A0A]">StartOrigin</span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onExploreFeed}
              className="hover:text-[#0A0A0A] transition-colors"
            >
              Public Feed
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="hover:text-[#0A0A0A] transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
