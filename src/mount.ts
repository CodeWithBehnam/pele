import type { DiagramModel } from './models.js';
import { forgetTextWidths } from './text/measurer.js';
import type { RenderOptions, RenderResult } from './types.js';
import { room, windowOf } from './window.js';
import { zoomWith, type Zoom, type ZoomOptions } from './zoom.js';

export interface MountOptions extends RenderOptions {
  // Called after the diagram is put in the element, and again each time it is drawn anew.
  onRender?: (result: RenderResult) => void;
  // Whether the diagram can be enlarged and moved about in its box. By default, 'auto', one
  // that was shrunk to fit can be. `true` lets any diagram be, and `false` none. Options for
  // the zoom can be given in place of these.
  zoom?: boolean | 'auto' | ZoomOptions;
  // Turns the drawing's markup into what the element is given, such as a host's HTML sanitizer.
  // Without it the markup is set as the element's HTML.
  sanitize?: (svg: string) => Node;
}

export interface Mounted {
  readonly result: RenderResult;
  // The diagram's zoom, unless the `zoom` option is false.
  readonly zoom: Zoom | undefined;
  // Draws other text, or the same text with other options, in the same element. Text that
  // cannot be parsed throws, and leaves the diagram as it was. A hidden element is drawn when it
  // is shown. If `onRender` throws, the new drawing is already in place and stays.
  update(text: string, options?: MountOptions): void;
  // Draws again if what the drawing depends on has changed since it was drawn: the element's
  // width, its fonts, or a font that was still loading. An element that is hidden or out of the
  // document is left until it is shown. For after a change of theme or font, and after the
  // element is put back in a document or moved to another window.
  refresh(): void;
  // Stops watching the element. What it shows stays.
  destroy(): void;
}

// What a diagram is parsed and drawn with: the functions of the entry point that mounted it.
export interface Engine {
  parse(text: string, options: RenderOptions): DiagramModel;
  render(model: DiagramModel, options: RenderOptions): RenderResult;
}

interface Fonts {
  family?: string;
  mono?: string;
}

// The fonts CSS gives the diagram. A variable may be set on the drawing itself, which the
// element that holds it does not inherit, so a drawing that is there is the one asked.
function fontsFor(style: CSSStyleDeclaration, drawing: HTMLElement | null): Fonts {
  const own = drawing ? windowOf(drawing).getComputedStyle(drawing) : style;
  return {
    family: own.getPropertyValue('--pele-font').trim() || style.fontFamily || undefined,
    mono: own.getPropertyValue('--pele-font-mono').trim() || undefined,
  };
}

// Fonts that are still loading, as one promise for each set however many diagrams wait on it.
// Widths measured before they load are those of a fallback, so they are forgotten once then.
const settling = new WeakMap<FontFaceSet, Promise<void>>();

function settled(fonts: FontFaceSet): Promise<void> {
  let done = settling.get(fonts);
  if (!done) {
    done = fonts.ready.then(() => {
      settling.delete(fonts);
      forgetTextWidths();
    });
    settling.set(fonts, done);
  }
  return done;
}

// The fonts of the element's document, and of the script's, which measures with its canvas.
function loadingFonts(element: HTMLElement): FontFaceSet[] {
  const sets = new Set([element.ownerDocument?.fonts, (globalThis as { document?: Document }).document?.fonts]);
  return [...sets].filter((fonts): fonts is FontFaceSet => fonts?.status === 'loading');
}

const mounts = new WeakMap<HTMLElement, Mounted>();

