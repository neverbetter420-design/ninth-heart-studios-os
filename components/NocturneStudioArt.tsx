/** Decorative studio drapery, never a substitute for the NHS heart/key logo. */
export function NocturneStudioArt() {
  return (
    <div className="nocturne-studio-art" aria-hidden="true">
      <svg viewBox="0 0 600 430" fill="none" focusable="false">
        <defs>
          <linearGradient id="nocturne-silk" x1="145" y1="60" x2="489" y2="359" gradientUnits="userSpaceOnUse">
            <stop stopColor="#121017" />
            <stop offset=".28" stopColor="#35263f" />
            <stop offset=".48" stopColor="#897084" />
            <stop offset=".55" stopColor="#45324c" />
            <stop offset=".76" stopColor="#211827" />
            <stop offset="1" stopColor="#0c0b10" />
          </linearGradient>
          <linearGradient id="nocturne-edge" x1="120" y1="80" x2="484" y2="360" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c2a48c" stopOpacity="0" />
            <stop offset=".4" stopColor="#c2a48c" stopOpacity=".65" />
            <stop offset="1" stopColor="#b196ba" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nocturne-fold" x1="240" y1="150" x2="390" y2="345" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9d809e" stopOpacity=".6" />
            <stop offset=".38" stopColor="#402944" />
            <stop offset="1" stopColor="#100d15" />
          </linearGradient>
          <radialGradient id="nocturne-halo">
            <stop stopColor="#78517f" stopOpacity=".25" />
            <stop offset="1" stopColor="#78517f" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="340" cy="210" rx="260" ry="210" fill="url(#nocturne-halo)" />
        <path d="M132 61C234 140 328 19 420 71C527 133 396 220 479 292C513 322 542 332 569 351C467 430 322 404 218 339C132 285 270 204 194 133C170 111 146 101 132 61Z" fill="url(#nocturne-silk)" />
        <path d="M132 61C234 140 328 19 420 71C527 133 396 220 479 292C513 322 542 332 569 351" stroke="url(#nocturne-edge)" strokeWidth="1.2" />
        <path d="M420 71C365 123 468 178 368 227C281 270 266 318 347 384C286 374 250 359 218 339C132 285 270 204 194 133C271 225 348 139 420 71Z" fill="url(#nocturne-fold)" />
        <path d="M420 71C365 123 468 178 368 227C281 270 266 318 347 384" stroke="url(#nocturne-edge)" />
        <path d="M197 134C265 200 291 144 349 117M226 335C235 285 361 285 368 227M344 381C410 396 485 381 538 355" stroke="#b695b3" strokeOpacity=".18" strokeWidth=".75" />
      </svg>
      <span className="nocturne-art-caption">The art of moving forward.</span>
    </div>
  );
}
