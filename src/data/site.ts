// Everything on the site that isn't a markdown file lives here.

export const links = {
  github: "https://github.com/rohanthmarem",
  x: "https://twitter.com/rohanthmarem",
  email: "mailto:hello@rohanth.com",
  emailText: "hello@rohanth.com",
  substack: "https://rohanth.substack.com/",
  beli: "https://beliapp.co/app/rohanth",
  strava: "https://www.strava.com/activities/18363105986",
  strava2: "https://strava.app.link/eXDQvZXJb7b",
  tbc: "https://www.teenbuilders.club",
  repo: "https://github.com/rohanthmarem/rohanth-site",
};

export const nav = [
  { key: "projects", href: "/projects" },
  { key: "writing", href: "/writing" },
  { key: "inspiration", href: "/inspiration" },
] as const;

/** Org marks shown inline in the homepage about. Swap the SVGs for real logos. */
export const orgs = {
  uwaterloo: { name: "uwaterloo", href: "https://uwaterloo.ca" },
  phoebe: { name: "phoebe", href: undefined },
  extrian: { name: "extrian", href: undefined },
  tbc: { name: "teen builders club", href: links.tbc },
} as const;

/** Which hand-drawn card illustration (src/components/InspoArt.astro) each inspiration uses. */
export type InspoArtId = "f1" | "builder" | "network" | "shannon" | "tennis" | "superlinear" | "gears" | "film" | "imagination" | "avatar";

export const inspiration: Record<"people" | "readings" | "media", { name: string; art: InspoArtId; why: string; by?: string; kind?: string }[]> = {
  people: [
    { name: "James Vowles", art: "f1", why: "Watching him turn Williams around has been super cool. He's big on breaking the habit of doing the same thing just because it works, not stressing about failure as long as things are getting better, and owning your mistakes so everyone learns from them. One line of his stuck with me: \"what you've done yesterday is now not good enough. what you're gonna do today will not be good enough tomorrow.\"" },
    { name: "Daniel Dalen", art: "builder", why: "His lessons about building a business and the public documentation of his journey have been incredibly insightful. His approach to sharing his advice and being vulnerable about his experiences has taught me the value of transparency and authenticity in entrepreneurship." },
    { name: "Andrej Karpathy", art: "network", why: "His ability to explain complex AI concepts clearly and his work on ML have had me hooked on the field." },
  ],
  readings: [
    { name: "A Mathematical Theory of Communication", art: "shannon", by: "C.E. Shannon", kind: "paper", why: "This paper was super interesting to read; I barely understood it but my biggest takeaway was the relationship between information and noise (or entropy). And that no communication system can be perfect, but we can design systems that are robust to noise." },
    { name: "The Inner Game of Tennis", art: "tennis", by: "W. Timothy Gallwey", kind: "book", why: "Gallwey splits you into Self 1, the voice that judges and overthinks, and Self 2, the body that already knows what to do. Karate taught me the same thing the long way: I didn't win a medal until my ~20th tournament. Dwelling on the last loss or catastrophizing about the next opponent just costs you on the mat. Feel it, let it go, trust the training, and get back out there." },
    { name: "Superlinear Returns", art: "superlinear", by: "Paul Graham", kind: "essay", why: "Returns for performance aren't linear. Being a bit better doesn't get you a bit more, it gets you way more, because things compound. It made me realize how expensive \"good enough\" is: settling for the floor because the ceiling feels so high. Most of the time that's just fear in disguise. Better to bet on yourself and go after the ambitious thing you're actually curious about." },
    { name: "The Educated Imagination", art: "imagination", by: "Northrop Frye", kind: "book", why: "Read it for school and it stuck way more than I expected. Frye's point is that imagination is a muscle, and if you're not using it, it fades. That's basically what I was getting at in vibecoding sucks: lean on AI for everything and the thing you lose is the ability to think for yourself. He also made me notice that every ad, speech or pitch is rhetoric, never the naked truth." },
  ],
  media: [
    { name: "Stuff Made Here", art: "gears", kind: "youtube", why: "Shane's engineering projects are incredible examples of creative problem-solving. Also his warnings and crashouts about integration hell are so valid, especially as I ran into it with my own projects." },
    { name: "Avatar: The Last Airbender", art: "avatar", kind: "show", why: "self-explanatory." },
  ],
};

/**
 * Clippings: a commonplace book under the inspiration hand. Every quoted string is verbatim from
 * the source it links to (excerpts are whole sentences; `elided` marks a gap between them).
 */
