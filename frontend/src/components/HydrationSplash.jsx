import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PropizyLogo from './PropizyLogo';

const MIN_VISIBLE_MS = 1100;
const EXIT_MS = 750;

function removeInitialSplash() {
  document.getElementById('initial-splash')?.remove();
}

export default function HydrationSplash({ children }) {
  const { loading } = useAuth();
  const [phase, setPhase] = useState('show'); // show | exit | done
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    removeInitialSplash();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'show' || !minElapsed || loading) return undefined;

    setPhase('exit');

    const timer = window.setTimeout(() => setPhase('done'), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, minElapsed, loading]);

  if (phase === 'done') return children;

  return (
    <>
      <div
        className={`hydration-splash ${phase === 'exit' ? 'hydration-splash--exit' : ''}`}
        aria-hidden={phase === 'exit'}
        role="presentation"
      >
        <div className="hydration-splash__glow" aria-hidden="true" />
        <div className={`hydration-splash__logo-wrap ${phase === 'exit' ? 'hydration-splash__logo-wrap--exit' : ''}`}>
          <PropizyLogo
            variant="light"
            size="splash"
            showWordmark
            className="hydration-splash__brand flex-col items-center gap-5"
          />
        </div>
      </div>
      <div className="hydration-splash__content" aria-hidden={phase === 'show'}>
        {children}
      </div>
    </>
  );
}
