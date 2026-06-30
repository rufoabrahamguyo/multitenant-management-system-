import { Link } from 'react-router-dom';
import PropizyLogo from './PropizyLogo';
import SkipLink from './SkipLink';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <>
      <SkipLink targetId="auth-main" />
      <div className="relative min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6">
        <Link
          to="/"
          className="absolute top-4 left-4 sm:top-6 sm:left-6 text-sm text-slate-300 hover:text-white transition-colors focus-visible:rounded-lg"
        >
          ← Back to home
        </Link>

        <div className="mb-6 sm:mb-8 text-center px-4">
          <Link to="/" className="inline-block transition-opacity hover:opacity-90 rounded-xl" aria-label="Propizy home">
            <PropizyLogo variant="dark" size="lg" showWordmark className="justify-center" />
          </Link>
          <p className="text-slate-300 mt-3 text-sm">Property Management Made Easy</p>
        </div>

        <main id="auth-main" className="card-auth w-full" tabIndex={-1}>
          {title && <h1 className="page-title text-center mb-2">{title}</h1>}
          {subtitle && <p className="text-center text-sm text-slate-500 mb-6">{subtitle}</p>}
          {children}
          {footer}
        </main>
      </div>
    </>
  );
}
