import type { VideoTheme } from './video-themes';

export const videoStory: { name: string; steps: string[]; themes?: VideoTheme[] }[] = [
  {
    name: 'Flow',
    steps: [
      'flowchart',
      'flowchart\n  Idea',
      'flowchart\n  Idea --> Build',
      'flowchart\n  Idea --> Build\n  Build --> Review{Ready?}',
      'flowchart\n  Idea --> Build\n  Build --> Review{Ready?}\n  Review -->|Not yet| Build',
      'flowchart\n  Idea --> Build\n  Build --> Review{Ready?}\n  Review -->|Not yet| Build\n  Review -->|Yes| Launch',
    ],
  },
  {
    name: 'XY',
    steps: [
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [0, 0, 0, 0, 0, 0]',
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [10, 0, 0, 0, 0, 0]',
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [10, 25, 0, 0, 0, 0]',
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [10, 25, 65, 0, 0, 0]',
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [10, 25, 65, 160, 0, 0]',
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [10, 25, 65, 160, 400, 0]',
      'xychart\n  x-axis [Jan, Feb, Mar, Apr, May, Jun]\n  y-axis 0 --> 1000\n  bar [10, 25, 65, 160, 400, 1000]',
    ],
  },
  {
    name: 'Git',
    steps: [
      'gitGraph\n  commit id: "Launch"',
      'gitGraph\n  commit id: "Launch"\n  branch feature\n  commit id: "Design"',
      'gitGraph\n  commit id: "Launch"\n  branch feature\n  commit id: "Design"\n  commit id: "Iterate"',
      'gitGraph\n  commit id: "Launch"\n  branch feature\n  commit id: "Design"\n  commit id: "Iterate"\n  commit id: "Review"',
      'gitGraph\n  commit id: "Launch"\n  branch feature\n  commit id: "Design"\n  commit id: "Iterate"\n  commit id: "Review"\n  checkout main\n  merge feature id: "Release"',
    ],
  },
  {
    name: 'Pie',
    steps: [
      'pie\n  "New user" : 5',
      'pie\n  "New user" : 5\n  "Tried it" : 10',
      'pie\n  "New user" : 5\n  "Tried it" : 10\n  "Weekly" : 16',
      'pie\n  "New user" : 5\n  "Tried it" : 10\n  "Weekly" : 16\n  "Daily" : 69',
    ],
    themes: ['everforest', 'gruvbox', 'rose-pine'],
  },
  {
    name: 'Mindmap',
    steps: [
      'mindmap\n  root((Roadmap))',
      'mindmap\n  root((Roadmap))\n    Feedback\n      Requests\n      Voting\n      Insights\n      Surveys\n      Interviews\n      Analytics',
      'mindmap\n  root((Roadmap))\n    Feedback\n      Requests\n      Voting\n      Insights\n      Surveys\n      Interviews\n      Analytics\n    Features\n      Sharing\n      Offline\n      Integrations\n      Templates\n      Automations\n      Notifications',
      'mindmap\n  root((Roadmap))\n    Feedback\n      Requests\n      Voting\n      Insights\n      Surveys\n      Interviews\n      Analytics\n    Features\n      Sharing\n      Offline\n      Integrations\n      Templates\n      Automations\n      Notifications\n    Polish\n      Speed\n      Search\n      Accessibility\n      Shortcuts\n      Onboarding\n      Localization',
    ],
  },
];
