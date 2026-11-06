/** Small original NHS-inspired decorative marks, not replacements for the official logo.
 * Kept intentionally quiet; each mark accompanies visible text or is aria-hidden.
 */
export type AtelierSymbolName = "skull" | "rose" | "key" | "spark";

export function AtelierSymbol({ name, size = 24 }: { name: AtelierSymbolName; size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "skull" && (
        <>
          <path d="M8 21v-3.2C5.8 15.6 6.1 11 8.3 8.2 10.3 5.6 13.2 4.7c2-.6 4.4-.6 6.5 0 3.5 1.1 6.3 4.4 6.5 8.2.1 2.2-.7 3.9-2.2 5.1V21c0 1.5-1.1 2.7-2.5 2.7H10.5C9.1 23.7 8 22.5 8 21Z" />
          <path d="M12 23.8v3.3m4-3.3v3.3m4-3.3v3.3M11 27.1h10" />
          <path d="M11.3 16.1c.7-1.1 2.1-1.1 2.8 0 .4.9-.2 1.9-1.4 1.9-1.3 0-1.9-1-1.4-1.9ZM17.9 16.1c.7-1.1 2.1-1.1 2.8 0 .4.9-.2 1.9-1.4 1.9-1.3 0-1.9-1-1.4-1.9Z" />
          <path d="m16 18.7-1.1 2h2.2l-1.1-2Z" />
          <path d="M9.8 11.5c1.1-1.4 2.4-2.1 3.9-2.2m4.6 0c1.4.1 2.9.8 3.9 2.2" strokeOpacity=".68" />
        </>
      )}
      {name === "rose" && (
        <>
          <path d="M16 22.2c-5.5-1.5-8.4-5-8.4-9.2 0-4.7 3.3-7.8 8.4-8.6 5.1.8 8.4 3.9 8.4 8.6 0 4.2-2.9 7.7-8.4 9.2Z" />
          <path d="M16 9.8c-2.3-2.2-5.4-.6-5.4 1.8 0 2.2 2.1 4 5.4 5 3.3-1 5.4-2.8 5.4-5 0-2.4-3.1-4-5.4-1.8Z" />
          <path d="M13.5 12.8c.4-.8 1.3-1.2 2.5-1.2 1.2 0 2.1.4 2.5 1.2M16 22.2V29m0-3.5c-2.7-2.6-4.7-2.1-6.6-1.4M16 26.5c2.4-2.2 4.5-2 6.5-1.5" />
        </>
      )}
      {name === "key" && (
        <>
          <circle cx="11" cy="11" r="6.1" />
          <circle cx="11" cy="11" r="2.3" strokeOpacity=".7" />
          <path d="m15.6 15.6 12 12M22 22l2.9-2.9M24.5 24.5l2.8-2.8" />
          <path d="M24.5 24.5 21.8 27" strokeOpacity=".55" />
        </>
      )}
      {name === "spark" && (
        <>
          <path d="M16 3.5 19.3 12.7 28.5 16l-9.2 3.3L16 28.5l-3.3-9.2L3.5 16l9.2-3.3L16 3.5Z" />
          <path d="M25.3 4.9v4.7m-2.3-2.35h4.6M5.2 23.7v4.2m-2.1-2.1h4.2" strokeOpacity=".55" />
        </>
      )}
    </svg>
  );
}
