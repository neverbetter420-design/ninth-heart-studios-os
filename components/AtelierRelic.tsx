/** Distinct etched relics for the NHS atmosphere. Never the NHS logo.
 * All instances are ornamental, ignored by assistive technologies and by pointer input.
 */
export type AtelierRelicName = "rose" | "skull" | "key";

export function AtelierRelic({ name, size = 120 }: { name: AtelierRelicName; size?: number }) {
  return (
    <svg className={`nhs-relic-art nhs-relic-art--${name}`} width={size} height={Math.round(size * 1.08)}
      viewBox="0 0 180 194" fill="none" stroke="currentColor" strokeWidth="2.3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === "rose" && (
        <>
          <path d="M90 109c-33-3-59-23-57-55 0-20 13-35 34-37C81 3 105 4 119 17c23 1 40 22 37 45-2 27-27 44-66 47Z" fill="currentColor" fillOpacity=".085" />
          <path d="M90 102C59 95 46 75 51 54c-3-18 10-34 27-34 15-12 33-7 42 6 24 3 30 30 15 44-4 20-21 29-45 32Z"/>
          <path d="M91 91c-24-5-30-24-18-37-4-16 9-25 20-20 15-7 28 5 24 19 8 15-5 35-26 38Z" fill="currentColor" fillOpacity=".14"/>
          <path d="M70 55q7-23 27-12 15 5 7 20-8 9-19 1-4-11 9-14m-38 22q16 2 27 18m46-31q-7 26-30 31M88 15q7 11 4 23" />
          <path d="M90 110q8 42 0 80m1-53q-27-34-48-24 9 31 48 33m-2 17q31-37 52-28-11 33-52 36" />
          <path d="M46 115q24 0 38 25M139 136q-27 3-45 28m-26-13q-18-3-26 13m69 10q22 3 29-12" strokeWidth="1.5" strokeOpacity=".65"/>
          <path d="M30 45q-14-12-7-26m132 18q17-13 15-29M24 94q-15 1-19 14m153-4q17 2 19 20" strokeWidth="1.2" strokeOpacity=".48"/>
        </>
      )}
      {name === "skull" && (
        <>
          <path d="M45 94c-9-15-11-32-8-48C44 19 62 7 91 7c32 0 54 19 55 53 1 13-2 27-10 38l-8 19v23l-10 11H66l-12-11v-24Z" fill="currentColor" fillOpacity=".085"/>
          <path d="M50 91c-5-15-7-31-3-43C54 26 68 18 91 18c22 0 41 17 45 40 2 12 0 25-6 36m-77 19-11-8q-7-11 0-20l8-2m82 30 10-8q8-11 1-20l-8-2"/>
          <path d="M59 79q15-20 29-1 5 18-12 25-19 4-17-24Zm36-1q16-20 31 0 3 24-17 25-17-7-14-25Z" fill="currentColor" fillOpacity=".27"/>
          <path d="m92 104-9 16q9 6 18 0Z" fill="currentColor" fillOpacity=".25"/>
          <path d="M67 131q24 7 49 0m-49 8q23 9 49 0m-42 3v12m13-10v13m13-13v13m12-15v12M60 63q11-12 26-8m13 0q15-3 27 9" strokeWidth="1.8"/>
          <path d="M72 150q-7 15 2 24l15 10 16-10q10-10 2-24m-37 22q-19 4-24-14m68 14q20 3 24-15" strokeOpacity=".7"/>
          <path d="M34 52q-18 0-19-19m21-2Q17 29 23 13m123 17q19-2 19-19m-18 42q19 0 20-17" strokeWidth="1.4" strokeOpacity=".6"/>
          <path d="M90 4v-3m-23 8-4-6m50 6 4-6M25 126l-12 12m144-12 12 12" strokeWidth="1.3" strokeOpacity=".5"/>
        </>
      )}
      {name === "key" && (
        <>
          <circle cx="61" cy="55" r="37" fill="currentColor" fillOpacity=".075"/>
          <circle cx="61" cy="55" r="28" strokeWidth="2.7"/>
          <circle cx="61" cy="55" r="13" fill="currentColor" fillOpacity=".12"/>
          <path d="M61 18V6m0 98v-9M24 55H11m100 0h-12M34 28l-9-9m72 72-9-9M34 82l-9 9m72-72-9 9" strokeWidth="1.5"/>
          <path d="M61 8q-10-12-19 0m38 0q-9-12-19 0M32 21q-14-3-15 12m1 43q-3 15 15 16M89 21q16-3 17 13m-1 42q4 17-16 17" strokeOpacity=".75"/>
          <path d="m85 81 65 65m-57-57 56 56m-64-64 9 9" strokeWidth="6"/>
          <path d="m145 140 22-3 3 17-13 0 3 11-13 12-15-15m-1-21 11 11 10-2m-19 13 12-6" strokeWidth="3" fill="currentColor" fillOpacity=".09"/>
          <path d="m111 108 7-13m8 28 14-6m-24 1 10-19" strokeWidth="1.5"/>
          <path d="M48 49q7-9 16 0 8 9-1 16-10 7-17-5" strokeWidth="1.4"/>
        </>
      )}
    </svg>
  );
}

/** Shared, understated corner relics make every client room feel related. */
export function ClientRoomRelics() {
  return (
    <div className="nhs-client-room-relics" aria-hidden="true">
      <span className="nhs-client-room-relic nhs-client-room-relic--rose"><AtelierRelic name="rose" size={104}/></span>
      <span className="nhs-client-room-relic nhs-client-room-relic--skull"><AtelierRelic name="skull" size={81}/></span>
      <span className="nhs-client-room-relic nhs-client-room-relic--key"><AtelierRelic name="key" size={89}/></span>
    </div>
  );
}
