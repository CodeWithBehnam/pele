import type { Config } from '../../preprocess.js';
import type { NodeType } from './model.js';

// Mermaid's name for its built-in pack. Only `file` and `folder` are built in; every other icon
// name is offered to the host's icon resolver.
export const BUILTIN_PACK = 'mermaid-treeview';

// Outlines on a 24 by 24 grid.
export const GLYPHS: ReadonlyMap<string, string> = new Map([
  ['folder', 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2.4 2.5h8A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z'],
  ['file', 'M6.5 3h7L19 8.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3zM13.5 3v5.5H19'],
]);

export type IconMap = { readonly [key: string]: unknown };

export interface IconConfig {
  showIcons: boolean;
  defaultIconPack: string;
  filenameIcons?: IconMap;
  extensionIcons?: IconMap;
}

function own(map: IconMap | undefined, key: string): string | undefined {
  if (map === undefined || !Object.prototype.hasOwnProperty.call(map, key)) return undefined;
  const value = map[key];
  return typeof value === 'string' ? value : undefined;
}

// A file's icon from the configured maps. A file name wins over an extension, and extensions
// match in lower case with or without the leading dot.
export function detectIcon(name: string, config?: Pick<IconConfig, 'filenameIcons' | 'extensionIcons'>): string | undefined {
  const byName = own(config?.filenameIcons, name);
  if (byName) return byName;
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    const ext = name.substring(dot).toLowerCase();
    return own(config?.extensionIcons, ext) ?? own(config?.extensionIcons, ext.slice(1));
  }
  return undefined;
}

function qualifyIcon(icon: string, defaultIconPack: string): string {
  if (icon.includes(':')) return icon;
  if (GLYPHS.has(icon) || !defaultIconPack) return `${BUILTIN_PACK}:${icon}`;
  return `${defaultIconPack}:${icon}`;
}

// The qualified icon name for a node, or undefined when it shows none. An `icon()` annotation
// always wins; otherwise icons appear only with `showIcons`.
export function getNodeIcon(node: { icon?: string; name: string; nodeType: NodeType }, config: IconConfig): string | undefined {
  if (node.icon === 'none') return undefined;
  if (node.icon) return qualifyIcon(node.icon, config.defaultIconPack);
  if (!config.showIcons) return undefined;
  if (node.nodeType === 'file') {
    const detected = detectIcon(node.name, config);
    if (detected === 'none') return undefined;
    if (detected) return qualifyIcon(detected, config.defaultIconPack);
  }
  return `${BUILTIN_PACK}:${node.nodeType === 'directory' ? 'folder' : 'file'}`;
}

export function iconConfig(config: Config): IconConfig {
  const map = (value: unknown): IconMap | undefined =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as IconMap) : undefined;
  const c = map(config.treeView) ?? {};
  return {
    showIcons: Boolean(c.showIcons),
    defaultIconPack: typeof c.defaultIconPack === 'string' ? c.defaultIconPack : '',
    filenameIcons: map(c.filenameIcons),
    extensionIcons: map(c.extensionIcons),
  };
}
