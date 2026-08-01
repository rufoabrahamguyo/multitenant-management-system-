/**
 * Solid circular status signals - white glyph on purposeful color.
 * Use for operational UI (stats, alerts, occupancy), not decorative chrome.
 */

const TONES = {
  danger: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  success: 'bg-emerald-500 text-white',
  neutral: 'bg-slate-700 text-white',
  info: 'bg-sky-500 text-white',
  brand: 'bg-slate-900 text-white',
};

const SIZES = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-11 h-11',
};

const ICON_SIZES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-5 h-5',
};

function Glyph({ name, className }) {
  const props = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: '2.2',
    'aria-hidden': true,
  };

  switch (name) {
    case 'flame':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 22c4-3 6-6.5 6-10.5C18 6 14 3 12 2c-2 1-6 4-6 9.5C6 15.5 8 19 12 22z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c1.5-1.5 2.5-3.2 2.5-5.2 0-2.3-1.5-3.8-2.5-4.3-1 .5-2.5 2-2.5 4.3 0 2 1 3.7 2.5 5.2z" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 6H5a2 2 0 002 4M17 6h2a2 2 0 01-2 4" />
        </svg>
      );
    case 'trend-down':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l7 7 4-4 7 7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 17h7v-7" />
        </svg>
      );
    case 'trend-up':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l7-7 4 4 7-7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 7h7v7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'vacant':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      );
    case 'cash':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h3m6 0h3a1 1 0 001-1v-9"
          />
        </svg>
      );
    case 'doc':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'user':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'transfer':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function SignalIcon({
  name,
  tone = 'neutral',
  size = 'md',
  className = '',
  label,
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${TONES[tone] || TONES.neutral} ${SIZES[size] || SIZES.md} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Glyph name={name} className={ICON_SIZES[size] || ICON_SIZES.md} />
    </span>
  );
}

/** Compact status chip: signal + label */
export function StatusSignal({ status }) {
  const map = {
    occupied: { name: 'check', tone: 'success', label: 'Occupied' },
    vacant: { name: 'vacant', tone: 'warning', label: 'Vacant' },
    pending: { name: 'alert', tone: 'warning', label: 'Pending' },
    waitlisted: { name: 'clock', tone: 'warning', label: 'Waitlisted' },
    approved: { name: 'check', tone: 'info', label: 'Approved' },
    completed: { name: 'trophy', tone: 'success', label: 'Completed' },
    rejected: { name: 'trend-down', tone: 'danger', label: 'Rejected' },
    'in-progress': { name: 'wrench', tone: 'info', label: 'In progress' },
    resolved: { name: 'trophy', tone: 'success', label: 'Resolved' },
    overdue: { name: 'flame', tone: 'danger', label: 'Overdue' },
    critical: { name: 'flame', tone: 'danger', label: 'Critical' },
  };
  const cfg = map[status] || { name: 'alert', tone: 'neutral', label: status };
  return (
    <span className="inline-flex items-center gap-2">
      <SignalIcon name={cfg.name} tone={cfg.tone} size="sm" label={cfg.label} />
      <span className="text-xs font-medium text-slate-700 capitalize">{cfg.label}</span>
    </span>
  );
}
