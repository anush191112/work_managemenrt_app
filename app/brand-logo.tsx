export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <img className={compact ? "brand-logo brand-logo-compact" : "brand-logo"} src="/stoneking-logo.png" alt="Stoneking" />;
}
