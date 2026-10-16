import { esc } from '../svg/builder.js';
import { decodeEntities } from '../text/entities.js';
import type { LinkInfo, RenderOptions } from '../types.js';

const BLANK = 'about:blank';
const RE_INVALID_PROTOCOL = /^([^\w]*)(javascript|data|vbscript)/im;
const RE_HTML_ENTITIES = /&#(\w+)(^\w|;)?/g;
const RE_HTML_CTRL_ENTITY = /&(newline|tab);/gi;
const RE_CTRL = /[\u0000-\u001F\u007F-\u009F -‍﻿]/gim;
const RE_SCHEME = /^.+(:|&colon;)/gim;
const RE_WS_ESCAPE = /(\\|%5[cC])((%(6[eE]|72|74))|[nrt])/g;

function decode(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

// Follows the algorithm of @braintree/sanitize-url, which Mermaid applies to click targets.
export function sanitizeUrl(url: string): string {
  if (!url) return BLANK;
  let decoded = decode(url.trim());
  let more: RegExpMatchArray | null;
  let rounds = 0;
  do {
    // Each round peels one layer of encoding. A URL wrapped this many times is not a real one.
    if (++rounds > 32) return BLANK;
    decoded = decoded
      .replace(RE_CTRL, '')
      .replace(RE_HTML_ENTITIES, (_m, dec) => String.fromCharCode(dec))
      .replace(RE_HTML_CTRL_ENTITY, '')
      .replace(RE_CTRL, '')
      .replace(RE_WS_ESCAPE, '')
      .trim();
    decoded = decode(decoded);
    more =
      decoded.match(RE_CTRL) ||
      decoded.match(RE_HTML_ENTITIES) ||
      decoded.match(RE_HTML_CTRL_ENTITY) ||
      decoded.match(RE_WS_ESCAPE);
  } while (more && more.length > 0);

  if (!decoded) return BLANK;
  if (decoded[0] === '.' || decoded[0] === '/') return decoded;

  const trimmed = decoded.trimStart();
  const scheme = trimmed.match(RE_SCHEME);
  if (!scheme) return decoded;

  const protocol = scheme[0].toLowerCase().trim();
  if (RE_INVALID_PROTOCOL.test(protocol)) return BLANK;

  const normalized = trimmed.replace(/\\/g, '/');
  if (protocol === 'mailto:' || protocol.includes('://')) return normalized;

  if (protocol === 'http:' || protocol === 'https:') {
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      return BLANK;
    }
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
  }
  return normalized;
}

// A URL as written in a diagram: entity codes are read first, so they cannot hide a scheme.
export function safeUrl(url: string): string {
  return sanitizeUrl(decodeEntities(url));
}

const LINK_SCHEMES = ['http', 'https', 'mailto', 'tel'];
const IMAGE_SCHEMES = ['http', 'https'];
const RE_SCHEME_NAME = /^([a-z][a-z0-9+.-]*):/i;
const RE_NETWORK_PATH = /^[\\/]{2}/;

// Stricter than Mermaid, which lets any scheme but three through: a diagram in a shared note
// could otherwise open a local file, a network share, or another application.
function allow(url: string, schemes: readonly string[]): string | undefined {
  if (RE_NETWORK_PATH.test(url)) return undefined;
  const scheme = RE_SCHEME_NAME.exec(url);
  return !scheme || schemes.includes(scheme[1].toLowerCase()) ? url : undefined;
}

// Both take a URL that sanitizeUrl has passed, and keep it only when it is relative or its
// scheme is one the host allows. One that is refused is left out of the drawing: written as
// `about:blank`, a link would still take the page it is in somewhere when clicked.
export function linkUrl(url: string, options: RenderOptions): string | undefined {
  return options.links === false ? undefined : allow(url, options.linkSchemes ?? LINK_SCHEMES);
}

export function imageUrl(url: string, options: RenderOptions): string | undefined {
  return options.images === false ? undefined : allow(url, options.imageSchemes ?? IMAGE_SCHEMES);
}

export function linked(body: string, url: string, id: string, links: LinkInfo[], options: RenderOptions, attrs = ''): string {
  const href = linkUrl(url, options);
  if (href === undefined) return body;
  links.push({ id, href, internal: false });
  return `<a href="${esc(href)}"${attrs}${relAttr(options)}>${body}</a>`;
}

export function relAttr(options: RenderOptions): string {
  const rel = options.linkRel ?? 'noopener';
  return rel ? ` rel="${esc(rel)}"` : '';
}
