/*
 * Step illustrations for the process rail: small drawn scenes in the
 * blueprint voice (hairline strokes, round caps, one gold accent, an
 * occasional green check). Each scene depicts its step's actual action,
 * never decoration. Pure SVG primitives, no client hooks; the few moving
 * details use the ps-anim-* classes in globals.css, which are inert under
 * prefers-reduced-motion.
 */

export type ArtName =
  | "order"
  | "brand-kit"
  | "delivery"
  | "scope"
  | "script"
  | "voice"
  | "production"
  | "review"
  | "footage"
  | "edit"
  | "publish";

const S = "var(--dim)"; /* structure strokes */
const F = "var(--hair)"; /* faint lines and skeleton bars */
const G = "var(--gold)"; /* the one accent */
const OK = "var(--green)"; /* checks only */

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label={title}
      className="h-auto w-full"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/* a small video-card: frame + play dot */
function Card({ x, y, w = 64, h = 44, accent = false }: { x: number; y: number; w?: number; h?: number; accent?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" stroke={accent ? G : S} strokeWidth="1.5" />
      <path
        d={`M${x + w / 2 - 4} ${y + h / 2 - 6} L${x + w / 2 + 6} ${y + h / 2} L${x + w / 2 - 4} ${y + h / 2 + 6} Z`}
        stroke={accent ? G : S}
        strokeWidth="1.5"
      />
    </g>
  );
}

