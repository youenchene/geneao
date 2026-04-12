/**
 * Inline SVG logo — a simple tree silhouette (genealogy theme).
 * Warm amber/brown palette to match the app's earthy design.
 */

interface Props {
  size?: number;
}

export default function Logo({ size = 32 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Geneao logo"
    >
      {/* Tree trunk */}
      <rect x="29" y="38" width="6" height="18" rx="1.5" fill="#92400e" />

      {/* Roots */}
      <path
        d="M29 52 C26 56, 22 58, 18 58"
        stroke="#92400e"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M35 52 C38 56, 42 58, 46 58"
        stroke="#92400e"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Canopy — layered circles for a full, rounded tree crown */}
      <circle cx="32" cy="22" r="14" fill="#b45309" />
      <circle cx="22" cy="26" r="10" fill="#b45309" />
      <circle cx="42" cy="26" r="10" fill="#b45309" />
      <circle cx="26" cy="16" r="9" fill="#d97706" />
      <circle cx="38" cy="16" r="9" fill="#d97706" />
      <circle cx="32" cy="12" r="8" fill="#f59e0b" />
    </svg>
  );
}
