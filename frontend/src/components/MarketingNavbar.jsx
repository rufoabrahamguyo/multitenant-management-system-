import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PropizyLogo from './PropizyLogo';
import { scrollToSection } from '../utils/scrollToSection';

const MOBILE_NAV_ID = 'marketing-mobile-nav';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Payments', href: '#payments' },
  { label: 'Tenants', href: '#tenants' },
];

const SCROLL_RANGE = 120;

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export default function MarketingNavbar() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, opacity: 0, transform: 'translateX(0px)' });
  const navRef = useRef(null);
  const linkRefs = useRef({});

  const scrolled = scrollProgress > 0.35;

  useEffect(() => {
    const onScroll = () => {
      const progress = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));
      setScrollProgress(progress);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((link) => document.querySelector(link.href)).filter(Boolean);
    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveSection(`#${visible[0].target.id}`);
        }
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: [0.1, 0.35, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeLink = linkRefs.current[activeSection];
      const navBounds = navRef.current?.getBoundingClientRect();
      const linkBounds = activeLink?.getBoundingClientRect();

      if (activeLink && navBounds && linkBounds) {
        setIndicatorStyle({
          width: linkBounds.width,
          transform: `translateX(${linkBounds.left - navBounds.left}px)`,
          opacity: scrolled ? 1 : 0.85,
        });
        return;
      }

      setIndicatorStyle({ width: 0, opacity: 0, transform: 'translateX(0px)' });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeSection, scrollProgress, scrolled]);

  const glassShellStyle = {
    borderRadius: 0,
    backgroundColor: scrolled
      ? `rgba(255, 255, 255, ${lerp(0.55, 0.82, scrollProgress)})`
      : `rgba(255, 255, 255, ${lerp(0.04, 0.1, scrollProgress)})`,
    backdropFilter: `blur(${lerp(0, 20, scrollProgress)}px) saturate(${lerp(1, 1.8, scrollProgress)})`,
    WebkitBackdropFilter: `blur(${lerp(0, 20, scrollProgress)}px) saturate(${lerp(1, 1.8, scrollProgress)})`,
    boxShadow: scrolled
      ? `0 ${lerp(4, 18, scrollProgress)}px ${lerp(12, 40, scrollProgress)}px rgba(15, 23, 42, ${lerp(0.04, 0.14, scrollProgress)}), inset 0 1px 0 rgba(255, 255, 255, ${lerp(0.35, 0.75, scrollProgress)})`
      : 'none',
    borderBottom: `1px solid rgba(255, 255, 255, ${lerp(0.08, 0.45, scrollProgress)})`,
  };

  const navLinkClass = scrolled
    ? 'text-slate-700 hover:text-slate-900'
    : 'text-white hover:text-white';

  const iconButtonClass = scrolled
    ? 'text-slate-500 hover:bg-slate-900/5 hover:text-slate-700'
    : 'text-white/85 hover:bg-white/10 hover:text-white';

  const handleSectionNav = (event, href) => {
    event.preventDefault();
    scrollToSection(href);
    setActiveSection(href);
    setMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full">
      <div
        className="w-full overflow-hidden transition-[padding] duration-300 ease-out"
        style={{
          ...glassShellStyle,
          paddingBlock: `${lerp(20, 12, scrollProgress)}px`,
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
          style={{ opacity: lerp(0.35, 0.7, scrollProgress) }}
        >
          <div
            className="absolute -top-1/2 -left-1/4 w-[55%] h-[180%] rounded-full blur-3xl"
            style={{
              background: scrolled
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(255, 255, 255, 0.14) 0%, transparent 70%)',
              animation: 'liquidDrift1 14s ease-in-out infinite',
            }}
          />
          <div
            className="absolute -bottom-1/2 -right-1/4 w-[50%] h-[170%] rounded-full blur-3xl"
            style={{
              background: scrolled
                ? 'radial-gradient(circle, rgba(59, 130, 246, 0.16) 0%, transparent 72%)'
                : 'radial-gradient(circle, rgba(147, 197, 253, 0.12) 0%, transparent 72%)',
              animation: 'liquidDrift2 18s ease-in-out infinite',
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)',
              backgroundSize: '200% 100%',
              animation: 'liquidShimmer 8s ease-in-out infinite',
            }}
          />
        </div>

        <div className="relative w-full flex items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0 relative z-10 rounded-xl" aria-label="Propizy home">
            {scrolled ? <PropizyLogo variant="light" /> : <PropizyLogo />}
          </Link>

          <nav
            ref={navRef}
            className="hidden md:flex items-center gap-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-label="Primary"
          >
            <span
              className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full pointer-events-none transition-[transform,width,opacity,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                ...indicatorStyle,
                backgroundColor: scrolled ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.14)',
                boxShadow: scrolled
                  ? 'inset 0 1px 0 rgba(255,255,255,0.8)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
              aria-hidden="true"
            />
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                ref={(node) => {
                  linkRefs.current[link.href] = node;
                }}
                href={link.href}
                onClick={(event) => handleSectionNav(event, link.href)}
                aria-current={activeSection === link.href ? 'true' : undefined}
                className={`relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-300 min-h-[44px] inline-flex items-center ${
                  activeSection === link.href
                    ? scrolled
                      ? 'text-slate-900'
                      : 'text-white'
                    : navLinkClass
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 relative z-10">
            <Link
              to="/login"
              className={`btn-md ${scrolled ? 'btn-primary shadow-sm' : 'btn bg-white/90 text-slate-900 hover:bg-white backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.12)]'}`}
            >
              Manager Login
            </Link>
            <button
              type="button"
              className={`md:hidden w-11 h-11 flex items-center justify-center rounded-full transition-colors ${iconButtonClass}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls={MOBILE_NAV_ID}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>

        <div
          id={MOBILE_NAV_ID}
          className={`md:hidden relative overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
          hidden={!menuOpen}
        >
          <nav className="w-full px-4 sm:px-6 lg:px-8 pt-3 pb-4 flex flex-col gap-1 border-t border-white/10" aria-label="Primary mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(event) => handleSectionNav(event, link.href)}
                aria-current={activeSection === link.href ? 'true' : undefined}
                className={`px-3 py-3 text-sm font-medium rounded-xl transition-colors min-h-[44px] flex items-center ${
                  activeSection === link.href
                    ? scrolled
                      ? 'bg-slate-900/10 text-slate-900'
                      : 'bg-white/12 text-white'
                    : navLinkClass
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
