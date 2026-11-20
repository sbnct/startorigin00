import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onExploreFeed: () => void;
}

const HERO_WORDS = ['Simple.', 'Organised.', 'Free.'];
const SECTION2_WORDS = ['In', 'StartOrigin,', 'you', 'can:'];

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onSignIn,
  onExploreFeed,
}) => {
  const [heroReady, setHeroReady] = useState(false);
  const [capabilitiesVisible, setCapabilitiesVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  const capabilitiesRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setHeroReady(true);
      setCapabilitiesVisible(true);
      setCtaVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setHeroReady(true), 80);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target === capabilitiesRef.current) {
            setCapabilitiesVisible(true);
          } else if (entry.target === ctaRef.current) {
            setCtaVisible(true);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (capabilitiesRef.current) observer.observe(capabilitiesRef.current);
    if (ctaRef.current) observer.observe(ctaRef.current);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (element: HTMLElement | null) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="top" className="min-h-screen bg-white text-[#0A0A0A] flex flex-col">
      {/* Screen 1: No top header — centered sequential reveal */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-between px-4 sm:px-6 py-10">
        <div aria-hidden="true" className="h-6" />

        <div className="max-w-4xl mx-auto text-center space-y-10">
          <h1 className="text-[clamp(2.75rem,8vw,6rem)] font-semibold tracking-tight leading-[1.04] text-[#0A0A0A] flex flex-wrap items-center justify-center gap-x-[0.28em] gap-y-2">
            {HERO_WORDS.map((word, index) => (
              <span
                key={word}
                style={{ transitionDelay: `${index * 260}ms` }}
                className={`inline-block transition-all duration-700 ease-out ${
                  heroReady
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-5'
                }`}
              >
                {word}
              </span>
            ))}
          </h1>

          <div
            style={{ transitionDelay: `${HERO_WORDS.length * 260 + 120}ms` }}
            className={`transition-all duration-700 ease-out ${
              heroReady
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <button
              type="button"
              onClick={onExploreFeed}
              className="min-h-[48px] px-7 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors inline-flex items-center gap-2.5 whitespace-nowrap"
            >
              <span>Go to app</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToSection(capabilitiesRef.current)}
          style={{ transitionDelay: `${HERO_WORDS.length * 260 + 320}ms` }}
          className={`inline-flex flex-col items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#0A0A0A] transition-all duration-700 ease-out py-2 px-4 ${
            heroReady
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
          }`}
        >
          <span>Scroll</span>
          <ArrowDown className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </section>

      {/* Screen 2: In StartOrigin, you can: */}
      <section
        id="capabilities"
        ref={capabilitiesRef}
        className="min-h-[100dvh] border-t border-black/[0.08] bg-[#FAFAFA] flex flex-col items-center justify-between px-4 sm:px-6 py-16 sm:py-20"
      >
        <div aria-hidden="true" className="h-2" />

        <div className="w-full max-w-5xl mx-auto space-y-12">
          <h2 className="text-[clamp(2rem,4.6vw,3.5rem)] font-semibold tracking-tight text-[#0A0A0A] text-center flex flex-wrap items-center justify-center gap-x-[0.26em] gap-y-1">
            {SECTION2_WORDS.map((word, index) => (
              <span
                key={word}
                style={{ transitionDelay: `${index * 180}ms` }}
                className={`inline-block transition-all duration-700 ease-out ${
                  capabilitiesVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
              >
                {word}
              </span>
            ))}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {/* Container 1 */}
            <article
              style={{ transitionDelay: '720ms' }}
              className={`bg-white border border-black/[0.08] rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-4 transition-all duration-700 ease-out ${
                capabilitiesVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight text-[#0A0A0A]">
                  1. Organise.
                </h3>
                <p className="text-sm sm:text-base text-[#525252] leading-relaxed">
                  Sort photos into{' '}
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    collections
                  </mark>{' '}
                  to{' '}
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    find it easily anytime
                  </mark>
                  .
                </p>
              </div>
            </article>

            {/* Container 2 */}
            <article
              style={{ transitionDelay: '880ms' }}
              className={`bg-white border border-black/[0.08] rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-4 transition-all duration-700 ease-out ${
                capabilitiesVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight text-[#0A0A0A]">
                  2. Control privacy.
                </h3>
                <p className="text-sm sm:text-base text-[#525252] leading-relaxed">
                  Share it with{' '}
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    everyone
                  </mark>
                  , show to{' '}
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    your circle
                  </mark>{' '}
                  or keep it{' '}
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    private
                  </mark>
                  .
                </p>
              </div>
            </article>

            {/* Container 3 */}
            <article
              style={{ transitionDelay: '1040ms' }}
              className={`bg-white border border-black/[0.08] rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-4 transition-all duration-700 ease-out ${
                capabilitiesVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-5'
              }`}
            >
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight text-[#0A0A0A]">
                  3. Interact with other users.
                </h3>
                <p className="text-sm sm:text-base text-[#525252] leading-relaxed">
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    Like
                  </mark>{' '}
                  and{' '}
                  <mark className="bg-[#0A0A0A]/[0.07] text-[#0A0A0A] font-medium px-1.5 py-0.5 rounded-md">
                    save
                  </mark>{' '}
                  public photos of other photographers.
                </p>
              </div>
            </article>
          </div>

          <div
            style={{ transitionDelay: '1180ms' }}
            className={`flex justify-center transition-all duration-700 ease-out ${
              capabilitiesVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <button
              type="button"
              onClick={onExploreFeed}
              className="min-h-[48px] px-7 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors inline-flex items-center gap-2.5 whitespace-nowrap"
            >
              <span>Go to app</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollToSection(ctaRef.current)}
          style={{ transitionDelay: '1280ms' }}
          className={`inline-flex flex-col items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#0A0A0A] transition-all duration-700 ease-out py-2 px-4 mt-8 ${
            capabilitiesVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
          }`}
        >
          <span>Scroll</span>
          <ArrowDown className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </section>

      {/* Section 3: Create your photo space */}
      <section
        id="create-space"
        ref={ctaRef}
        className="border-t border-black/[0.08] bg-white py-24 sm:py-32 px-4 sm:px-6"
      >
        <div
          className={`max-w-2xl mx-auto text-center space-y-5 transition-all duration-700 ease-out ${
            ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#0A0A0A] text-balance">
            Create your photo space.
          </h2>
          <p className="text-sm sm:text-base text-[#525252]">
            Enjoy all features once logged in.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[46px] px-6 py-3 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-black/85 transition-colors whitespace-nowrap"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={onExploreFeed}
              className="min-h-[46px] px-6 py-3 rounded-xl border border-black/[0.12] bg-white hover:bg-[#F5F5F7] text-[#0A0A0A] text-sm font-medium transition-colors whitespace-nowrap"
            >
              Public feed
            </button>
          </div>
        </div>
      </section>

      {/* Footer & Relative Header */}
      <footer className="border-t border-black/[0.08] bg-[#FAFAFA] py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#737373]">
          <span>StartOrigin — Personal Gallery &amp; Visual Space</span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onGetStarted}
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap"
            >
              Create account
            </button>
            <button
              type="button"
              onClick={onExploreFeed}
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap"
            >
              Public feed
            </button>
          </div>
        </div>
      </footer>

      <header className="relative border-t border-black/[0.08] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="text-base font-semibold tracking-tight text-[#0A0A0A] whitespace-nowrap shrink-0"
          >
            StartOrigin
          </a>

          <nav
            aria-label="Page navigation"
            className="hidden sm:flex items-center gap-7 text-sm font-medium text-[#525252]"
          >
            <a
              href="#top"
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Top
            </a>
            <a
              href="#capabilities"
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <button
              type="button"
              onClick={onExploreFeed}
              className="hover:text-[#0A0A0A] transition-colors whitespace-nowrap shrink-0"
            >
              Public feed
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-medium hover:bg-black/85 transition-colors whitespace-nowrap shrink-0"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>
    </div>
  );
};