const art: Record<ArtName, React.ReactNode> = {
  /* three cards in a row, the middle one picked: gold frame, price tag,
     cursor on it */
  order: (
    <>
      <Card x={34} y={40} />
      <Card x={128} y={34} w={72} h={50} accent />
      <Card x={230} y={40} />
      <rect x={182} y={26} width={34} height={16} rx="3" stroke={G} strokeWidth="1.5" />
      <path d="M188 34h22" stroke={G} strokeWidth="1.5" />
      <path className="ps-anim-nudge" d="M176 92l7 16 4-7 8-3z" stroke={S} strokeWidth="1.5" fill="var(--canvas)" />
      <path d="M34 108h252" stroke={F} strokeWidth="1" strokeDasharray="3 5" />
    </>
  ),

  /* drop zone taking the kit: logo mark, the three brand swatches, a
     progress bar filling */
  "brand-kit": (
    <>
      <rect x="34" y="28" width="252" height="66" rx="6" stroke={S} strokeWidth="1.5" strokeDasharray="5 5" />
      <circle cx="78" cy="61" r="14" stroke={G} strokeWidth="1.5" />
      <path d="M78 51v20M68 61h20" stroke={G} strokeWidth="1.5" />
      <rect x="118" y="50" width="12" height="12" rx="2" fill="var(--gold)" opacity="0.9" />
      <rect x="136" y="50" width="12" height="12" rx="2" fill="var(--green)" opacity="0.9" />
      <rect x="154" y="50" width="12" height="12" rx="2" fill="var(--blue)" opacity="0.9" />
      <rect x="118" y="68" width="110" height="6" rx="3" fill={F} />
      <path d="M240 74l10-13 10 13" stroke={S} strokeWidth="1.5" />
      <path d="M250 61v26" stroke={S} strokeWidth="1.5" />
      <rect x="34" y="108" width="252" height="5" rx="2.5" fill={F} />
      <rect className="ps-anim-grow" x="34" y="108" width="252" height="5" rx="2.5" fill="var(--gold)" opacity="0.85" />
    </>
  ),

  /* the finished video handed over: player, green check seal, down tray */
  delivery: (
    <>
      <rect x="70" y="26" width="128" height="82" rx="6" stroke={S} strokeWidth="1.5" />
      <path d="M124 55l24 12-24 12z" stroke={G} strokeWidth="1.5" />
      <path d="M70 92h128" stroke={F} strokeWidth="1" />
      <circle cx="232" cy="44" r="16" stroke={OK} strokeWidth="1.5" />
      <path className="ps-anim-draw" d="M225 44l5 5 10-10" stroke={OK} strokeWidth="1.8" />
      <path d="M232 78v26M222 94l10 10 10-10" stroke={S} strokeWidth="1.5" />
      <path d="M212 114h40" stroke={S} strokeWidth="1.5" />
    </>
  ),

  /* the scoping call: two speech bubbles, the target being set */
  scope: (
    <>
      <path d="M40 36h96a6 6 0 016 6v22a6 6 0 01-6 6H62l-12 12V70h-10a6 6 0 01-6-6V42a6 6 0 016-6z" stroke={S} strokeWidth="1.5" />
      <path d="M56 50h64M56 60h40" stroke={F} strokeWidth="1.5" />
      <path d="M280 62h-96a6 6 0 00-6 6v22a6 6 0 006 6h74l12 12V96h10a6 6 0 006-6V68a6 6 0 00-6-6z" stroke={G} strokeWidth="1.5" />
      <circle className="ps-anim-pulse" cx="206" cy="78" r="2.5" fill="var(--gold)" />
      <circle className="ps-anim-pulse2" cx="220" cy="78" r="2.5" fill="var(--gold)" />
      <circle className="ps-anim-pulse3" cx="234" cy="78" r="2.5" fill="var(--gold)" />
      <circle cx="252" cy="34" r="14" stroke={S} strokeWidth="1.5" />
      <circle cx="252" cy="34" r="7" stroke={S} strokeWidth="1.5" />
      <circle cx="252" cy="34" r="1.8" fill="var(--gold)" />
    </>
  ),

  /* the script taking shape: page, lines, the pen still writing one */
  script: (
    <>
      <rect x="96" y="18" width="128" height="104" rx="6" stroke={S} strokeWidth="1.5" />
      <path d="M112 40h96M112 56h96M112 72h72" stroke={F} strokeWidth="1.5" />
      <path className="ps-anim-dash" d="M112 88h56" stroke={G} strokeWidth="1.8" strokeDasharray="56" />
      <path d="M180 96l14-14 6 6-14 14-8 2z" stroke={G} strokeWidth="1.5" />
    </>
  ),

  /* the voice: mic between breathing waveform bars */
  voice: (
    <>
      <rect x="148" y="30" width="24" height="42" rx="12" stroke={G} strokeWidth="1.5" />
      <path d="M136 62a24 24 0 0048 0M160 86v18M146 104h28" stroke={S} strokeWidth="1.5" />
      {[
        [64, 18], [80, 30], [96, 22], [112, 34],
        [208, 34], [224, 22], [240, 30], [256, 18],
      ].map(([x, h], i) => (
        <path
          key={x}
          className={`ps-anim-bar${(i % 3) + 1}`}
          d={`M${x} ${70 - h / 2}v${h}`}
          stroke={S}
          strokeWidth="2.5"
        />
      ))}
    </>
  ),

  /* production: the timeline under the clapper, playhead moving */
  production: (
    <>
      <path d="M60 26h72l-10 16H50z" stroke={S} strokeWidth="1.5" />
      <path d="M78 26l-8 16M96 26l-8 16M114 26l-8 16" stroke={S} strokeWidth="1.2" />
      <rect x="50" y="42" width="82" height="24" rx="3" stroke={S} strokeWidth="1.5" />
      <rect x="50" y="84" width="220" height="12" rx="2" stroke={F} strokeWidth="1.2" />
      <rect x="50" y="102" width="220" height="12" rx="2" stroke={F} strokeWidth="1.2" />
      <rect x="70" y="84" width="52" height="12" rx="2" fill={F} />
      <rect x="150" y="102" width="64" height="12" rx="2" fill={F} />
      <path d="M182 84l6-8 6 8-6 8z" fill="var(--gold)" />
      <path className="ps-anim-slide" d="M120 76v44" stroke={G} strokeWidth="1.8" />
    </>
  ),

  /* review: the cut playing with comment pins landing on it */
  review: (
    <>
      <rect x="70" y="26" width="140" height="88" rx="6" stroke={S} strokeWidth="1.5" />
      <path d="M128 60l22 10-22 10z" stroke={S} strokeWidth="1.5" />
      <path d="M70 100h140" stroke={F} strokeWidth="1" />
      <path d="M86 100l30-1" stroke={G} strokeWidth="2" />
      <g className="ps-anim-pop">
        <circle cx="238" cy="46" r="12" stroke={G} strokeWidth="1.5" />
        <path d="M238 40v8M238 52h.01" stroke={G} strokeWidth="1.8" />
      </g>
      <g className="ps-anim-pop2">
        <circle cx="262" cy="86" r="12" stroke={OK} strokeWidth="1.5" />
        <path className="ps-anim-draw" d="M257 86l4 4 7-8" stroke={OK} strokeWidth="1.8" />
      </g>
    </>
  ),

  /* raw footage moving into the shared folder */
  footage: (
    <>
      <path d="M52 44h56l10 12h84a8 8 0 018 8v40a8 8 0 01-8 8H52a8 8 0 01-8-8V52a8 8 0 018-8z" stroke={G} strokeWidth="1.5" />
      <rect x="238" y="34" width="40" height="26" rx="3" stroke={S} strokeWidth="1.5" />
      <rect x="246" y="70" width="40" height="26" rx="3" stroke={S} strokeWidth="1.5" />
      <path d="M238 47l-16 15M246 83l-24 9" stroke={F} strokeWidth="1.2" />
      <path className="ps-anim-dash" d="M232 62c-14 8-28 12-44 14" stroke={S} strokeWidth="1.5" strokeDasharray="4 5" />
      <path d="M188 72l-8 6 10 2" stroke={S} strokeWidth="1.5" />
    </>
  ),

  /* the edit: tracks trimmed at the razor line */
  edit: (
    <>
      <rect x="44" y="36" width="232" height="14" rx="2" stroke={F} strokeWidth="1.2" />
      <rect x="44" y="60" width="232" height="14" rx="2" stroke={F} strokeWidth="1.2" />
      <rect x="44" y="84" width="232" height="14" rx="2" stroke={F} strokeWidth="1.2" />
      <rect x="58" y="36" width="66" height="14" rx="2" fill={F} />
      <rect x="150" y="60" width="80" height="14" rx="2" fill={F} />
      <rect x="88" y="84" width="52" height="14" rx="2" fill={F} />
      <path className="ps-anim-blink" d="M160 26v84" stroke={G} strokeWidth="1.8" />
      <path d="M154 114l6 8 6-8" stroke={G} strokeWidth="1.5" />
      <circle cx="150" cy="26" r="1.8" fill="var(--gold)" />
      <circle cx="170" cy="26" r="1.8" fill="var(--gold)" />
    </>
  ),

  /* publish on schedule: the calendar week with the slot checked */
  publish: (
    <>
      <rect x="86" y="24" width="148" height="96" rx="6" stroke={S} strokeWidth="1.5" />
      <path d="M86 48h148" stroke={S} strokeWidth="1.2" />
      <path d="M116 16v16M204 16v16" stroke={S} strokeWidth="1.5" />
      {[112, 138, 164, 190, 216].map((x) => (
        <path key={x} d={`M${x} 62v0.01M${x} 84v0.01M${x} 104v0.01`} stroke={F} strokeWidth="4" />
      ))}
      <circle cx="164" cy="84" r="13" stroke={OK} strokeWidth="1.5" />
      <path className="ps-anim-draw" d="M158 84l4 4 8-9" stroke={OK} strokeWidth="1.8" />
      <path className="ps-anim-dash" d="M244 96c22-6 34-20 38-40" stroke={G} strokeWidth="1.5" strokeDasharray="4 5" />
      <path d="M278 66l4-12-12 4" stroke={G} strokeWidth="1.5" />
    </>
  ),
};

const titles: Record<ArtName, string> = {
  order: "Picking a video and checking out",
  "brand-kit": "Uploading the brand kit",
  delivery: "The finished video, delivered",
  scope: "Scoping the project together",
  script: "The script being written",
  voice: "Recording the voiceover",
  production: "Production on the timeline",
  review: "Review notes on the cut",
  footage: "Raw footage arriving in the shared folder",
  edit: "The edit, cut on the timeline",
  publish: "Published on schedule",
};

export function ProcessArt({ name }: { name: ArtName }) {
  return <Shell title={titles[name]}>{art[name]}</Shell>;
}
