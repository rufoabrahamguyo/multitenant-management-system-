import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingNavbar from '../components/MarketingNavbar';
import PropizyLogo from '../components/PropizyLogo';
import SkipLink from '../components/SkipLink';
import { IconMaintenance, IconPayments, IconReports, IconTenants } from '../components/icons/FeatureIcons';
import { scrollToSection } from '../utils/scrollToSection';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1920&q=80',
];

const PRODUCT_HIGHLIGHTS = [
  'M-PESA STK Push',
  'SMS & WhatsApp reminders',
  'Owner / staff governance',
  'Tenant mobile app',
  'Kenya lease agreements',
];

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!window.location.hash) return undefined;
    const timer = window.setTimeout(() => scrollToSection(window.location.hash), 150);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSectionLink = (event, hash) => {
    event.preventDefault();
    scrollToSection(hash);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SkipLink />
      <MarketingNavbar />

      <main id="main-content" tabIndex={-1}>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden" aria-label="Introduction">
        {HERO_IMAGES.map((src, index) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `url(${src})`,
              opacity: activeImage === index ? 1 : 0,
            }}
            aria-hidden={activeImage !== index}
          />
        ))}
        <div className="absolute inset-0 bg-slate-900/55" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-20 w-full">
          <div className="max-w-xl">
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.1] tracking-tight text-white">
              Property Management Made{' '}
              <span className="text-emerald-400">Easy.</span>
            </h1>
            <p className="mt-5 text-slate-200 text-base sm:text-lg leading-relaxed">
              Kenya-first property management for landlords and managers, with M-PESA rent collection,
              invite-only tenant onboarding, owner and staff controls, and arrears tracking in one dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="btn-primary btn-lg bg-white text-slate-900 hover:bg-slate-100"
              >
                Create Organization
              </Link>
              <a
                href="#features"
                onClick={(event) => handleSectionLink(event, '#features')}
                className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-xl border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                Explore Features
              </a>
            </div>

            <div className="flex justify-start gap-1 mt-14 lg:mt-20 -ml-3" role="group" aria-label="Hero image carousel">
              {HERO_IMAGES.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Show building photo ${index + 1} of ${HERO_IMAGES.length}`}
                  aria-current={activeImage === index ? 'true' : undefined}
                  className="p-3 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <span
                    className={`block h-2 rounded-full transition-all ${
                      activeImage === index ? 'w-8 bg-white' : 'w-2 bg-white/50'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product highlights */}
      <section className="border-y border-slate-100 bg-slate-50/80" aria-label="Product highlights">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-4">
            Built for Kenyan property teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {PRODUCT_HIGHLIGHTS.map((label) => (
              <span
                key={label}
                className="text-sm font-semibold text-slate-600 select-none"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="py-20 md:py-28 scroll-mt-28" aria-labelledby="features-heading">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 id="features-heading" className="section-title">
              Run Your Portfolio on Propizy
            </h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto">
              From M-PESA collections to caretaker accountability, with tools that match how rent
              is actually managed in Kenya.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {/* Large card - M-PESA rent collection */}
            <div id="payments" className="lg:col-span-2 lg:row-span-2 bg-white border border-slate-200 rounded-2xl p-8 flex flex-col sm:flex-row gap-6 overflow-hidden scroll-mt-28">
              <div className="flex-1">
                <div className="icon-box-accent mb-4">
                  <IconPayments />
                </div>
                <h3 className="text-xl font-bold text-slate-900">M-PESA Rent Collection</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-sm">
                  STK Push via Safaricom Daraja, automatic payment tracking, PDF invoices and
                  receipts, cash collections with owner approval, and integrity checks for mismatches.
                </p>
              </div>
              <div className="flex items-end justify-end shrink-0">
                <svg viewBox="0 0 120 120" className="w-32 h-32 text-slate-100" fill="currentColor" aria-hidden="true">
                  <rect x="20" y="30" width="80" height="60" rx="8" opacity="0.5" />
                  <rect x="30" y="40" width="60" height="8" rx="2" />
                  <rect x="30" y="54" width="40" height="6" rx="2" opacity="0.6" />
                  <circle cx="85" cy="75" r="12" opacity="0.4" />
                </svg>
              </div>
            </div>

            {/* Dark card - reports and statements */}
            <div className="bg-slate-900 rounded-2xl p-6 flex flex-col justify-between min-h-[200px]">
              <div>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mb-4 text-white">
                  <IconReports />
                </div>
                <h3 className="text-lg font-bold text-white">Reports &amp; Statements</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Live collection rates, property breakdowns, six-month trends, owner PDF statements,
                  and eTIMS-ready rent export for accountants.
                </p>
              </div>
              <a
                href="#payments"
                onClick={(event) => handleSectionLink(event, '#payments')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 mt-4 transition-colors"
              >
                See payments
                <IconArrow />
              </a>
            </div>

            {/* Tenant Screening */}
            <div id="tenants" className="bg-white border border-slate-200 rounded-2xl p-6 scroll-mt-28">
              <div className="icon-box-accent mb-4">
                <IconTenants />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Invite-Only Tenants</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Managers invite by email; tenants register on the Propizy mobile app. Auto-leases,
                Kenya tenancy agreements, balances, arrears, SMS/WhatsApp reminders, and dispute evidence packs.
              </p>
            </div>

            {/* Maintenance */}
            <div className="lg:col-span-2 bg-slate-100 rounded-2xl p-8">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <div className="icon-box-muted mb-4">
                    <IconMaintenance />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Maintenance &amp; Team Governance</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                    Tenants log maintenance from the mobile app. Owners invite staff with read-only
                    finances, approve cash rent, review activity logs, and reconcile M-PESA statements.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {[
                      'Tenant maintenance requests',
                      'Owner vs staff permission matrix',
                      'M-PESA reconciliation & alerts',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <IconCheck />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden sm:flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 80 80" className="w-24 h-24 text-slate-200" fill="currentColor" aria-hidden="true">
                    <path d="M50 10l6 6-30 30-8 2 2-8 30-30z" opacity="0.6" />
                    <rect x="12" y="58" width="36" height="6" rx="2" opacity="0.4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div
            className="rounded-3xl bg-slate-100 px-8 py-16 md:py-20 text-center"
            style={{
              backgroundImage: 'radial-gradient(circle, rgb(203 213 225 / 0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <h2 className="section-title">
              Stop Chasing Rent Manually
            </h2>
            <p className="mt-3 text-slate-500 max-w-lg mx-auto">
              Register your organization in minutes. Owners get full control; staff get scoped access;
              tenants pay and request maintenance from their phones.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="btn-primary btn-lg"
              >
                Create Free Organization
              </Link>
              <Link
                to="/login"
                className="btn-secondary btn-lg"
              >
                Manager Login
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Free plan includes 2 properties and 10 units. Tenants join via mobile invite only.
            </p>
          </div>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <PropizyLogo variant="light" />
              <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                Kenya-first SaaS for landlords, property managers, and caretakers, with M-PESA rent,
                multi-property oversight, and owner and staff governance without spreadsheet chaos.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Features', href: '#features', external: false },
                  { label: 'M-PESA payments', href: '#payments', external: false },
                  { label: 'Tenant onboarding', href: '#tenants', external: false },
                  { label: 'Create organization', href: '/register', external: false },
                ].map((item) => (
                  <li key={item.label}>
                    {item.href.startsWith('#') ? (
                      <a
                        href={item.href}
                        onClick={(event) => handleSectionLink(event, item.href)}
                        className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link to={item.href} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Account</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Manager login', href: '/login' },
                  { label: 'Register as owner', href: '/register' },
                  { label: 'How tenants join', href: '#tenants' },
                ].map((item) => (
                  <li key={item.label}>
                    <Link to={item.href} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                Tenants sign up through an invite link on the Propizy mobile app, not this web dashboard.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Get started</h4>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                Set up your organization, connect M-PESA when ready, and invite your first tenant.
              </p>
              <Link to="/register" className="btn-primary btn-md w-full text-center">
                Create organization
              </Link>
              <Link to="/login" className="btn-secondary btn-md w-full text-center mt-2">
                Sign in
              </Link>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 text-center sm:text-left">
              &copy; {new Date().getFullYear()} Propizy. Property management made easy.
            </p>
            <p className="text-xs text-slate-400 text-center sm:text-right">
              Web dashboard for managers &amp; owners · Mobile app for tenants
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
