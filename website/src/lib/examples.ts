import { layoutCases, type LayoutGroup } from './layout-cases';
import type { Heading } from './site';

export const homeExample = `flowchart TD
  A[Mermaid text] --> B{Flowchart?}
  B -- Yes --> C[Pele]
  B -- No --> D[Mermaid]
  C --> E([SVG])
  D --> E`;

export const themeExample = `flowchart LR
  A[Variables] --> B(Light)
  A --> C(Dark)
  subgraph Themes
    B
    C
  end`;

export const themeCss = `.pele {
  --pele-bg: #fffcf0;
  --pele-fg: #100f0f;
  --pele-muted: #6f6e69;
  --pele-line: #100f0f;
  --pele-surface: #f2f0e5;
  --pele-surface-alt: #e6e4d9;
  --pele-border: #cecdc3;
}`;

export const playgroundExample = `flowchart TD
  A([Mermaid text]) --> B{Supported?}
  B -- Yes --> C[Parse]
  B -- No --> H[Fall back]

  subgraph Pele
    C --> D[Layout]
    D --> E[Render]
  end

  E --> F[(SVG)]
  F -.-> G[Theme with CSS]
`;

// Pele's own examples. They take the place of the examples of their type from Mermaid's
// documentation, in order, and each keeps the shape of the one it replaces with other labels.
const OWN = new Map([
  ['class', [`---
config:
  class:
    hierarchicalNamespaces: false
---
classDiagram
    namespace Earth.Volcano.Summit {
        class Crater {
            +erupt()
        }
    }
    namespace Earth.Volcano.Slope {
        class LavaFlow {
            +buildLand()
        }
    }
    namespace Earth {
        class Hotspot {
            +meltRock()
        }
    }
    Hotspot --> Crater : feeds
    Hotspot --> LavaFlow : feeds
`, `---
title: Reef animal example
---
classDiagram
    note "From Turtle till Whale"
    Animal <|-- Turtle
    note for Turtle "can swim<br>can dive<br>can nest on beaches<br>can live for decades"
    Animal <|-- Shark
    Animal <|-- Whale
    Animal : +int age
    Animal : +String name
    Animal: +isMammal()
    Animal: +migrate()
    class Turtle{
        +String shellColor
        +swim()
        +nest()
    }
    class Shark{
        -int sizeInFeet
        -canHunt()
    }
    class Whale{
        +bool is_humpback
        +sing()
    }
`]],
  ['mindmap', [`mindmap
  root((Hawaiʻi))
    History
      Old legends
      ::icon(fa fa-book)
      Voyaging
        Polynesian navigators who sailed by the stars
    Nature
      Mountains<br/>and volcanoes
      Ocean life
        Reef
            Sea turtles
            Monk seals
            Parrotfish
    Culture
      Hula and lei
      ʻUkulele
`, `mindmap
    id1["\`**Pele** is the
goddess of volcanoes
Unicode works too: 🌋\`"]
      id2["\`She lives in **the** crater of Kīlauea... a *very old story* that is still told today\`"]
      id3[Lava builds new land]
`]],
  ['pie', [`pie title Fish caught by the crew
    "ʻAhi" : 386
    "Mahimahi" : 85
    "Ono" : 15
`]],
  ['timeline', [`timeline
    title Timeline of the Hawaiian Islands
    section Older islands
        Kauaʻi : 5 million years old, Canyons, Sea <br>cliffs
        Oʻahu : 3 million years old, Diamond Head, Surf breaks
        Molokaʻi : 2 million years old, Fishponds, Tall cliffs
    section Younger islands
        Maui : 1 million years old, Haleakalā, Whale watching
        Hawaiʻi : Still growing, Mauna Kea, Kīlauea
`, `timeline
        title Hawaiʻi's History Timeline
        section Voyagers
          1000 AD : Polynesian voyagers reach Hawaiʻi in sailing canoes
          1778 : Captain Cook lands on Kauaʻi.<br> Islanders and Europeans meet for the first time.
        section Kingdom
          1810 : King Kamehameha unites the islands. <br>They are ruled as one kingdom for the first time.
                  : Ships from around the world stop to trade.
          1882 : ʻIolani Palace is completed in Honolulu.<br> It soon has electric lights and telephones.
                  : Most people in the kingdom can read and write.
`]],
  ['xychart', [`xychart
    title "Ocean Temperature"
    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    y-axis "Temperature (in °F)" 74 --> 82
    bar [76.3, 75.9, 76.0, 76.7, 77.8, 78.9, 79.9, 80.7, 81.1, 80.5, 79.1, 77.4]
    line [76.3, 75.9, 76.0, 76.7, 77.8, 78.9, 79.9, 80.7, 81.1, 80.5, 79.1, 77.4]
`, `---
config:
    xyChart:
        showDataLabel: true
        showDataLabelOutsideBar: true
---
xychart
    title "Animals seen in reef survey of 2025"
    x-axis [turtles, eels, tangs, wrasses, "parrot fish", other]
    y-axis "Number of Animals" 0 --> 30
    bar [12,2,20,25,17,24]
`]],
]);

