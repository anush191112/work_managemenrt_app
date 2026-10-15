import Image from "next/image";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <Image className={compact ? "brand-logo brand-logo-sidebar" : "brand-logo"} src="/stoneking-logo.jpg" alt="Stoneking" width={5298} height={2317} priority />;
}
