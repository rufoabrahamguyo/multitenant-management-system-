export const LOGO_SRC = '/propizy-logo.png';

const imageSizes = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  splash: 'h-40 sm:h-44',
};

function resolveSize(className, size) {
  if (size) return size;
  if (className.includes('text-3xl')) return 'lg';
  if (className.includes('text-xl')) return 'md';
  return 'md';
}

export default function PropizyLogo({
  variant = 'dark',
  className = '',
  showTagline = false,
  size,
  showWordmark = true,
  imgClassName = '',
}) {
  const imageSize = resolveSize(className, size);
  const wordmarkClass = variant === 'light' ? 'text-slate-900' : 'text-white';
  const imageVariantClass = variant === 'light' ? '' : 'brightness-0 invert';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src={LOGO_SRC}
        alt="Propizy"
        className={`${imageSizes[imageSize] || imageSizes.md} w-auto object-contain shrink-0 ${imageVariantClass} ${imgClassName}`}
      />
      {showWordmark && (
        <div>
          <span className={`font-bold text-lg tracking-tight ${wordmarkClass}`}>Propizy</span>
          {showTagline && (
            <p className="text-[10px] font-semibold text-slate-400 tracking-[0.18em] uppercase leading-tight">
              Premium Management
            </p>
          )}
        </div>
      )}
    </div>
  );
}