const typeOf = (path: string): string => path.match(/([\w-]+)-docs\.json$/)?.[1] ?? path;

export interface PlaygroundSample {
  label: string;
  source: string;
}

export interface SampleGroup {
  type: string;
  samples: PlaygroundSample[];
  beta: boolean;
}

const SAMPLES_PER_TYPE = 6;

const statements = (source: string): string[] =>
  source.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('%%'));

// Mermaid's documentation is partly in British English. The site is in American English, so
// its examples are respelled, names and labels alike.
const AMERICAN: [RegExp, string][] = [
  [/(analy)s(?=e|ing)/gi, '$1z'],
  [/(authori|populari|recogni|standardi|summari)s(?=[aei])/gi, '$1z'],
  [/(catalog)ue/gi, '$1'],
  [/(gr)e(?=y\b)/gi, '$1a'],
  [/(licen)c(?=e)/gi, '$1s'],
  [/(model)l(?=ed|ing)/gi, '$1'],
];
const american = (source: string): string => AMERICAN.reduce((text, [british, spelling]) => text.replace(british, spelling), source);

const sourcesOf = (corpus: unknown): string[] =>
  Array.isArray(corpus) ? corpus.filter((source): source is string => typeof source === 'string' && source.trim() !== '').map(american) : [];

// Mermaid marks a type it may still change with `-beta` in its keyword. A type is one of those
// when its documentation has no example written without it.
const isBeta = (sources: string[]): boolean =>
  sources.length > 0 && sources.every((source) => statements(source)[0]?.split(/\s/)[0].endsWith('-beta'));

