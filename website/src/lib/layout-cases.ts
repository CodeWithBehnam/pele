// Diagrams drawn first on a type's page of examples, chosen to show how Pele lays the type out.
// Each one is here for something in particular; `note` says what to look at.

export interface LayoutCase {
  title: string;
  note?: string;
  source: string;
}

export interface LayoutGroup {
  title: string;
  slug: string;
  cases: LayoutCase[];
}

const fan = (dir: string, count: number, into: boolean): string => {
  let text = `flowchart ${dir}\n`;
  for (let i = 1; i <= count; i++) text += into ? `  n${i}[Note ${i}] --> hub[Hub]\n` : `  hub[Hub] --> n${i}[Note ${i}]\n`;
  return text;
};

const decision = (dir: string): string => `flowchart ${dir}
  A[Start] --> B{Ready?}
  B -->|Yes| C[Ship]
  B -->|No| D[Fix]
  D --> B
  C --> E([Done])
  D -->|Give up| E
`;

const withCurve = (curve: string): string => `---
config:
  flowchart:
    curve: ${curve}
---
flowchart TD
  A[Start] --> B[Parse]
  A --> C[Measure]
  A --> D[Theme]
  B --> E{Fits?}
  C --> E
  D --> E
  E -->|Yes| F[Draw]
  E -->|No| A
`;

const stepped = (source: string): string => `---\nconfig:\n  flowchart:\n    curve: step\n---\n${source}`;

const notes = ['Flex layout', 'New home page and PARA design', '2024-07-15', '2024-06-13', '2025-04-17', 'Test note', 'Medium draft', 'Reading list', 'Garden', 'Inbox', 'Archive', 'Ideas'];
let vault = 'flowchart TD\n';
notes.forEach((name, i) => (vault += `  a${i}["${name}"] --> MOC[_MOC]\n`));
[0, 1, 2, 3, 9, 11].forEach((i) => (vault += `  a${i} --> Weekly\n`));

// Two fans beside each other, one with an edge written twice.
let repeated = 'graph TD\n  hub["Hub"]\n  index["Index"]\n';
['Plugins', 'Medium draft', 'Medium draft', 'Test note', '2025-04-17', '2024-06-13', '2024-07-15', 'PARA design'].forEach((name) => {
  repeated += `  ${name.replace(/\W/g, '_')}["${name}"] --> hub\n`;
});
['Notes', 'Obsidian', 'Reading', 'Reading', 'Clippings', 'Daily', 'Weekly', 'Monthly', 'Projects', 'Project log'].forEach((name) => {
  repeated += `  index --> ${name.replace(/\W/g, '_')}["${name}"]\n`;
});

// Every shape, with three edges arriving, three leaving and one coming back.
const SHAPES = [
  ['rect', 'rounded', 'stadium', 'fr-rect', 'cyl', 'circle', 'dbl-circ', 'diam'],
  ['hex', 'odd', 'lean-r', 'lean-l', 'trap-b', 'trap-t', 'text', 'bow-rect'],
  ['sm-circ', 'f-circ', 'fr-circ', 'fork', 'notch-rect', 'lin-rect', 'div-rect', 'win-pane'],
  ['notch-pent', 'cross-circ', 'st-rect', 'datastore', 'lin-cyl', 'tag-rect', 'doc', 'tri'],
  ['flip-tri', 'sl-rect', 'hourglass', 'delay', 'h-cyl', 'curv-trap', 'docs', 'flag'],
  ['bolt', 'bang', 'cloud', 'brace', 'brace-r', 'braces', 'tag-doc', 'lin-doc'],
];
const shapeSheet = (dir: string, shapes: string[]): string => {
  let text = `flowchart ${dir}\n`;
  shapes.forEach((shape, i) => {
    text += `  a${i}[a] & b${i}[b] & c${i}[c] --> n${i}@{ shape: ${shape}, label: "${shape}" } --> x${i}[x] & y${i}[y] & z${i}[z]\n  x${i} --> n${i}\n`;
  });
  return text;
};

let mesh = 'flowchart TD\n';
for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if ((i * j + i) % 3 !== 0) mesh += `  top${i} --> low${j}\n`;

let ladder = 'flowchart TD\n';
for (let i = 1; i < 8; i++) ladder += `  s${i}[Step ${i}] --> s${i + 1}[Step ${i + 1}]\n`;
ladder += '  s1 --> s4\n  s1 --> s8\n  s2 --> s6\n  s3 --> s7\n  s7 --> s2\n  s8 --> s1\n';

