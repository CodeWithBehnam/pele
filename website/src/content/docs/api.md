---
title: API
description: Render Mermaid diagrams in your app.
---

Use `render()` to generate SVG or `mount()` to display a diagram that adapts to its container. Both are synchronous. The [lazy entry point](#imports) loads diagram types asynchronously.

## Usage

Pass Mermaid syntax to `render()` and insert the returned SVG into your page.

```ts
import { render } from 'pele';

const { svg } = render(`flowchart LR
  A[Mermaid text] --> B[SVG]`);

document.querySelector('#diagram').innerHTML = svg;
```

Catch `PeleError` to display an error message:

```ts
import { PeleError, render } from 'pele';

try {
  container.innerHTML = render(source).svg;
} catch (error) {
  if (!(error instanceof PeleError)) throw error;
  container.textContent = error.message;
}
```

Error messages include diagram source. Display them with `textContent`. See [Security](/security) for handling untrusted diagrams.

## Imports

The main entry point includes every diagram type. Import individual types or load them on demand to reduce the initial bundle size.

| Import | Contents |
| --- | --- |
| `pele` | API and all diagram types. |
| `pele/core` | API without diagram types. Add types with `register()`. |
| `pele/diagrams/<type>` | One diagram type, such as `flowchart` or `sequence`. |
| `pele/lazy` | API with asynchronous loading. |
| `pele/global` | Browser script that defines the global `pele`. Available at `dist/pele.global.js` in the package. |

Register the types you need:

```ts
import { register, render } from 'pele/core';
import flowchart from 'pele/diagrams/flowchart';
import sequence from 'pele/diagrams/sequence';

register(flowchart, sequence);

const { svg } = render(source);
```

Use `pele/lazy` to load each type on first use:

```ts
import { renderAsync } from 'pele/lazy';

const { svg } = await renderAsync(source);
```

To load a type ahead of time, use `await load('flowchart')` from `pele/lazy`.

Keep your API imports on the same entry point. With `core` and `lazy`, [`supports()`](#supports) checks the types you have registered or loaded.

## render

```ts
function render(source: string | DiagramModel, options?: RenderOptions): RenderResult
```

Returns the diagram as an SVG string. See [`PeleError`](#peleerror) for error handling.

You can also render a model returned by [`parse()`](#parse).

### RenderOptions

All options are optional.

| Option | Type | Description |
| --- | --- | --- |
| `measurer` | `TextMeasurer` | Measures label text. Defaults to a canvas measurer in browsers and a built-in width table elsewhere. See [Text measurement](#text-measurement). |
| `fontFamily` | `string` | Label font. Defaults to `sans-serif`. See [Fonts](/theming#fonts). |
| `fontFamilyMono` | `string` | Monospace label font. Defaults to `monospace`. |
| `fontSize` | `number` | Base font size in pixels. Defaults to `16`. |
| `idPrefix` | `string` | Prefix for accessibility title and description IDs. Use a unique prefix for each diagram on a page. |
| `responsive` | `boolean` | Allows the SVG to shrink to fit its container. Defaults to `true`. Set `false` for a fixed pixel size. |
| `maxWidth` | `number` | Available width in pixels. See [Narrow screens](#narrow-screens). |
| `autoDirection` | `boolean` | Allows supported diagrams to switch to a vertical layout. Defaults to `true`. |
| `directionBreakpoint` | `number` | Width threshold in pixels for `autoDirection`. Defaults to `640`. |
| `now` | `number \| Date` | Reference time for Gantt today markers and tasks without a start date. Defaults to the current time. |
| `padding` | `number` | Space around the diagram in pixels. |
| `limit` | `number` | Source length limit in characters. Defaults to 50,000. See [Limits](/security#limits). |
| `outputLimit` | `number` | SVG length limit in characters. Defaults to 4,000,000. |
| `maxEdges` | `number` | Edge limit for flowcharts and agentflow. Defaults to 5,000. |
| `linkSchemes` | `string[]` | Allowed link schemes. Defaults to `['http', 'https', 'mailto', 'tel']`. See [Security](/security#links-and-images). |
| `imageSchemes` | `string[]` | URL schemes an image may use. The default is `['http', 'https']`. |
| `linkRel` | `string` | The `rel` attribute of URL links. Defaults to `'noopener'`. See [Security](/security#links-and-images). |
| `links` | `boolean` | Enables links. Defaults to `true`. |
| `images` | `boolean` | Enables images. Defaults to `true`. |
| `icons` | `(name: string) => string \| null \| undefined` | Supplies trusted SVG markup for icon names such as `fa:fa-car`. See [Security](/security#app-responsibilities). |
| `config` | `object` | Default Mermaid settings. Frontmatter and directives override them. Support varies by diagram type. |

### RenderResult

| Field | Type | Description |
| --- | --- | --- |
| `svg` | `string` | The diagram as an `<svg>` element. |
| `width` | `number` | Natural width of the diagram in pixels. |
| `height` | `number` | Height of the diagram in pixels. |
| `type` | `DiagramType` | The detected diagram type, such as `'flowchart'`. |
| `links` | `LinkInfo[]` | Diagram links for attaching navigation handlers. |

Each `LinkInfo` has an `id`, `href`, and `internal` flag. Internal links contain note names in `href`. See [Security](/security#app-responsibilities) before adding link handlers.

### Narrow screens

Pass `maxWidth` to let supported layouts adapt to the available width:

```ts
const { svg } = render(source, { maxWidth: container.clientWidth });
```

Pele may wrap labels, reduce spacing, or rearrange the diagram. Some layouts still need more room than the requested width.

#### Direction

Below 640 pixels, supported diagrams may switch to a vertical layout. For example, a wide `flowchart LR` may render as `flowchart TB`.

Set `autoDirection: false` to preserve the source direction. Use `directionBreakpoint` to change the threshold.

[`mount()`](#mount) measures the container and re-renders when its width changes. With `render()`, handle width changes yourself.

## mount

```ts
function mount(element: HTMLElement, text: string, options?: MountOptions): Mounted
```

Renders a diagram into an element and adapts the layout when the container is resized.

```ts
import { mount } from 'pele';

const diagram = mount(container, source);
```

`mount()` reads [fonts from CSS](/theming#fonts) and uses the container width as `maxWidth`. Diagrams that shrink to fit can be [zoomed](#zoom).

Use `update()` to change the source:

```ts
diagram.update('flowchart LR\n  A[Draft] --> B[Published]');
```

Call `refresh()` after changing fonts or moving the container. Resizes and pending web fonts are handled automatically.

Use a container whose width does not depend on the diagram, such as a block element.

`MountOptions` extends [`RenderOptions`](#renderoptions) with:

| Option | Type | Description |
| --- | --- | --- |
| `onRender` | `(result: RenderResult) => void` | Called after each render. Use it to attach link handlers or other SVG interactions. |
| `zoom` | `boolean \| 'auto' \| ZoomOptions` | Defaults to `'auto'`: enables zoom when the diagram shrinks to fit. Use `true` to always enable zoom, `false` to disable it, or [`ZoomOptions`](#zoom) to configure it. |
| `onError` | `(error: unknown) => void` | Handles errors from automatic redraws. |
| `sanitize` | `(svg: string) => Node` | Passes each SVG through your app's sanitizer before insertion. By default, the SVG is inserted as HTML. |

| Member | Description |
| --- | --- |
| `result` | Current `RenderResult`. |
| `zoom` | The diagram's [`Zoom`](#zoom), or `undefined` if the `zoom` option is `false`. |
| `update(text, options?)` | Updates the source and optionally replaces the options. Hidden diagrams may wait until visible to redraw. |
| `refresh()` | Re-renders if the container width or the fonts have changed since the last render. |
| `destroy()` | Stops observing the container. Leaves the diagram in place. |

Use `await mountAsync(container, source)` from [`pele/lazy`](#imports) to load and mount a diagram. Before updating to another diagram type, load it with `load()`.

### Zoom

Zoom lets readers enlarge and pan a diagram within its container. To disable it:

```ts
mount(container, source, { zoom: false });
```

| Input | Action |
| --- | --- |
| Pinch, or `Ctrl`/`⌘` + wheel | Zoom at the pointer |
| Drag | Pan a zoomed diagram |
| Double-click | Zoom in, or reset |
| `+` `-` `0` and arrow keys | Zoom, reset, and pan when the diagram has focus |

The wheel without a modifier key scrolls the page.

Use `enableZoom()` to add zoom to an existing diagram:

```ts
function enableZoom(element: HTMLElement, options?: ZoomOptions): Zoom
```

```ts
import { enableZoom, render } from 'pele';

container.innerHTML = render(source).svg;
const zoom = enableZoom(container);
```

| Option | Type | Description |
| --- | --- | --- |
| `always` | `boolean` | Allows zoom for a diagram that fits its container. Defaults to `false`. |
| `maxScale` | `number` | Largest scale, where `1` is the diagram's natural size. Defaults to `3`. |
| `controls` | `boolean` | Shows the zoom buttons. Defaults to `true`. |
| `labels` | `{ zoomIn?, zoomOut?, reset? }` | Accessible names of the buttons. Defaults to English. |

| Member | Description |
| --- | --- |
| `scale` | Current scale, where `1` is the diagram's natural size. |
| `fit` | Scale at which the whole diagram is shown. |
| `zoomBy(factor)` | Multiplies the scale. |
| `zoomTo(scale)` | Sets the scale. |
| `reset()` | Returns to the scale that fits. |
| `refresh()` | Call after replacing the SVG in the container. |
| `destroy()` | Removes the behavior and resets the diagram. |

The buttons use the diagram's color variables. Position them with `--pele-zoom-top`, `--pele-zoom-right`, `--pele-zoom-bottom`, and `--pele-zoom-left`.

## parse

```ts
function parse(text: string, options?: { limit?: number; maxEdges?: number; config?: object }): DiagramModel
```

Returns a model of the diagram. See [`PeleError`](#peleerror) for error handling.

Parse once to render the diagram at different widths:

```ts
const model = parse(source);
const wide = render(model);
const narrow = render(model, { maxWidth: 320 });
```

Pass `limit`, `maxEdges`, and `config` to `parse()` when creating the model.

## detectType

```ts
function detectType(text: string): DiagramType | null
```

Identifies the diagram type. Returns `null` if no type is recognized. The type does not need to be registered.

```ts
detectType('graph TD\n  A --> B');           // 'flowchart'
detectType('sequenceDiagram\n  A->>B: Hi');  // 'sequence'
detectType('Hello');                         // null
```

## supports

```ts
function supports(text: string): boolean
```

Checks whether the diagram type is available. It does not validate the diagram's syntax.

```ts
supports('flowchart LR\n  A --> B');         // true
supports('sequenceDiagram\n  A->>B: Hi');    // true
supports('Hello');                         // false
```

## PeleError

Catch `PeleError` to handle parsing and rendering failures. It extends `Error`.

| Property | Type | Description |
| --- | --- | --- |
| `message` | `string` | Description of the problem. Display as text. |
| `code` | `string` | One of the error codes below. |
| `type` | `string \| null` | The detected diagram type, when known. |
| `line` | `number` | Line of the problem, starting at 1. `0` when the error has no position. |
| `column` | `number` | Column of the problem, starting at 1. `0` when the error has no position. |
| `snippet` | `string` | The source line followed by a line that marks the column. Empty when the error has no position. |

### Error codes

| Code | Meaning |
| --- | --- |
| `unsupported-diagram` | No diagram type detected, or the type is not registered. |
| `syntax` | The diagram could not be parsed. Position information is provided when available. |
| `semantic` | The diagram parsed but describes something invalid. |
| `limit` | A size or edge limit was exceeded, or the diagram is nested too deeply. |

```ts
try {
  render(source);
} catch (error) {
  if (error instanceof PeleError && error.code === 'syntax') {
    console.log(`Line ${error.line}, column ${error.column}`);
    console.log(error.snippet);
  }
}
```

## Text measurement

Pele measures labels to size nodes. It uses canvas measurements in browsers and estimates from a built-in width table when canvas is unavailable.

Pass a `measurer` to supply your own measurements. The `style` argument combines flags for bold (`1`), italic (`2`), and monospace (`4`); `0` is regular text.

```ts
interface TextMeasurer {
  width(text: string, size: number, style: number): number;
}
```
