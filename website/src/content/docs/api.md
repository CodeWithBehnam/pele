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

`supports()` checks whether a diagram type is available. Catch `PeleError` to handle syntax errors and other rendering failures.

```ts
import { PeleError, render, supports } from 'pele';

function draw(source: string, element: HTMLElement) {
  if (!supports(source)) return false;
  try {
    element.innerHTML = render(source).svg;
  } catch (error) {
    if (!(error instanceof PeleError)) throw error;
    element.textContent = error.message;
  }
  return true;
}
```

Error messages include diagram source. Display them with `textContent`. See [Security](/security) for handling untrusted diagrams.

## Imports

The main entry point includes every diagram type. Import individual types or load them on demand to reduce the initial bundle size.

| Import | Contents |
| --- | --- |
| `pele` | API and all diagram types. |
| `pele/core` | API without diagram types. Add types with `register()`. |
| `pele/diagrams/<type>` | One diagram type, as the default export. `<type>` is a name that [`detectType()`](#detecttype) returns, such as `flowchart` or `sequence`. |
| `pele/lazy` | API with asynchronous loading. |
| `pele/global` | The main entry point as a script for a `<script>` tag, which defines the global `pele`. It is `dist/pele.global.js` in the package. |

Register the types you need:

```ts
import { register, render } from 'pele/core';
import flowchart from 'pele/diagrams/flowchart';
import sequence from 'pele/diagrams/sequence';

register(flowchart, sequence);

const { svg } = render(source);
```

Use `pele/lazy` to load each type on first use. `renderAsync()` takes the same arguments as `render()` and returns a promise.

```ts
import { renderAsync } from 'pele/lazy';

const { svg } = await renderAsync(source);
```

`load(type)` loads a type without rendering and resolves to `false` for unsupported types. After loading, `render()` from the same module renders synchronously.

With `core` and `lazy`, [`supports()`](#supports) is `true` only for types that are registered or loaded. Use one of these entry points throughout an app. The main entry point has a separate registry.

## render

```ts
function render(source: string | DiagramModel, options?: RenderOptions): RenderResult
```

Parses Mermaid text, lays out the diagram, and returns it as an SVG string. Throws a [`PeleError`](#peleerror) if the text cannot be rendered.

The same text, options, and font measurements always produce the same SVG.

`render()` also accepts a model returned by [`parse()`](#parse). Use it to render the same diagram more than once, such as at another width, without parsing the text again.

### RenderOptions

All options are optional.

| Option | Type | Description |
| --- | --- | --- |
| `measurer` | `TextMeasurer` | Measures label text. Defaults to a canvas measurer in browsers and a built-in width table elsewhere. See [Text measurement](#text-measurement). |
| `fontFamily` | `string` | Font used to measure labels, and to draw them unless `--pele-font` is set. Defaults to `sans-serif`. [`mount()`](#mount) reads it from CSS. See [Fonts](/theming#fonts). |
| `fontFamilyMono` | `string` | The same for monospace labels and `--pele-font-mono`. Defaults to `monospace`. |
| `fontSize` | `number` | Base font size in pixels. Defaults to `16`. |
| `idPrefix` | `string` | Prefix for accessibility title and description IDs. Use a unique prefix for each diagram on a page. |
| `responsive` | `boolean` | Shrinks the SVG to fit a container narrower than the diagram. It never grows past its natural size. Defaults to `true`. Set `false` for a fixed pixel size. A diagram that sets Mermaid's `useMaxWidth: false` is also fixed. |
| `maxWidth` | `number` | Available width in pixels. Supported layouts adapt to this width without scaling down labels. See [Narrow screens](#narrow-screens). |
| `autoDirection` | `boolean` | Switches supported horizontal diagrams to a vertical layout when they exceed `maxWidth`. Defaults to `true`. |
| `directionBreakpoint` | `number` | Width threshold in pixels for `autoDirection`. Defaults to `640`. |
| `now` | `number \| Date` | Reference time for Gantt today markers and tasks without a start date. Defaults to the current time. |
| `padding` | `number` | Space around the diagram in pixels. |
| `limit` | `number` | Maximum length of the text in characters. The default is 50,000, as in Mermaid. Longer input throws a `PeleError` with the code `limit`. Pass `Infinity` for no limit. |
| `outputLimit` | `number` | Maximum length of the SVG in characters. The default is 4,000,000. A larger diagram throws a `PeleError` with the code `limit`. Pass `Infinity` for no limit. |
| `maxEdges` | `number` | Maximum number of edges in a flowchart. The default is 5,000. A diagram with more throws a `PeleError` with the code `limit`. Diagram configuration cannot change it. Pass `Infinity` for no limit. |
| `linkSchemes` | `string[]` | URL schemes a link may use. The default is `['http', 'https', 'mailto', 'tel']`. Relative addresses are always kept. See [Security](/security#links-and-images). |
| `imageSchemes` | `string[]` | URL schemes an image may use. The default is `['http', 'https']`. |
| `linkRel` | `string` | The `rel` attribute of every link. The default is `'noopener'`. An empty string omits the attribute. See [Security](/security#links-and-images). |
| `links` | `boolean` | Set `false` to render the diagram without links, including relative links and `internal-link` nodes. Defaults to `true`. |
| `images` | `boolean` | Set `false` to render the diagram without images, including relative ones. Defaults to `true`. |
| `icons` | `(name: string) => string \| null \| undefined` | Returns the inner SVG markup for an icon name such as `fa:fa-car`. Icons without markup are omitted. The markup is inserted without filtering, so return only markup you trust. |
| `config` | `object` | Mermaid configuration. Frontmatter and directives in the text take precedence over it. |

### RenderResult

| Field | Type | Description |
| --- | --- | --- |
| `svg` | `string` | The diagram as an `<svg>` element. |
| `width` | `number` | Natural width of the diagram in pixels. |
| `height` | `number` | Height of the diagram in pixels. |
| `type` | `DiagramType` | The detected diagram type, such as `'flowchart'`. |
| `links` | `LinkInfo[]` | Diagram links for attaching navigation handlers. |

Each `LinkInfo` has the `id` of the node that carries the link, its `href`, and `internal`. A node with a `click` link is reported with `internal: false`. A node with the class `internal-link` is reported with `internal: true` and its label text as the `href`. A link with an address that is [not allowed](/security#links-and-images) is not reported.

### Narrow screens

Scaling a diagram to fit a narrow container can make labels too small to read. Pass `maxWidth` to adapt supported layouts while preserving the font size:

```ts
const { svg } = render(source, { maxWidth: container.clientWidth });
```

Layout changes depend on the diagram type:

| Diagram | When it does not fit |
| --- | --- |
| Sankey, XY chart, treemap, Gantt | Fits the available width |
| Pie, radar | Fits the available width, with the legend below the chart |
| Kanban | Columns fold into rows |
| Mindmap | Switches to an indented outline. See [Direction](#direction). |
| Quadrant chart, Wardley map | Reduces width and wraps labels |
| Flowchart, class, state, entity relationship, requirement, use case, agentflow, timeline, git graph, swimlane | Switches to a vertical layout. Swimlane keeps steps in their lanes, with lane headings across the top. See [Direction](#direction). |
| Flowchart, class, C4 | Reduces spacing between nodes and around groups. C4 also reduces columns within boundaries and places relation labels beside their arrows, ignoring manual label offsets in the compact layout. |
| Sequence | Wraps participant names, messages and notes; reduces spacing between participants |
| Railroad | Wraps long sequences onto connected rows |
| Journey, event modeling | Switches to vertical steps, retaining actors, scores, lanes and frame references |
| Packet | Splits fields into shorter rows, preserving bit numbers and wrapping field labels |
| Ishikawa | Switches to a vertical cause tree |
| Tree view | Wraps filenames and puts descriptions beneath them |
| Architecture, block | Wraps labels and reduces spacing while retaining grid positions and columns |
| Other types | Keeps the original layout |

Some diagrams still exceed `maxWidth` when their participants, nested boundaries, explicit columns or link directions need more room. `maxWidth` is a layout hint; it does not clip content or guarantee a maximum output width.

#### Direction

When a diagram exceeds `maxWidth` and the available width is below 640 pixels, supported horizontal layouts switch to a vertical layout if that reduces their width. For example, `flowchart LR` renders as `flowchart TB`.

Set `autoDirection: false` to preserve the source direction. Use `directionBreakpoint` to change the width threshold. Subgraph directions and vertical diagrams retain their direction. Journey, event modeling, packet and Ishikawa use the same breakpoint and `autoDirection` setting for their alternate layouts.

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

`mount()` automatically:

- Measures labels using `--pele-font` and `--pele-font-mono`, or the container font if they are not set. The `fontFamily` and `fontFamilyMono` options override this.
- Uses the container width as [`maxWidth`](#narrow-screens), unless a value is supplied.
- Re-renders when a width change affects the layout, and when a web font that was loading when it rendered finishes loading. A diagram rendered before any other web font loaded is rendered again the next time it is refreshed or shown.
- Lets a diagram that was shrunk to fit be zoomed and panned. See [Zoom](#zoom).

Call `refresh()` after a CSS change that affects fonts, such as a theme or font setting, and after moving the container to another window or back into the document. It re-renders only if the width or the fonts have changed, so it is cheap to call when nothing has.

Use a container with a width independent of its content, such as a block element. `mount()` throws a [`PeleError`](#peleerror) as `render()` does.

`mount()` renders at once, even into a container that is hidden or not in the document, so that the page can lay out around the diagram. A container that is not in the document has no font to read, so the diagram is rendered again when it is shown. While the container is hidden or not in the document, `update()` and `refresh()` leave it as it is, and it is rendered when it is shown.

Mounting a diagram in a container that already has one replaces it. A container that is removed from the page can be garbage collected without calling `destroy()`.

An error thrown by `onRender` propagates to the caller after the diagram has been rendered.

`MountOptions` extends [`RenderOptions`](#renderoptions) with:

| Option | Type | Description |
| --- | --- | --- |
| `onRender` | `(result: RenderResult) => void` | Called after each render. Use it to attach link handlers or other SVG interactions. |
| `zoom` | `boolean \| 'auto' \| ZoomOptions` | Whether the diagram can be zoomed and panned. `'auto'`, the default, allows it for a diagram that was shrunk to fit. `true` allows it for every diagram. `false` turns it off. Pass [`ZoomOptions`](#zoom) to configure it. |
| `onError` | `(error: unknown) => void` | Called when a render that no call is waiting for fails, such as one put off while the container was hidden, or one after a resize. The diagram stays as it was. |
| `sanitize` | `(svg: string) => Node` | Turns each SVG into the node that is inserted, such as your app's HTML sanitizer. By default the SVG is set as the container's HTML. It runs on every render, including after a resize, so check its cost on a large diagram. |

| Member | Description |
| --- | --- |
| `result` | Current `RenderResult`. |
| `zoom` | The diagram's [`Zoom`](#zoom), or `undefined` if the `zoom` option is `false`. |
| `update(text, options?)` | Updates the source or options. If the text cannot be rendered, it throws and the diagram stays as it was. |
| `refresh()` | Re-renders if the container width or the fonts have changed, or a web font has loaded, since the last render. |
| `destroy()` | Stops observing the container. Leaves the diagram in place. |

With [`pele/lazy`](#imports), `mountAsync()` takes the same arguments, fetches the diagram type first, and returns a promise.

### Zoom

Zooming never changes the size of the container. The SVG shows part of the diagram at a larger scale. In a container sized by the diagram, the SVG keeps its size. In a container with room to spare, such as a panel of a fixed height, the zoomed SVG fills it, padding included.

A diagram that can be zoomed has buttons to zoom in and out, and a reset button while it is zoomed.

| Input | Action |
| --- | --- |
| Pinch, or `Ctrl`/`⌘` + wheel | Zoom at the pointer |
| Drag | Pan a zoomed diagram |
| Double-click | Zoom in, or reset |
| `+` `-` `0` and arrow keys | Zoom, reset, and pan when the diagram has focus |

The wheel without a modifier key scrolls the page. On touch screens, one finger scrolls the page until the diagram is zoomed. A diagram that fits its container listens to no wheel events, so it never delays scrolling.

`enableZoom()` adds the same behavior to an SVG already in the page, such as one from `render()`.

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

The buttons are in a `<div class="pele pele-zoom">` after the SVG, with the classes `pele-zoom-in`, `pele-zoom-out`, and `pele-zoom-reset`. They use the diagram's color variables. Move them with `--pele-zoom-top`, `--pele-zoom-right`, `--pele-zoom-bottom`, and `--pele-zoom-left`. The container is given `position: relative` if it is not positioned.

## parse

```ts
function parse(text: string, options?: { limit?: number; maxEdges?: number; config?: object }): DiagramModel
```

Parses Mermaid text and returns the diagram model without laying it out or rendering it. Throws a `PeleError` for unsupported diagram types and syntax errors.

Pass the model to [`render()`](#render) in place of the text. The `limit`, `maxEdges`, and `config` options apply when the text is parsed, so `render()` ignores them for a model.

```ts
const model = parse(source);
const wide = render(model);
const narrow = render(model, { maxWidth: 320 });
```

For a flowchart, the model has `direction`, `nodes`, `edges`, `subgraphs`, `classes`, and `tooltips`, along with `title`, `accTitle`, and `accDescr` when the source sets them.

```ts
const model = parse('flowchart LR\n  A[Start] --> B[End]');

model.direction;        // 'LR'
model.nodes.get('A');   // { id: 'A', text: 'Start', … }
model.edges.length;     // 1
```

## detectType

```ts
function detectType(text: string): DiagramType | null
```

Returns the diagram type that the text declares, or `null` if it is not a Mermaid diagram. Frontmatter, directives, and comments before the declaration are skipped.

`detectType()` identifies diagram types independently of which types are registered. `'flowchart'`, `'sequence'`, `'class'`, `'state'`, `'er'`, `'pie'`, and `'gantt'` are some of the values it returns.

```ts
detectType('graph TD\n  A --> B');           // 'flowchart'
detectType('sequenceDiagram\n  A->>B: Hi');  // 'sequence'
detectType('Hello');                         // null
```

## supports

```ts
function supports(text: string): boolean
```

Returns `true` if the text declares a diagram type that Pele can render. It does not check the rest of the syntax, so `render()` can still throw a syntax error for text that `supports()` accepts.

```ts
supports('flowchart LR\n  A --> B');         // true
supports('sequenceDiagram\n  A->>B: Hi');    // true
supports('Hello');                         // false
```

## PeleError

`render()` and `parse()` throw a `PeleError` when they cannot handle the text. It extends `Error`.

| Property | Type | Description |
| --- | --- | --- |
| `message` | `string` | Description of the problem. Syntax errors follow the wording of Mermaid's parser errors. |
| `code` | `string` | One of the error codes below. |
| `type` | `string \| null` | The detected diagram type, when known. |
| `line` | `number` | Line of the problem, starting at 1. `0` when the error has no position. |
| `column` | `number` | Column of the problem, starting at 1. `0` when the error has no position. |
| `snippet` | `string` | The source line followed by a line that marks the column. Empty when the error has no position. |

### Error codes

| Code | Meaning |
| --- | --- |
| `unsupported-diagram` | No diagram type detected, or the type is not registered. |
| `syntax` | The diagram could not be parsed. `line`, `column`, and `snippet` locate the problem. |
| `semantic` | The diagram parsed but describes something invalid. |
| `limit` | The text is longer than the `limit` option, the SVG is longer than the `outputLimit` option, a flowchart has more edges than the `maxEdges` option, or the diagram is nested too deeply to process. |

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

Pele sizes nodes from the measured width of their labels. In a browser it measures with a canvas, using the `fontFamily` and `fontFamilyMono` options. Without a canvas, such as in Node.js, it estimates widths from a built-in table of sans-serif metrics.

Pass a `measurer` to supply your own measurements.

```ts
interface TextMeasurer {
  width(text: string, size: number, style: number): number;
}
```