const flowchart: LayoutGroup[] = [
  {
    title: 'Edges on one side of a node',
    slug: 'edges',
    cases: [
      { title: 'Two-way pair', note: 'An arrowhead and the edge that leaves beside it should not touch.', source: 'flowchart TD\n  A --> B\n  B --> A\n' },
      { title: 'Two-way pairs in a triangle', source: 'flowchart TD\n  A --> B\n  B --> A\n  B --> C\n  C --> B\n  C --> A\n' },
      {
        title: 'Diamond with an edge back to it',
        note: 'Three edges on the tip of the diamond, and one in and one out on top of F.',
        source: 'flowchart TD\n  D{Data, settings or context changed} -->|Yes| F\n  F --> D\n  D -->|Container removed| G\n',
      },
      { title: 'Decision with loops', source: 'flowchart TD\n  A[Christmas] -->|Get money| B(Go shopping)\n  B --> C{Let me think}\n  C -->|One| D[Laptop]\n  C -->|Two| E[iPhone]\n  C -->|Three| F[Car]\n  D --> B\n  E --> A\n' },
      { title: 'Tree', source: 'flowchart TD\n  A[Start] --> B[Parse]\n  A --> C[Measure]\n  B --> D[Layout]\n  C --> D\n  D --> E[Draw]\n  D --> F[Export]\n  D --> G[Cache]\n' },
      { title: 'Fan out, 3', source: fan('TD', 3, false) },
      { title: 'Fan out, 7', note: 'More edges than fit at a full pitch, so they leave closer together.', source: fan('TD', 7, false) },
      { title: 'Fan in, 3', source: fan('TD', 3, true) },
      { title: 'Fan in, 7', source: fan('TD', 7, true) },
      { title: 'Hub with edges both ways', source: 'flowchart TD\n  a --> hub[A wide hub with room]\n  b --> hub\n  hub --> a\n  c --> hub\n  hub --> d\n  hub --> e\n  e --> hub\n  f --> hub\n  hub --> f\n' },
      { title: 'Parallel edges', source: 'flowchart TD\n  A -->|first| B\n  A -->|second| B\n  A --> B\n  B --> C\n  B --> C\n' },
      { title: 'Self-loops with other edges', source: 'flowchart TD\n  A --> A\n  A --> B\n  B --> B\n  B -->|again| B\n  B --> A\n  B --> C\n' },
      { title: 'Arrow types and line styles', source: 'flowchart TD\n  A <--> B\n  A --o C\n  A --x D\n  B -.-> E\n  C ==> E\n  D --- E\n  E o--o A\n' },
    ],
  },
  {
    title: 'Directions',
    slug: 'directions',
    cases: ['TD', 'BT', 'LR', 'RL'].map((dir) => ({ title: dir, source: decision(dir) })),
  },
  {
    title: 'Shapes',
    slug: 'shapes',
    cases: [
      ...SHAPES.map((shapes, i) => ({
        title: `Sheet ${i + 1}, top to bottom`,
        note: i === 0 ? 'Every edge should end on the outline of its shape.' : undefined,
        source: shapeSheet('TD', shapes),
      })),
      ...SHAPES.map((shapes, i) => ({ title: `Sheet ${i + 1}, left to right`, source: shapeSheet('LR', shapes) })),
    ],
  },
  {
    title: 'Subgraphs',
    slug: 'subgraphs',
    cases: [
      {
        title: 'Edges across and onto groups',
        note: 'An edge that ends on a group should not land where another edge passes through its border.',
        source: 'flowchart TD\n  subgraph one [Group one]\n    a1 --> a2\n    a1 --> a3\n  end\n  subgraph two [Group two]\n    b1 --> b2\n  end\n  a2 --> b1\n  a3 --> b1\n  b2 --> a1\n  c --> one\n  c --> two\n  one --> d\n  two --> d\n',
      },
      { title: 'Two-way between groups', source: 'flowchart LR\n  subgraph Client\n    UI[Web app]\n    Cache[(Local cache)]\n  end\n  subgraph Services\n    API[API gateway] --> Orders[Order service]\n    API --> Auth[Auth service]\n  end\n  UI --> Cache\n  UI --> API\n  API --> UI\n  Auth -.->|token| UI\n  Orders --> DB[(Orders DB)]\n' },
      { title: 'Nested groups', source: 'flowchart TD\n  subgraph outer [Outer]\n    subgraph inner [Inner]\n      a --> b\n      b --> a\n    end\n    c --> a\n    b --> d\n  end\n  start --> c\n  start --> a\n  d --> finish\n  b --> finish\n  finish --> start\n' },
      { title: 'Groups with their own direction', source: 'flowchart LR\n  subgraph top [Runs down]\n    direction TB\n    t1 --> t2 --> t3\n  end\n  subgraph side [Runs across]\n    direction LR\n    s1 --> s2 --> s3\n  end\n  outside --> top\n  outside --> s1\n  t3 --> s2\n  s3 --> t1\n' },
      { title: 'Group to group, both ways', source: 'flowchart TD\n  subgraph A [First]\n    a1\n    a2\n  end\n  subgraph B [Second]\n    b1\n    b2\n  end\n  A --> B\n  B --> A\n  a1 --> b1\n  b2 --> a2\n' },
    ],
  },
  {
    title: 'Wide and dense',
    slug: 'wide',
    cases: [
      { title: 'Notes into two hubs', note: 'Long runs across the gap between two ranks.', source: vault },
      { title: 'Wide graph with a repeated edge', note: 'The repeat gives every edge a rank in the middle, which should not show as a bend.', source: repeated },
      { title: 'Fan in, 30', source: fan('TD', 30, true) },
      { title: 'Fan out, 30, left to right', source: fan('LR', 30, false) },
      { title: 'Two dense ranks', source: mesh },
      { title: 'Chain with edges that skip ranks', source: ladder },
      { title: 'Short nodes beside a tall one', source: 'flowchart TD\n  a[Short] --> far[Far away]\n  b["A tall node<br>with four<br>lines of<br>text"] --> near\n  c[Short] --> near\n  d[One] --> near\n  e[Two] --> near\n  f[Three] --> near\n  g[Four] --> far\n  a --> near\n' },
      { title: 'Wide rank over a narrow one', source: 'flowchart TD\n  root --> a[A fairly long label here] & b[Another long label] & c[Third long label] & d[Fourth long label] & e[Fifth long label]\n  a & e --> x\n  b & d --> y\n  a --> y\n  e --> y\n  c --> x\n' },
    ],
  },
  {
    title: 'Labels',
    slug: 'labels',
    cases: [
      { title: 'Labels on a fan', source: 'flowchart TD\n  A{Which way?} -->|The first and longest of the answers| B\n  A -->|Second| C\n  A -->|A third answer| D\n  A -->|Fourth| E\n  B -->|Back| A\n' },
      { title: 'Labels on a two-way pair', source: 'flowchart LR\n  A[Client] -->|request| B[Server]\n  B -->|response| A\n  B -->|query| C[(Database)]\n  C -->|rows| B\n' },
      { title: 'Tall and wide nodes', source: 'flowchart TD\n  A["One line"] --> B["A node whose label is long enough that it wraps onto several lines of text"]\n  A --> C["Short"]\n  B --> D["Line one<br>line two<br>line three<br>line four"]\n  C --> D\n  D --> A\n  D --> B\n' },
    ],
  },
  {
    title: 'Right angles',
    slug: 'right-angles',
    cases: [
      { title: 'Decision with a way back', note: 'With `curve: step`, each edge runs on a track of its own and turns in rounded corners.', source: withCurve('step') },
      { title: 'Tall and wide nodes', source: stepped('flowchart TD\n  A["One line"] --> B["A node whose label is long enough that it wraps onto several lines of text"]\n  A --> C["Short"]\n  B --> D["Line one<br>line two<br>line three<br>line four"]\n  C --> D\n  D --> A\n  D --> B\n') },
      { title: 'Decision with loops', source: stepped('flowchart TD\n  A[Christmas] -->|Get money| B(Go shopping)\n  B --> C{Let me think}\n  C -->|One| D[Laptop]\n  C -->|Two| E[iPhone]\n  C -->|Three| F[Car]\n  D --> B\n  E --> A\n') },
      { title: 'Left to right', source: stepped(decision('LR')) },
      { title: 'Hub with edges both ways', source: stepped('flowchart TD\n  a --> hub[A wide hub with room]\n  b --> hub\n  hub --> a\n  c --> hub\n  hub --> d\n  hub --> e\n  e --> hub\n  f --> hub\n  hub --> f\n') },
      { title: 'Edges across and onto groups', source: stepped('flowchart TD\n  subgraph one [Group one]\n    a1 --> a2\n    a1 --> a3\n  end\n  subgraph two [Group two]\n    b1 --> b2\n  end\n  a2 --> b1\n  a3 --> b1\n  b2 --> a1\n  c --> one\n  c --> two\n  one --> d\n  two --> d\n') },
      { title: 'Notes into two hubs', source: stepped(vault) },
      { title: 'Wide graph with a repeated edge', source: stepped(repeated) },
      { title: 'Two dense ranks', source: stepped(mesh) },
      { title: 'Chain with edges that skip ranks', source: stepped(ladder) },
      { title: 'Fan in, 30', source: stepped(fan('TD', 30, true)) },
    ],
  },
  {
    title: 'Curves',
    slug: 'curves',
    cases: ['basis', 'linear', 'step', 'stepBefore', 'stepAfter'].map((curve) => ({ title: curve, source: withCurve(curve) })),
  },
];

