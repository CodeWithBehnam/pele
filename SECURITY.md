# Security

Pele accepts untrusted diagram source and filters the SVG it returns. Apps can insert the returned SVG directly into a page when the responsibilities below are met.

## Reporting a vulnerability

Report a security problem privately through [GitHub](https://github.com/obsidianmd/pele/security/advisories/new), not in a public issue.

A report is in scope if a diagram can make Pele's output run script, load a resource other than an allowed link or image, break out of the SVG, or take unreasonably long to render at the default limits.

## What Pele guarantees

- The SVG has only drawing elements, links, and images. It has no scripts, event handlers, `<style>` elements, `<foreignObject>`, or HTML.
- Diagram text is escaped. Styles are limited to a fixed list of properties and cannot contain `url(`.
- `click … call` and `click … callback` statements are ignored. Pele never runs code from a diagram.
- A link is kept only if it is relative or uses `http`, `https`, `mailto`, or `tel`. An image is kept only if it is relative or uses `http` or `https`. A link or image with any other address is omitted. The `linkSchemes` and `imageSchemes` options change the lists, and `links: false` and `images: false` omit them all. `javascript:`, `data:`, and `vbscript:` are always refused.
- Every link has `rel="noopener"`, or the value of the `linkRel` option.
- Source longer than 50,000 characters, output longer than 4,000,000 characters, and flowcharts with more than 5,000 edges are refused with a `PeleError` of code `limit`. The `limit`, `outputLimit`, and `maxEdges` options change this.

## App responsibilities

- Show a `PeleError` message as text, with `textContent`. It quotes the diagram source.
- Return only trusted markup from the `icons` resolver. It is inserted without filtering. Look up names in an icon set you control, and do not interpolate names into markup.
- Treat an `internal-link` label, in `links` and in `data-href`, as the name of a note. Do not open it as a URL.
- Do not fill `options` or `options.config` from the diagram. They are trusted.
- Images load when the diagram is displayed. Pass `imageSchemes: []` to allow only relative image URLs, or block image requests with a content security policy.
- `mount()` sets each SVG as the container's HTML. To pass it through your own sanitizer first, give `mount()` a `sanitize` function.
- `render()` has no time limit. If you raise the limits for untrusted source, render in a worker that can be terminated.
