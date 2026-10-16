# Security

Pele escapes diagram text, filters links and styles, and limits source and output size.

## Reporting a vulnerability

Report a security problem privately through [GitHub](https://github.com/obsidianmd/pele/security/advisories/new), not in a public issue.

Please report diagrams that bypass URL filtering, inject scripts or HTML, or take unreasonably long to render at the default limits.

## Handling untrusted diagrams

- Display errors with `textContent`. Error messages can contain text from the diagram.
- Supply icons from a set you trust. Pele inserts icon markup without filtering.
- Handle internal links as note names. Their values are not filtered as URLs.
- Keep control of `options` and `options.config`. Do not let diagram authors supply them directly.
- Images can make network requests when displayed. Pass `links: false` and `images: false` to disable links and images.
- To use your app's SVG sanitizer, pass a `sanitize` function to `mount()`.
- For a time limit, render in a worker that your app can terminate.

See the [security documentation](https://pele.run/security) for URL filtering, default limits, and examples.