// The other types that are laid out in ranks, as flowcharts are.
const edges = (cases: LayoutCase[]): LayoutGroup[] => [{ title: 'Edges', slug: 'edges', cases }];

export const layoutCases: Record<string, LayoutGroup[]> = {
  flowchart,
  state: edges([
    { title: 'Two-way transitions', note: 'A transition that arrives should not touch one that leaves beside it.', source: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running : start\n  Running --> Idle : stop\n  Running --> Paused : pause\n  Paused --> Running : resume\n  Paused --> Idle : stop\n  Running --> [*]\n' },
    { title: 'Composite state', source: 'stateDiagram-v2\n  [*] --> Active\n  state Active {\n    [*] --> Typing\n    Typing --> Waiting : pause\n    Waiting --> Typing : key\n  }\n  Active --> Saved : save\n  Saved --> Active : edit\n  Saved --> [*]\n' },
    { title: 'Wide fan', source: 'stateDiagram-v2\n  [*] --> Menu\n  Menu --> Open\n  Menu --> Save\n  Menu --> Export\n  Menu --> Print\n  Menu --> Share\n  Menu --> Settings\n  Menu --> Help\n  Open --> Done\n  Save --> Done\n  Export --> Done\n  Print --> Done\n  Share --> Done\n  Settings --> Done\n  Help --> Done\n  Done --> Menu\n' },
  ]),
  class: edges([
    { title: 'Several relations into one class', source: 'classDiagram\n  Animal <|-- Turtle\n  Animal <|-- Shark\n  Animal <|-- Whale\n  Animal *-- Habitat\n  Habitat o-- Animal\n  Turtle --> Shark : fears\n  Shark --> Turtle : hunts\n' },
    { title: 'Wide inheritance', source: 'classDiagram\n  Shape <|-- Circle\n  Shape <|-- Square\n  Shape <|-- Triangle\n  Shape <|-- Hexagon\n  Shape <|-- Ellipse\n  Shape <|-- Diamond\n  Shape <|-- Trapezoid\n  Circle --> Canvas\n  Trapezoid --> Canvas\n  Canvas --> Shape\n' },
  ]),
  er: edges([
    { title: 'Entities with several relationships', source: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains\n  CUSTOMER }|..|{ ADDRESS : uses\n  ORDER }o--|| ADDRESS : "ships to"\n  PRODUCT ||--o{ LINE_ITEM : "appears in"\n' },
  ]),
  requirement: edges([
    { title: 'Relations both ways', source: 'requirementDiagram\n  requirement fast {\n    id: 1\n    text: Renders quickly\n  }\n  requirement small {\n    id: 2\n    text: Ships little code\n  }\n  element layout {\n    type: module\n  }\n  layout - satisfies -> fast\n  layout - satisfies -> small\n  fast - derives -> small\n  small - refines -> fast\n' },
  ]),
};

const mobileCases: Record<string, LayoutCase> = {
  sequence: {
    title: "Four participants",
    note: "Participant names, messages and notes wrap while the lifelines stay in columns.",
    source: `sequenceDiagram
  autonumber
  actor Customer
  participant Web as Web app
  participant API as API gateway
  participant Bank
  Customer->>Web: Place order
  Web->>API: POST /orders
  activate API
  API->>Bank: Authorise payment
  Bank-->>API: Approved
  API-->>Web: 201 Created
  deactivate API
  Web-->>Customer: Order confirmed
  Note over Customer,Bank: One order, one transaction
`,
  },
  railroad: {
    title: "Nested grammar",
    note: "Long sequences wrap onto connected rows; alternatives and repetitions keep their tracks.",
    source: `railroad-ebnf-beta
title "JSON Grammar"

json = element ;
element = object | array | string | number | "true" | "false" | "null" ;
object = "{" [ member ( "," member )* ] "}" ;
array = "[" [ element ( "," element )* ] "]" ;
member = string ":" element ;
`,
  },
  journey: {
    title: "Journey steps",
    note: "On a narrow screen, each step keeps its score, mood and actors in a vertical sequence.",
    source: `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me
`,
  },
  packet: {
    title: "Protocol fields",
    note: "Shorter rows preserve bit numbers. A row grows taller when a field label needs to wrap.",
    source: `---
title: "TCP Packet"
---
packet
0-15: "Source Port"
16-31: "Destination Port"
32-63: "Sequence Number"
64-95: "Acknowledgment Number"
96-99: "Data Offset"
100-105: "Reserved"
106: "URG"
107: "ACK"
108: "PSH"
109: "RST"
110: "SYN"
111: "FIN"
112-127: "Window"
128-143: "Checksum"
144-159: "Urgent Pointer"
160-191: "(Options and Padding)"
192-255: "Data (variable length)"
`,
  },
  c4: {
    title: "Nested boundaries",
    note: "Columns fold within their boundaries. Deep nesting and explicit relation offsets can still need more width.",
    source: `    C4Context
      title System Context diagram for Internet Banking System
      Enterprise_Boundary(b0, "BankBoundary0") {
        Person(customerA, "Banking Customer A", "A customer of the bank, with personal bank accounts.")
        Person(customerB, "Banking Customer B")
        Person_Ext(customerC, "Banking Customer C", "desc")

        Person(customerD, "Banking Customer D", "A customer of the bank, <br/> with personal bank accounts.")

        System(SystemAA, "Internet Banking System", "Allows customers to view information about their bank accounts, and make payments.")

        Enterprise_Boundary(b1, "BankBoundary") {

          SystemDb_Ext(SystemE, "Mainframe Banking System", "Stores all of the core banking information about customers, accounts, transactions, etc.")

          System_Boundary(b2, "BankBoundary2") {
            System(SystemA, "Banking System A")
            System(SystemB, "Banking System B", "A system of the bank, with personal bank accounts. next line.")
          }

          System_Ext(SystemC, "E-mail system", "The internal Microsoft Exchange e-mail system.")
          SystemDb(SystemD, "Banking System D Database", "A system of the bank, with personal bank accounts.")

          Boundary(b3, "BankBoundary3", "boundary") {
            SystemQueue(SystemF, "Banking System F Queue", "A system of the bank.")
            SystemQueue_Ext(SystemG, "Banking System G Queue", "A system of the bank, with personal bank accounts.")
          }
        }
      }

      BiRel(customerA, SystemAA, "Uses")
      BiRel(SystemAA, SystemE, "Uses")
      Rel(SystemAA, SystemC, "Sends e-mails", "SMTP")
      Rel(SystemC, customerA, "Sends e-mails to")

      UpdateElementStyle(customerA, $fontColor="red", $bgColor="grey", $borderColor="red")
      UpdateRelStyle(customerA, SystemAA, $textColor="blue", $lineColor="blue", $offsetX="5")
      UpdateRelStyle(SystemAA, SystemE, $textColor="blue", $lineColor="blue", $offsetY="-10")
      UpdateRelStyle(SystemAA, SystemC, $textColor="blue", $lineColor="blue", $offsetY="-40", $offsetX="-50")
      UpdateRelStyle(SystemC, customerA, $textColor="red", $lineColor="red", $offsetX="-50", $offsetY="20")

      UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")


`,
  },
  architecture: {
    title: "Fixed link sides",
    note: "Labels and spacing tighten; the specified link sides and grid alignments stay in place.",
    source: `architecture-beta
    group sources(cloud)[Sources]
        service src_a(server)[Source A] in sources
        service src_b(server)[Source B] in sources
        service src_c(server)[Source C] in sources

    group storage(database)[Storage]
        service db_one(database)[DB One] in storage
        service db_two(database)[DB Two] in storage
        service db_three(database)[DB Three] in storage

    group output(disk)[Output]
        service brief(disk)[Brief] in output
        service analyst(server)[Analyst] in output
        service delivery(cloud)[Delivery] in output

    src_a:B --> T:db_one
    src_b:B --> T:db_two
    src_c:B --> T:db_three
    db_two:B --> T:brief
    brief:R --> L:analyst
    analyst:R --> L:delivery

    align row src_a src_b src_c
    align row db_one db_two db_three
    align row brief analyst delivery

    align column src_a db_one
    align column src_b db_two brief
    align column src_c db_three
`,
  },
  eventmodeling: {
    title: "Chronological frames",
    note: "Frames run down the page, with their lane labels, data and references.",
    source: `eventmodeling

tf 01 ui CartUI
tf 02 cmd AddItem [[AddItem01]]
tf 03 evt ItemAdded [[ItemAdded]]
tf 04 cmd AddItem [[AddItem02]]
tf 05 evt ItemAdded [[ItemAdded]]

data AddItem01 {
  description: 'john'
  image: 'avatar_john'
  price: 20.4
}

data AddItem02 {
  description: 'jack'
  image: 'avatar_jack'
  price: 12.5
}

data ItemAdded {
  description: string
  image: string
  price: number
}
`,
  },
  swimlane: {
    title: "Lane direction",
    note: "Labels wrap and gaps tighten without turning the lanes.",
    source: `swimlane-beta LR
  subgraph Customer
    Browse[Browse catalogue]
    Pay[Pay]
  end
  subgraph Warehouse
    Pick[Pick items]
    Ship[Ship order]
  end
  subgraph Finance
    Invoice[Raise invoice]
  end
  Browse --> Pay
  Pay --> Pick
  Pick --> Ship
  Pay --> Invoice
`,
  },
  block: {
    title: "Explicit columns",
    note: "Labels and spacing tighten while columns and spans keep their positions.",
    source: `block
columns 1
  db(("DB"))
  blockArrowId6<["&nbsp;&nbsp;&nbsp;"]>(down)
  block:ID
    A
    B["A wide one in the middle"]
    C
  end
  space
  D
  ID --> D
  C --> D
  style B fill:#969,stroke:#333,stroke-width:4px
`,
  },
  ishikawa: {
    title: "Categories and causes",
    note: "The narrow view is a cause tree that preserves the categories and nested causes.",
    source: `ishikawa-beta
    Blurry Photo
    Process
        Out of focus
        Shutter speed too slow
        Protective film not removed
        Beautification filter applied
    User
        Shaky hands
    Equipment
        LENS
            Inappropriate lens
            Damaged lens
            Dirty lens
        SENSOR
            Damaged sensor
            Dirty sensor
    Environment
        Subject moved too quickly
        Too dark
`,
  },
  quadrant: {
    title: "Quadrant labels",
    note: "The chart fits a phone width and wraps its labels.",
    source: `quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]
    Campaign E: [0.40, 0.34]
    Campaign F: [0.35, 0.78]
`,
  },
  wardley: {
    title: "Map labels",
    note: "The plot narrows while labels retain their font size.",
    source: `wardley-beta
title Tea Shop Value Chain

anchor Business [0.95, 0.63]
component Cup of Tea [0.79, 0.61]
component Tea [0.63, 0.81]
component Hot Water [0.52, 0.80]
component Kettle [0.43, 0.35]
component Power [0.10, 0.70]

Business -> Cup of Tea
Cup of Tea -> Tea
Cup of Tea -> Hot Water
Hot Water -> Kettle
Kettle -> Power

evolve Kettle 0.62
evolve Power 0.89

note "Standardising power allows Kettles to evolve faster" [0.30, 0.49]
`,
  },
  treeview: {
    title: "Names and descriptions",
    note: "Long filenames wrap. Descriptions move beneath their entries and the hierarchy remains visible.",
    source: `treeView-beta
  project/
    this_is_a_long_filename_that_needs_to_wrap_on_a_phone.ts :::highlight ## A description that stays with the file when the layout narrows
    source/
      app.ts
`,
  },
};

for (const [type, example] of Object.entries(mobileCases)) {
  (layoutCases[type] ??= []).push({ title: 'Narrow screens', slug: 'narrow-screens', cases: [example] });
}
