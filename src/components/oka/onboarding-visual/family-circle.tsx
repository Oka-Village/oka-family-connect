const SEATS = [
  { letter: "S", className: "left-[40.5%] top-0 size-[19%] bg-golden text-brown text-xl" },
  { letter: "K", className: "left-[77%] top-[21%] size-[17%] bg-sage-light text-sage-ink text-lg" },
  { letter: "M", className: "left-[77%] top-[62%] size-[17%] bg-terracotta-light text-brown text-lg" },
  { letter: "C", className: "left-[40.5%] top-[81%] size-[19%] bg-sand text-foreground text-xl" },
  { letter: "L", className: "left-[6%] top-[62%] size-[17%] bg-sage-light text-sage-ink text-lg" },
] as const;

/** The landing circle: five members and one open seat. No data, no fetches. */
export function FamilyCircle() {
  return (
    <div className="relative aspect-square w-full max-w-[300px] md:max-w-[460px]" aria-hidden="true">
      <span className="absolute inset-[7.5%] rounded-full border border-dashed border-golden" />
      <span className="absolute inset-[30%] rounded-full bg-terracotta-tint" />
      {SEATS.map((seat) => (
        <span
          key={seat.letter}
          className={`absolute flex items-center justify-center rounded-full font-semibold ${seat.className}`}
        >
          {seat.letter}
        </span>
      ))}
      <span className="oka-seat absolute left-[6%] top-[21%] flex size-[17%] items-center justify-center rounded-full border border-dashed border-terracotta text-[15px] font-semibold text-terracotta">
        you
      </span>
      <span className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center text-[44px] text-terracotta">
        <span className="oka-dad" role="img" aria-label="Welcome home">
          <span className="arm-l">╰</span>
          <span className="face">(´︶`)</span>
          <span className="arm-r">╯</span>
          <span className="heart">♡</span>
        </span>
      </span>
    </div>
  );
}