export type ScriptLine = { kind: "character" | "paren" | "dialogue"; text: string };
export type Clipping = {
  text: string[]; // paragraphs, verbatim
  lead?: string; // bold run-in heading that precedes the first paragraph in the source
  elided?: boolean; // paragraphs aren't contiguous in the source
  who: string;
  href: string;
  source?: string; // where it was published / what it's from
  via?: { who: string; href: string };
};

export const clippings: {
  scripts: { film: string; year?: number; credit: string; href?: string; fragments: ScriptLine[][] }[];
  notes: Clipping[];
} = {
  scripts: [
    {
      film: "marty supreme",
      year: 2025,
      credit: "screenplay by ronald bronstein & josh safdie",
      fragments: [
        [
          { kind: "character", text: "MARTY" },
          { kind: "dialogue", text: "I have do it entirely on my own, purely on the basis of my talent, or else it's like, the success won't count." },
        ],
      ],
    },
    {
      film: "avatar: the last airbender",
      credit: "book two, ep. 14, \"city of walls and secrets\"",
      href: "https://avatar.fandom.com/wiki/City_of_Walls_and_Secrets",
      fragments: [
        [
          { kind: "character", text: "IROH" },
          { kind: "dialogue", text: "Life happens wherever you are, whether you make it or not." },
        ],
      ],
    },
  ],
  notes: [
    {
      text: [
        "At critical moments in time, you can raise the aspirations of other people significantly, especially when they are relatively young, simply by suggesting they do something better or more ambitious than what they might have in mind.  It costs you relatively little to do this, but the benefit to them, and to the broader world, may be enormous.",
        "This is in fact one of the most valuable things you can do with your time and with your life.",
      ],
      who: "tyler cowen",
      source: "marginal revolution",
      href: "https://marginalrevolution.com/marginalrevolution/2018/10/high-return-activity-raising-others-aspirations.html",
    },
    {
      text: ["The curse of discipline is that every day looks the same. The curse of indiscipline is that every year does."],
      who: "@MohapatraHemant",
      href: "https://x.com/MohapatraHemant/status/2086255070585495862",
    },
    {
      text: ["Local minima are extremely rare in high dimensional spaces, so if you ever feel stuck in a rut it’s probably just because you aren’t considering a wide enough set of orthogonal options"],
      who: "@corsaren",
      href: "https://x.com/corsaren/status/2079545703622201708",
      via: { who: "@jehovahscript", href: "https://x.com/jehovahscript/status/2089973383031369951" },
    },
    {
      text: [
        "The biggest career mistake I've seen smart young people make: overpricing themselves at the wrong moment.",
        "You were hot. You just weren't as hot as you thought. Instead of riding the slope, you priced yourself off it.",
      ],
      elided: true,
      who: "@ivanburazin",
      href: "https://x.com/ivanburazin/status/2071707535636091204",
    },
  ],
};

/**
 * Sidequests as a quest log. Only things Rohanth has said: objectives are
 * `done: true` when he's done them, otherwise they're the stated goal.
 */
export type Quest = {
  slug: string;
  title: string;
  note: string;
  status: "active" | "ongoing";
  objectives: { text: string; done?: boolean; href?: string }[];
  stamps?: { label: string; done: boolean }[];
};

export const quests: Quest[] = [
  {
    slug: "ironman",
    title: "speedrunning a quarter-life crisis",
    note: "an unreasonably ambitious desire to become an ironman by the time i'm 21.",
    status: "active",
    objectives: [
      { text: "run two half-marathons", done: true, href: links.strava },
      { text: "become an ironman by 21" },
    ],
  },
  {
    slug: "food",
    title: "living to eat instead of eating to live",
    note: "i've always been whatever the opposite of a picky eater is, and was satisfied with whatever slop i could make. trying to get out of that habit.",
    status: "ongoing",
    objectives: [
      { text: "try new foods", href: links.beli },
      { text: "cook real food" },
    ],
  },
  {
    slug: "film",
    title: "taking more photos",
    note: "i don't take enough photos and it's a terrible problem. dabbling with film — i love it, but it's soo expensive.",
    status: "ongoing",
    objectives: [{ text: "take more photos" }, { text: "shoot film" }],
  },
  {
    slug: "wings",
    title: "buffalo wild wings",
    note: "trying wings at every airport buffalo wild wings in the usa. my order is always the wings with blazin' sauce.",
    status: "active",
    objectives: [{ text: "every airport bww in the usa" }],
    stamps: [
      { label: "MSP", done: true },
      { label: "DFW", done: true },
      { label: "ATL", done: true },
    ],
  },
];