function sampleLabel(source: string, index: number): string {
  const title = source.match(/^---\n[\s\S]*?^title:\s*(.+)$[\s\S]*?^---$/m)?.[1];
  const lines = statements(source);
  const statement = lines[1] ?? lines[0] ?? 'Empty';
  const text = title?.replace(/^(["'])(.*)\1$/, '$2') ?? statement;
  return `${index + 1}. ${text.length > 48 ? `${text.slice(0, 47)}…` : text}`;
}

function pick(sources: string[], own: string[]): PlaygroundSample[] {
  const longest = new Set([...sources].sort((a, b) => b.length - a.length).slice(0, SAMPLES_PER_TYPE - own.length));
  const picked = sources.filter((source) => longest.has(source));
  return [...own, ...picked].map((source, index) => ({ label: sampleLabel(source, index), source }));
}

export function sampleGroups(corpora: Record<string, unknown>): SampleGroup[] {
  return Object.entries(corpora)
    .map(([path, corpus]) => {
      const sources = sourcesOf(corpus);
      const type = typeOf(path);
      return { type, samples: pick(sources, OWN.get(type) ?? []), beta: isBeta(sources) };
    })
    .filter((group) => group.samples.length > 0)
    .sort((a, b) => Number(b.type === 'flowchart') - Number(a.type === 'flowchart') || Number(a.beta) - Number(b.beta) || a.type.localeCompare(b.type));
}

const TYPE_TITLES = new Map([
  ['flowchart', 'Flowchart'],
  ['swimlane', 'Swimlane'],
  ['sequence', 'Sequence'],
  ['class', 'Class'],
  ['state', 'State'],
  ['er', 'Entity relationship'],
  ['gantt', 'Gantt'],
  ['git', 'Git graph'],
  ['pie', 'Pie'],
  ['mindmap', 'Mindmap'],
  ['kanban', 'Kanban'],
  ['timeline', 'Timeline'],
  ['journey', 'User journey'],
  ['quadrant', 'Quadrant chart'],
  ['xychart', 'XY chart'],
  ['requirement', 'Requirement'],
  ['sankey', 'Sankey'],
  ['architecture', 'Architecture'],
  ['c4', 'C4'],
  ['block', 'Block'],
  ['agentflow', 'Agentflow'],
  ['railroad', 'Railroad'],
  ['treeview', 'Tree view'],
  ['cynefin', 'Cynefin'],
  ['wardley', 'Wardley map'],
  ['eventmodeling', 'Event modeling'],
  ['usecase', 'Use case'],
  ['venn', 'Venn'],
  ['ishikawa', 'Ishikawa'],
  ['packet', 'Packet'],
  ['radar', 'Radar'],
  ['treemap', 'Treemap'],
]);

const TYPE_DESCRIPTIONS = new Map([
  ['flowchart', 'Show the steps and decisions in a process.'],
  ['swimlane', 'Show a process divided by who performs each step.'],
  ['sequence', 'Show the messages that participants exchange over time.'],
  ['class', 'Show classes, their members, and the relationships between them.'],
  ['state', 'Show the states of a system and the transitions between them.'],
  ['er', 'Show entities, their attributes, and the relationships between them.'],
  ['gantt', 'Show the tasks of a project on a timeline.'],
  ['git', 'Show commits, branches, and merges.'],
  ['pie', 'Show the parts of a whole.'],
  ['mindmap', 'Show ideas branching out from a central topic.'],
  ['kanban', 'Show tasks in columns by status.'],
  ['timeline', 'Show events in chronological order.'],
  ['journey', 'Show the steps of a task and how satisfying each one is.'],
  ['quadrant', 'Plot items on two axes that divide the chart into four sections.'],
  ['xychart', 'Plot data as bars and lines on two axes.'],
  ['requirement', 'Show requirements and how they relate to each other and to the elements that satisfy them.'],
  ['sankey', 'Show flows between nodes, with widths proportional to quantity.'],
  ['architecture', 'Show services and the connections between them.'],
  ['c4', 'Show a software system as people, systems, containers, and components.'],
  ['block', 'Show blocks in a grid that you arrange yourself.'],
  ['agentflow', 'Show the tasks of AI agents and how work passes between them.'],
  ['railroad', 'Show the syntax of a grammar.'],
  ['treeview', 'Show a hierarchy, such as files and folders.'],
  ['cynefin', 'Sort items into the five domains of the Cynefin framework.'],
  ['wardley', 'Plot components by their visibility to the user and their stage of evolution.'],
  ['eventmodeling', 'Show how commands, events, and views change a system over time.'],
  ['usecase', 'Show actors and the goals they reach with a system.'],
  ['venn', 'Show sets and where they overlap.'],
  ['ishikawa', 'Show the causes that contribute to a problem.'],
  ['packet', 'Show the fields of a network packet.'],
  ['radar', 'Compare values across several axes.'],
  ['treemap', 'Show hierarchical data as nested rectangles, sized by value.'],
]);

// Info only prints a version number, which is not much of an example.
const UNLISTED = new Set(['info']);

const SINGLE = new Set(['cynefin']);

const FIRST_LIMIT = 500;
const FULLER_LIMIT = 1000;

export interface ExampleGroup {
  type: string;
  title: string;
  slug: string;
  sources: string[];
  beta: boolean;
}

const lines = (source: string): Set<string> => new Set(source.split('\n').map((line) => line.trim()).filter(Boolean));

// The share of the smaller example's lines that the other one repeats.
function overlap(a: string, b: string): number {
  const first = lines(a);
  const second = lines(b);
  let shared = 0;
  for (const line of first) if (second.has(line)) shared++;
  return shared / Math.max(1, Math.min(first.size, second.size));
}

// Pele uses CSS variables for colors, so any other fill or stroke in the SVG is a color the example chose.
// The source is checked too, for theme variables, which Pele does not draw, and for styles nothing uses.
const RE_OWN_PAINT = /(?:fill|stroke)(?:="|:)(?!none|currentColor|var\()/;
const RE_OWN_STYLE = /themeVariables|\b(?:fill|stroke)\s*:/;
const ownColors = (source: string, svg: string): boolean => RE_OWN_PAINT.test(svg) || RE_OWN_STYLE.test(source);

// Two examples of each type from Mermaid's documentation: the fullest one of moderate size,
// and a larger one that is not a variation of it. Examples that leave their colors to the theme
// come first; one that sets its own is shown only when the type has no other.
export function exampleGroups(corpora: Record<string, unknown>, draw: (source: string) => string | undefined): ExampleGroup[] {
  return Object.entries(corpora)
    .map(([path, corpus]) => {
      const type = typeOf(path);
      const all = sourcesOf(corpus);
      const drawn = [...new Set(all)].map((source) => ({ source, svg: draw(source) })).filter((example) => example.svg !== undefined);
      const themed = drawn.filter((example) => !ownColors(example.source, example.svg!));
      const usable = (themed.length > 0 ? themed : drawn).map((example) => example.source);
      const bySize = [...usable].sort((a, b) => b.length - a.length);
      const first = bySize.find((source) => source.length <= FIRST_LIMIT) ?? bySize.at(-1);
      const fuller = bySize.find((source) => source !== first && source.length <= FULLER_LIMIT && overlap(source, first!) < 0.5);
      const own = OWN.get(type) ?? [];
      const sources = [own[0] ?? first, SINGLE.has(type) ? undefined : own[1] ?? fuller].filter((source) => source !== undefined);
      const title = TYPE_TITLES.get(type) ?? type;
      return { type, title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), sources, beta: isBeta(all) };
    })
    .filter((group) => group.sources.length > 0 && !UNLISTED.has(group.type))
    .sort((a, b) => Number(a.beta) - Number(b.beta) || a.title.localeCompare(b.title));
}

export interface ExamplePage {
  type: string;
  title: string;
  description: string;
  // Diagrams chosen to show how the type is laid out, then every example in Mermaid's documentation.
  groups: LayoutGroup[];
  sources: string[];
}

export const documentationSlug = 'documentation';

export function examplePages(corpora: Record<string, unknown>): ExamplePage[] {
  return Object.entries(corpora)
    .map(([path, corpus]) => {
      const type = typeOf(path);
      const title = TYPE_TITLES.get(type) ?? type;
      return { type, title, description: TYPE_DESCRIPTIONS.get(type) ?? `Examples of ${title} diagrams.`, groups: layoutCases[type] ?? [], sources: [...new Set(sourcesOf(corpus))] };
    })
    .filter((page) => page.sources.length > 0 && !UNLISTED.has(page.type));
}

export const examplePageHref = (type: string): string => `/examples/${type}`;

// The diagram's own opening line and the one after it, to tell a type's examples apart.
export function exampleLabel(source: string, index: number): string {
  const text = statements(source).slice(0, 2).join(' · ');
  return `${index + 1}. ${text.length > 80 ? `${text.slice(0, 79)}…` : text}`;
}

// A page with nothing but the documentation's examples needs no headings to divide it.
export function examplePageHeadings(page: ExamplePage): Heading[] {
  if (page.groups.length === 0) return [];
  return [
    ...page.groups.map((group) => ({ depth: 2, slug: group.slug, text: group.title })),
    { depth: 2, slug: documentationSlug, text: 'Documentation examples' },
  ];
}

export const examplesTitle = 'Examples';
export const examplesDescription = 'Browse supported diagram types.';
