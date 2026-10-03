export type Moment = { id: string; image: string; line: string; sub: string; alt: string };

// Open-ended list: add new moments here. Swap .svg for .webp/.png when final art arrives.
export const MOMENTS: Moment[] = [
  { id: "grass", image: "/moments/01-on-the-grass.svg", line: "Sitting on the grass, with nowhere else to be.", sub: "Some of the best plans are no plans at all.", alt: "Friends sitting together on a blanket in the grass" },
  { id: "singing", image: "/moments/02-singing-together.svg", line: "Some songs only make sense with more voices.", sub: "Thank you for adding yours.", alt: "A small group singing together, one with a guitar" },
  { id: "seed", image: "/moments/03-seed-to-flower.svg", line: "What we plant together takes its time.", sub: "And then, one morning, it blooms.", alt: "A seed, a sprout and a flower in a row" },
  { id: "table", image: "/moments/04-a-longer-table.svg", line: "A table grows longer when friends arrive.", sub: "There is always room for one more chair.", alt: "Friends at a long table under string lights" },
  { id: "walk", image: "/moments/05-walking-the-long-way.svg", line: "The long way is better with someone beside you.", sub: "No map needed, only good company.", alt: "Two people walking a winding path through hills" },
  { id: "tea", image: "/moments/06-tea-for-two.svg", line: "Two cups of tea and nowhere to hurry.", sub: "The best conversations never watch the clock.", alt: "Two people sharing tea by a window" },
  { id: "fire", image: "/moments/07-around-the-fire.svg", line: "The fire is warmer with more of us around it.", sub: "Pull up a log. There is room.", alt: "Friends sitting around a small campfire" },
  { id: "door", image: "/moments/08-a-door-left-open.svg", line: "A light left on, a door left open.", sub: "Somewhere in the world, someone is expecting you.", alt: "A guest arriving at a house with a lit open door" },
  { id: "lemons", image: "/moments/09-picking-lemons.svg", line: "One for you, one for me, one for the neighbours.", sub: "Abundance is better when it is shared.", alt: "Two people picking lemons into a basket" },
];
