/** Avatar real optimizado para superficies pequeñas y pantallas de alta densidad. */
export function BarbaraAvatar({ className = "" }: { className?: string }) {
  return (
    <span className={`barbara-avatar-vector ${className}`.trim()} aria-hidden="true">
      <img src="/assets/barbara/avatar-mini.webp" alt="" width="256" height="256" decoding="async" />
    </span>
  );
}
