const PATH_DESKTOP = "M 420 150 a 300 66 0 1 0 600 0 a 300 66 0 1 0 -600 0";
const PATH_MOBILE = "M 55 118 a 140 36 0 1 0 280 0 a 140 36 0 1 0 -280 0";

function Flower() {
  return (
    <g>
      <circle cx="0" cy="-7" r="5.5" fill="var(--golden)" />
      <circle cx="6.7" cy="-2.2" r="5.5" fill="var(--golden)" />
      <circle cx="4.1" cy="5.7" r="5.5" fill="var(--golden)" />
      <circle cx="-4.1" cy="5.7" r="5.5" fill="var(--golden)" />
      <circle cx="-6.7" cy="-2.2" r="5.5" fill="var(--golden)" />
      <circle r="3.5" fill="var(--golden-ink)" />
    </g>
  );
}

function Heart() {
  return <path d="M0 8 C -12 0 -10 -10 -4 -10 C -1 -10 0 -7 0 -6 C 0 -7 1 -10 4 -10 C 10 -10 12 0 0 8 Z" fill="var(--terracotta-light)" />;
}

function Leaf() {
  return (
    <g>
      <path d="M-9 6 C -9 -6 3 -11 10 -10 C 11 -2 5 9 -9 6 Z" fill="var(--sage-light)" />
      <path d="M-9 6 L 5 -5" stroke="var(--sage)" strokeWidth="1.4" />
    </g>
  );
}

function MemberDesktop({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + 45} rx="30" ry="5" fill="var(--sage-ink)" opacity="0.35" />
      <path d={`M${cx - 24} ${cy + 42} C ${cx - 24} ${cy + 2} ${cx + 24} ${cy + 2} ${cx + 24} ${cy + 42} Z`} fill={fill} />
      <circle cx={cx} cy={cy} r="15" fill={fill} />
      <path d={`M${cx - 7} ${cy} q 3 3 6 0 M${cx + 1} ${cy} q 3 3 6 0`} fill="none" stroke="var(--brown)" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** Compact figures for the 390×190 mobile composition. */
function MemberMobile({ cx, cy, headR, fill }: { cx: number; cy: number; headR: number; fill: string }) {
  const bodyTop = cy + headR * 0.85;
  const bodyBottom = cy + headR * 3.1;
  const bodyHalf = headR * 1.6;
  return (
    <g>
      <ellipse cx={cx} cy={bodyBottom + 2} rx={headR * 2} ry={headR * 0.24} fill="var(--sage-ink)" opacity="0.5" />
      <path d={`M${cx - bodyHalf} ${bodyBottom} C ${cx - bodyHalf} ${bodyTop} ${cx + bodyHalf} ${bodyTop} ${cx + bodyHalf} ${bodyBottom} Z`} fill={fill} />
      <circle cx={cx} cy={cy} r={headR} fill={fill} />
      <path
        d={`M${cx - headR * 0.47} ${cy} q ${headR * 0.2} ${headR * 0.2} ${headR * 0.4} 0 M${cx + headR * 0.07} ${cy} q ${headR * 0.2} ${headR * 0.2} ${headR * 0.4} 0`}
        fill="none"
        stroke="var(--brown)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </g>
  );
}

function MobileCircle() {
  return (
    <svg
      viewBox="0 0 390 190"
      className="block h-auto w-full max-w-full min-w-0"
      role="img"
      aria-label="Three members in a circle, passing a flower, a heart and a leaf to each other"
    >
      <defs>
        <radialGradient id="giving-circle-glow-mobile" cx="50%" cy="58%" r="45%">
          <stop offset="0" stopColor="#6E9579" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6E9579" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="195" cy="112" rx="185" ry="68" fill="url(#giving-circle-glow-mobile)" />
      <path
        d={PATH_MOBILE}
        fill="none"
        stroke="var(--sage-light)"
        strokeOpacity="0.7"
        strokeWidth="1.3"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <MemberMobile cx={73.8} cy={73.3} headR={9.3} fill="var(--golden)" />
      <MemberMobile cx={316.2} cy={73.3} headR={9.3} fill="var(--sage-light)" />
      <MemberMobile cx={195} cy={123} headR={10.8} fill="var(--terracotta-light)" />
      <g className="oka-tok-move">
        <g transform="scale(0.95)">
          <Flower />
        </g>
        <animateMotion dur="15s" begin="0s" repeatCount="indefinite" path={PATH_MOBILE} />
      </g>
      <g className="oka-tok-still" transform="translate(74 132) scale(0.95)">
        <Flower />
      </g>
      <g className="oka-tok-move">
        <g transform="scale(0.95)">
          <Heart />
        </g>
        <animateMotion dur="15s" begin="-5s" repeatCount="indefinite" path={PATH_MOBILE} />
      </g>
      <g className="oka-tok-still" transform="translate(316 132) scale(0.95)">
        <Heart />
      </g>
      <g className="oka-tok-move">
        <g transform="scale(0.95)">
          <Leaf />
        </g>
        <animateMotion dur="15s" begin="-10s" repeatCount="indefinite" path={PATH_MOBILE} />
      </g>
      <g className="oka-tok-still" transform="translate(195 78) scale(0.95)">
        <Leaf />
      </g>
    </svg>
  );
}

function DesktopCircle() {
  return (
    <svg
      viewBox="0 0 1440 280"
      preserveAspectRatio="xMidYMid slice"
      className="block h-[280px] w-full max-w-full min-w-0"
      role="img"
      aria-label="Three members in a circle, passing a flower, a heart and a leaf to each other"
    >
      <defs>
        <radialGradient id="giving-circle-glow" cx="50%" cy="55%" r="30%">
          <stop offset="0" stopColor="#6E9579" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6E9579" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="150" rx="420" ry="130" fill="url(#giving-circle-glow)" />
      <path
        d={PATH_DESKTOP}
        fill="none"
        stroke="var(--sage-light)"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeDasharray="2 9"
        strokeLinecap="round"
      />
      <MemberDesktop cx={460} cy={75} fill="var(--golden)" />
      <MemberDesktop cx={980} cy={75} fill="var(--sage-light)" />
      <MemberDesktop cx={720} cy={167} fill="var(--terracotta-light)" />
      <g className="oka-tok-move">
        <g transform="scale(1.5)">
          <Flower />
        </g>
        <animateMotion dur="15s" begin="0s" repeatCount="indefinite" path={PATH_DESKTOP} />
      </g>
      <g className="oka-tok-still" transform="translate(460 177) scale(1.5)">
        <Flower />
      </g>
      <g className="oka-tok-move">
        <g transform="scale(1.5)">
          <Heart />
        </g>
        <animateMotion dur="15s" begin="-5s" repeatCount="indefinite" path={PATH_DESKTOP} />
      </g>
      <g className="oka-tok-still" transform="translate(980 177) scale(1.5)">
        <Heart />
      </g>
      <g className="oka-tok-move">
        <g transform="scale(1.5)">
          <Leaf />
        </g>
        <animateMotion dur="15s" begin="-10s" repeatCount="indefinite" path={PATH_DESKTOP} />
      </g>
      <g className="oka-tok-still" transform="translate(720 78) scale(1.5)">
        <Leaf />
      </g>
    </svg>
  );
}

/** Three members passing a flower, a heart, and a leaf. Still tokens when motion is reduced. */
export function GivingCircle() {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="md:hidden">
        <MobileCircle />
      </div>
      <div className="hidden md:block">
        <DesktopCircle />
      </div>
    </div>
  );
}