// Puts a diagram in an element and keeps it fitted to the element's width. The element should
// be one whose width does not depend on what it holds, such as a block.
export function mountWith(engine: Engine, element: HTMLElement, text: string, options: MountOptions = {}): Mounted {
  // An element shows one diagram. Mounting another stops the one before it.
  mounts.get(element)?.destroy();

  let source = text;
  let settings = options;
  let model = engine.parse(text, options);
  let natural: RenderResult;
  let shown: RenderResult;
  let fonts: Fonts = {};
  // Whether the width there is can change how this diagram is drawn. Not known until asked.
  let adapts: boolean | undefined;
  let drawnFor = -1;
  // Whether what is shown is not what the element should show: it was drawn out of the
  // document, with neither fonts nor a width to read, or text or fonts came while it was hidden.
  // It is drawn anew when it is next shown.
  let stale = false;
  let waiting = false;
  let destroyed = false;

  const fit = (style: CSSStyleDeclaration, fresh: boolean): RenderResult => {
    const { onRender, sanitize, ...rest } = settings;
    const base: RenderOptions = {
      ...rest,
      fontFamily: rest.fontFamily ?? fonts.family,
      fontFamilyMono: rest.fontFamilyMono ?? fonts.mono,
      maxWidth: undefined,
    };
    if (fresh) {
      natural = engine.render(model, base);
      adapts = undefined;
    }
    const available = settings.maxWidth ?? room(element, style);
    drawnFor = available;
    if (available > 0 && available < natural.width) {
      // Drawn for no room at all, a diagram that the width can change comes out differently.
      adapts ??= engine.render(model, { ...base, maxWidth: 1 }).svg !== natural.svg;
      if (adapts) return engine.render(model, { ...base, maxWidth: available });
    }
    return natural;
  };

  const put = (svg: string): void => {
    if (settings.sanitize) element.replaceChildren(settings.sanitize(svg));
    else element.innerHTML = svg;
  };

  // A diagram drawn while a font is loading is drawn anew once it has loaded.
  const awaitFonts = (): void => {
    if (waiting) return;
    const loading = loadingFonts(element);
    if (loading.length === 0) return;
    waiting = true;
    void Promise.all(loading.map(settled)).then(() => {
      waiting = false;
      if (destroyed) return;
      stale = true;
      refresh();
    });
  };

  // A quiet draw leaves the element alone when it would show the same thing.
  const draw = (fresh: boolean, quiet = !fresh): void => {
    const style = windowOf(element).getComputedStyle(element);
    const drawing = (element.firstElementChild as HTMLElement | null) ?? null;
    if (fresh) {
      fonts = fontsFor(style, drawing);
      stale = element.isConnected === false;
    }
    let next = fit(style, fresh);
    if (quiet && next.svg === shown.svg) return;
    put(next.svg);
    if (fresh && !drawing && element.firstElementChild) {
      const seen = fontsFor(style, element.firstElementChild as HTMLElement);
      if (seen.family !== fonts.family || seen.mono !== fonts.mono) {
        const first = { fonts, natural, adapts, drawnFor };
        fonts = seen;
        try {
          next = fit(style, true);
          put(next.svg);
        } catch {
          // What was drawn for the element's own font is in the element, and stays.
          ({ fonts, natural, adapts, drawnFor } = first);
        }
      }
    }
    // From here the drawing is the one shown. Nothing above throws once the element has changed.
    shown = next;
    zoomer?.refresh();
    awaitFonts();
    settings.onRender?.(next);
  };

  // Made after the first drawing, and again when the option changes.
  let zoomer: ReturnType<typeof zoomWith> | undefined;
  let zooming: MountOptions['zoom'] = false;
  const zoom = (): void => {
    const wanted = settings.zoom ?? 'auto';
    if (wanted === zooming) return;
    zoomer?.destroy();
    zooming = wanted;
    // The diagram's observer tells the zoom when the element's size changes.
    zoomer = wanted === false ? undefined : zoomWith(element, typeof wanted === 'object' ? wanted : { always: wanted === true }, false);
  };

  draw(true);
  zoom();

  // An element that is hidden or out of the document has no width to draw for.
  const hidden = (): boolean => element.isConnected === false || !(element.clientWidth > 0);
  // One out of the document is drawn as a guess, so that it shows the text when it is put back
  // before the observer can see it, at the size it had. A hidden one in the document waits.
  const waits = (): boolean => element.isConnected !== false && !(element.clientWidth > 0);

  const refresh = (): void => {
    if (destroyed) return;
    watch();
    if (hidden()) return;
    const style = windowOf(element).getComputedStyle(element);
    const now = fontsFor(style, (element.firstElementChild as HTMLElement | null) ?? null);
    try {
      if (stale || now.family !== fonts.family || now.mono !== fonts.mono) {
        draw(true, true);
      } else if (adapts !== false && settings.maxWidth === undefined) {
        const available = room(element, style);
        // An element that wraps the drawing follows its width, which is not a change of room.
        if (available !== drawnFor && available !== shown.width) draw(false);
      }
    } catch {
      // The text drew before. Whatever stops it now, what is shown stays, and is not tried again
      // until something else changes.
      stale = false;
    }
    zoomer?.resized();
    awaitFonts();
  };

  // Observed from the window the element is in now, which changes if a host moves it to another:
  // an observer reports only on its own window's frames.
  let view: typeof globalThis | undefined;
  let observer: ResizeObserver | undefined;
  const watch = (): void => {
    const next = windowOf(element);
    if (next === view) return;
    observer?.disconnect();
    view = next;
    observer = next.ResizeObserver ? new next.ResizeObserver(refresh) : undefined;
    observer?.observe(element);
  };
  watch();

  const handle: Mounted = {
    get result() {
      return shown;
    },
    get zoom() {
      return zoomer;
    },
    update(next, nextOptions = settings) {
      // The same text under the same limits is the same model. Text that cannot be parsed
      // throws here, before anything has changed.
      const reparse =
        next !== source ||
        nextOptions.limit !== settings.limit ||
        nextOptions.maxEdges !== settings.maxEdges ||
        nextOptions.config !== settings.config;
      const nextModel = reparse ? engine.parse(next, nextOptions) : model;
      const before = { source, settings, model, natural, fonts, adapts, drawnFor, stale };
      const was = shown;
      source = next;
      settings = nextOptions;
      model = nextModel;
      if (waits()) {
        stale = true;
        zoom();
        return;
      }
      try {
        draw(true);
      } catch (error) {
        // Text that could not be drawn left the element alone. If the element has the new
        // drawing, it was the host's onRender that threw, and the update stands.
        if (shown === was) ({ source, settings, model, natural, fonts, adapts, drawnFor, stale } = before);
        else zoom();
        throw error;
      }
      zoom();
    },
    refresh,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      observer = undefined;
      view = undefined;
      zoomer?.destroy();
      if (mounts.get(element) === handle) mounts.delete(element);
    },
  };
  mounts.set(element, handle);
  return handle;
}
