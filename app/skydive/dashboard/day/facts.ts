/**
 * Skydiving history & fun facts for the day-detail page. If the selected date
 * matches a real dated event (keyed "MM-DD"), that wins; otherwise a generic
 * fact rotates by day-of-year so it changes daily but stays stable within a day.
 */

export interface SkyFact {
  title: string;
  text: string;
}

const DATED: Record<string, SkyFact> = {
  "03-01": {
    title: "This day in skydiving history — 1912",
    text: "Captain Albert Berry made the first parachute jump from a moving airplane, leaping from a Benoist pusher biplane over Jefferson Barracks, Missouri.",
  },
  "04-28": {
    title: "This day in skydiving history — 1919",
    text: "Leslie Irvin made the first premeditated free-fall jump using a manually operated ripcord — proving a jumper could fall freely, stay conscious, and deploy safely.",
  },
  "06-21": {
    title: "This day in skydiving history — 1913",
    text: 'Eighteen-year-old Georgia "Tiny" Broadwick became the first woman to parachute from an airplane, over Los Angeles.',
  },
  "07-30": {
    title: "This day in skydiving history — 2016",
    text: "Luke Aikins jumped from 25,000 ft with no parachute or wingsuit and landed safely in a 100×100 ft net in California — the first person ever to do so.",
  },
  "08-16": {
    title: "This day in skydiving history — 1960",
    text: "Col. Joseph Kittinger stepped from the Excelsior III balloon gondola at 102,800 ft. His freefall record stood for 52 years.",
  },
  "10-14": {
    title: "This day in skydiving history — 2012",
    text: "Felix Baumgartner jumped from roughly 128,000 ft for Red Bull Stratos and became the first skydiver to break the sound barrier — 65 years to the day after Chuck Yeager first did it in an airplane.",
  },
  "10-22": {
    title: "This day in skydiving history — 1797",
    text: "André-Jacques Garnerin made the first true parachute descent, cutting away from a hydrogen balloon about 3,200 ft over Paris beneath a silk canopy.",
  },
  "10-24": {
    title: "This day in skydiving history — 2014",
    text: "Alan Eustace set the still-standing highest-altitude jump record, falling from 135,890 ft in a self-contained spacesuit.",
  },
};

const GENERIC: SkyFact[] = [
  {
    title: "Skydiving fact of the day",
    text: "Belly-to-earth terminal velocity is about 120 mph. Diving head-down, experienced jumpers reach 150–180 mph.",
  },
  {
    title: "Skydiving fact of the day",
    text: "From a typical 13,500 ft exit, you get roughly 60 seconds of freefall before deploying around 5,000 ft.",
  },
  {
    title: "Skydiving fact of the day",
    text: "Leonardo da Vinci sketched a pyramid-shaped parachute in 1485. In 2000, skydiver Adrian Nicholas built it to spec and rode it down safely.",
  },
  {
    title: "Skydiving fact of the day",
    text: "Modern 'square' canopies are ram-air inflatable wings — they glide and flare for soft stand-up landings, unlike the round parachutes of early jumping.",
  },
  {
    title: "Skydiving fact of the day",
    text: "Reserve parachutes must be inspected and repacked by a certificated rigger on a fixed schedule, whether or not they've ever been used.",
  },
  {
    title: "Skydiving fact of the day",
    text: "An AAD (automatic activation device) constantly measures altitude and descent rate, and fires the reserve automatically if a jumper passes its activation altitude too fast.",
  },
  {
    title: "Skydiving fact of the day",
    text: "The largest freefall formation ever built was a 400-way, flown over Udon Thani, Thailand in 2006.",
  },
  {
    title: "Skydiving fact of the day",
    text: "The word parachute comes from the French: para (protect against) + chute (fall). Literally, 'that which protects against a fall.'",
  },
  {
    title: "Skydiving fact of the day",
    text: "Skydiving is a visual flight activity — jumpers are required to stay clear of clouds, which is why ceiling and cloud cover can ground an otherwise calm day.",
  },
  {
    title: "Skydiving fact of the day",
    text: "Freefall through rain stings at 120 mph — drops hit like gravel. One more reason precip chance is a real go/no-go factor.",
  },
];

function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(
    (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000
  );
}

export function factFor(dateKey: string): SkyFact {
  const md = dateKey.slice(5);
  if (DATED[md]) return DATED[md];
  return GENERIC[dayOfYear(dateKey) % GENERIC.length];
}
