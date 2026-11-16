const PATH = "M 420 150 a 300 66 0 1 0 600 0 a 300 66 0 1 0 -600 0";

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

function Member({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + 45} rx="30" ry="5" fill="var(--sage-ink)" opacity="0.35" />
      <path d={`M${cx - 24} ${cy + 42} C ${cx - 24} ${cy + 2} ${cx + 24} ${cy + 2} ${cx + 24} ${cy + 42} Z`} fill={fill} />
      <circle cx={cx} cy={cy} r="15" fill={fill} />
      <path d={`M${cx - 7} ${cy} q 3 3 6 0 M${cx + 1} ${cy} q 3 3 6 0`} fill="none" stroke="var(--brown)" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** Three members passing a flower, a heart, and a leaf. Still tokens when motion is reduced. */
export function GivingCircle() {
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" className="block h-[190px] w-full md:h-[280px]" role="img" aria-label="Three members in a circle, passing a flower, a heart and a leaf to each other">
      <ellipse cx="720" cy="150" rx="420" ry="130" fill="var(--sage-light)" opacity="0.35" />
      <path d={PATH} fill="none" stroke="var(--sage-light)" strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
      <Member cx={460} cy={75} fill="var(--golden)" />
      <Member cx={980} cy={75} fill="var(--sage-light)" />
      <Member cx={720} cy={167} fill="var(--terracotta-light)" />
      <g className="oka-tok-move">
        <g transform="scale(1.5)"><Flower /></g>
        <animateMotion dur="15s" begin="0s" repeatCount="indefinite" path={PATH} />
      </g>
      <g className="oka-tok-still" transform="translate(460 177) scale(1.5)"><Flower /></g>
      <g className="oka-tok-move">
        <g transform="scale(1.5)"><Heart /></g>
        <animateMotion dur="15s" begin="-5s" repeatCount="indefinite" path={PATH} />
      </g>
      <g className="oka-tok-still" transform="translate(980 177) scale(1.5)"><Heart /></g>
      <g className="oka-tok-move">
        <g transform="scale(1.5)"><Leaf /></g>
        <animateMotion dur="15s" begin="-10s" repeatCount="indefinite" path={PATH} />
      </g>
      <g className="oka-tok-still" transform="translate(720 78) scale(1.5)"><Leaf /></g>
    </svg>
  );
}
