---
title: Security
description: Render and display untrusted diagrams.
---

Pele accepts untrusted diagram source, such as diagrams in shared notes. It filters SVG output and limits source and output size. Your app controls icon markup, navigation, and how errors are displayed.

## What the SVG contains

The SVG is made only of drawing elements: shapes, paths, text, groups, links, and images. It has no scripts, no event handlers, no `<style>` element, no `<foreignObject>`, and no HTML. Diagram text is escaped before insertion into the SVG.

Styles from `style` and `classDef` statements are kept only for a fixed list of properties such as `fill`, `stroke`, and `font-weight`. A value that contains `url(`, a semicolon, or anything else that could reach outside the declaration is dropped.

`click … call` and `click … callback` statements are parsed and ignored. Pele never runs code from a diagram, and Mermaid's `securityLevel` setting has no effect.

## Links and images

Nodes can contain links, and flowchart nodes can display images. Pele allows relative URLs and these schemes:

| Used for | Schemes |
| --- | --- |
| Links | `http`, `https`, `mailto`, `tel` |
| Images | `http`, `https` |

A link or image with any other address is omitted, and the node is rendered without it. That includes `file:` addresses, network shares such as `//host/share`, and schemes that open another application. This is stricter than Mermaid, which blocks only `javascript:`, `data:`, and `vbscript:`.

Use the [`linkSchemes`](/api#renderoptions) and [`imageSchemes`](/api#renderoptions) options to change the lists. The schemes you pass replace the defaults:

```ts
render(source, { linkSchemes: ['http', 'https', 'mailto', 'obsidian'] });
```

`javascript:`, `data:`, and `vbscript:` are always blocked.

Images load when the diagram is displayed, exposing the request to the image server. Pass `imageSchemes: []` to allow only relative image URLs, or block image requests with a content security policy.

To preview a file from an unknown source, turn links and images off. Relative addresses and `internal-link` nodes are omitted too:

```ts
render(source, { links: false, images: false });
```

Links have `rel="noopener"`. A `target` is written only when it is `_self`, `_blank`, `_parent`, or `_top`.

Use the [`linkRel`](/api#renderoptions) option to set a different `rel`. A site where anyone can publish a diagram can add `nofollow`, so that search engines do not credit the links. The value you pass replaces the default:

```ts
render(source, { linkRel: 'noopener nofollow' });
```

## Limits

| Limit | Default | Option |
| --- | --- | --- |
| Length of the source | 50,000 characters | [`limit`](/api#renderoptions) |
| Length of the SVG | 4,000,000 characters | [`outputLimit`](/api#renderoptions) |
| Edges in a flowchart | 5,000 | [`maxEdges`](/api#renderoptions) |

A diagram over a limit, or one nested too deeply to process, throws a [`PeleError`](/api#peleerror) with the code `limit`. Mermaid limits source size but not output size. Short source can produce a large SVG that stalls the page.

In a flowchart, `A & B --> C & D` creates an edge for every pair, so a short line can describe millions of edges. The edge limit stops this while the source is parsed.

`render()` is synchronous and has no time limit. If you raise the limits for untrusted source, render in a worker that can be terminated.

## App responsibilities

**Error messages are text.** A `PeleError` message and its `snippet` quote the diagram source. Show them with `textContent`, never with `innerHTML`.

```ts
try {
  element.innerHTML = render(source).svg;
} catch (error) {
  element.textContent = error.message;
}
```

**Icon markup is trusted.** The [`icons`](/api#renderoptions) resolver returns SVG markup that is inserted without filtering. Look up names in an icon set you control. Return nothing for unknown names, and do not interpolate names into markup.

**Internal links contain note names.** Nodes with the class `internal-link` appear in [`links`](/api#renderresult) with `internal: true`. The node label becomes the `href` and `data-href` value. Resolve it as a note name rather than opening it as a URL.

**Link URLs are filtered** in both the SVG and the `links` result. Apply your app's navigation policy when handling clicks.

**Options are trusted.** Values you pass in `options`, including `config`, come from your app. Do not fill them from the diagram or from anything else the author controls. Frontmatter and directives in the diagram are read as untrusted input.

**SVG changes need review.** These guarantees apply to the returned SVG. Check any transformations your app applies before displaying it.

**A sanitizer can check the SVG too.** To pass each SVG through your app's HTML sanitizer before it is inserted, give [`mount()`](/api#mount) a `sanitize` function. Check that it keeps SVG elements, `viewBox`, and the `target` of links. It runs after every resize that changes the layout, so measure it on a large diagram.

## Reporting a vulnerability

Report a security problem privately through [GitHub](https://github.com/obsidianmd/pele/security/advisories/new), not in a public issue.
