import { Link } from 'react-router-dom';
import PropizyLogo from './PropizyLogo';
import SkipLink from './SkipLink';

const AUTH_HERO = '/images/hero-building-1.png';

function HomeGlyph({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
      />
    </svg>
  );
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <>
      <SkipLink targetId="auth-main" />
      <div className="auth-shell min-h-screen bg-white lg:grid lg:grid-cols-2">
        <aside
          className="auth-hero relative hidden min-h-screen overflow-hidden lg:block"
          aria-hidden="true"
        >
          <img
            src={AUTH_HERO}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/50" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 text-center text-white">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/90 bg-white/10 backdrop-blur-sm">
              <HomeGlyph className="h-8 w-8" />
            </div>
            <p className="max-w-xs text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95 leading-relaxed">
              The community where you can feel like
            </p>
            <p className="auth-hero-script mt-2 text-6xl text-white">Home</p>
          </div>
        </aside>

        <div className="relative flex min-h-screen flex-col">
          <Link
            to="/"
            className="absolute left-4 top-4 z-10 text-sm text-slate-400 transition-colors hover:text-slate-700 focus-visible:rounded-lg sm:left-8 sm:top-6"
          >
            ← Back to home
          </Link>

          <main
            id="auth-main"
            className="auth-panel flex flex-1 flex-col px-6 py-16 sm:px-8"
            tabIndex={-1}
          >
            <div className="mx-auto my-auto w-full max-w-md">
              <div className="mb-8 flex flex-col items-center text-center">
                <Link to="/" className="inline-block rounded-xl transition-opacity hover:opacity-90" aria-label="Propizy home">
                  <PropizyLogo variant="light" size="lg" showWordmark className="justify-center" />
                </Link>
                {title && <h1 className="auth-title mt-8">{title}</h1>}
                {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
              </div>

              {children}
              {footer}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
