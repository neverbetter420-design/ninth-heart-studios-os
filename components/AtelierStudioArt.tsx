/** Quiet decorative ribbon, unrelated to the protected NHS logo geometry. */
export function AtelierStudioArt() {
  return (
    <div className="atelier-studio-art" aria-hidden="true">
      <svg viewBox="0 0 500 350" fill="none" focusable="false">
        <defs>
          <linearGradient id="atelier-ribbon" x1="180" y1="40" x2="400" y2="315" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8ddd2" stopOpacity=".3" />
            <stop offset=".35" stopColor="#d2bfb5" />
            <stop offset=".5" stopColor="#eee5de" />
            <stop offset=".7" stopColor="#b8a1b2" />
            <stop offset="1" stopColor="#e4d6d3" stopOpacity=".1" />
          </linearGradient>
          <linearGradient id="atelier-rim" x1="140" y1="30" x2="410" y2="320" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a28a78" stopOpacity="0" />
            <stop offset=".45" stopColor="#a28a78" stopOpacity=".6" />
            <stop offset="1" stopColor="#a28a78" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M98 50C207 122 284 18 365 67C467 130 300 171 371 242C412 282 447 288 470 302C373 353 242 322 194 268C145 212 272 179 192 115C154 85 120 89 98 50Z" fill="url(#atelier-ribbon)" />
        <path d="M98 50C207 122 284 18 365 67C467 130 300 171 371 242C412 282 447 288 470 302M365 67C298 120 381 148 290 201C224 240 218 273 278 315" stroke="url(#atelier-rim)" />
      </svg>
      <span>A collaboration, beautifully considered.</span>
    </div>
  );
}
