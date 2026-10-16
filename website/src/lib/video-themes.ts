function palette(name: string, background: string, foreground: string, muted: string, surface: string, border: string, series: string[]) {
  return {
    name,
    colors: {
      bg: background, fg: foreground, muted, line: foreground,
      surface, 'surface-alt': border, border, accent: series[5], critical: series[0],
      ...Object.fromEntries(series.map((color, index) => [`series-${index + 1}`, color])),
    },
  };
}

// Palettes from obsidian-minimal/src/scss/color-schemes; Flexoki uses the site's colors.
export const videoThemes = {
  paper: palette('Flexoki', '#fffcf0', '#100f0f', '#6f6e69', '#f2f0e5', '#cecdc3',
    ['#af3029', '#bc5215', '#ad8301', '#66800b', '#24837b', '#205ea6', '#5e409d', '#a02f6f']),
  nord: palette('Nord', '#2e3440', '#d8dee9', '#9eafcc', '#3b4252', '#434c5e',
    ['#bf616a', '#d08770', '#ebcb8b', '#a3be8c', '#88c0d0', '#81a1c1', '#b48ead', '#b48ead']),
  everforest: palette('Everforest', '#2d353b', '#d3c6aa', '#9da9a0', '#232a2e', '#475258',
    ['#e67e80', '#e69875', '#dbbc7f', '#a7c080', '#83c092', '#7fbbb3', '#d699b6', '#d699b6']),
  gruvbox: palette('Gruvbox dark', '#282828', '#fbf1c7', '#bdae93', '#1e2021', '#3c3836',
    ['#cc241d', '#d65d0e', '#d79921', '#98971a', '#689d6a', '#458588', '#b16286', '#b16286']),
  'rose-pine': palette('Rosé Pine', '#1f1d2e', '#e0def4', '#908caa', '#191724', '#312f41',
    ['#eb6f92', '#ea9a97', '#f6c177', '#31748f', '#9ccfd8', '#9ccfd8', '#c4a7e7', '#c4a7e7']),
};

export type VideoTheme = keyof typeof videoThemes;
