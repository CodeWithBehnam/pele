import { render, type FlowchartModel, type RenderOptions, type RenderResult } from 'pele';

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderFlowPreview(model: FlowchartModel, complete: FlowchartModel, options: RenderOptions): RenderResult | undefined {
  const connected = new Set(model.edges.flatMap(edge => [edge.start, edge.end]));
  const ids = new Map<string, string>();
  const reveals = new Map<string, string>();
  for (const [id, node] of model.nodes) {
    if (model.nodes.size > 1 && !connected.has(id)) return;
    const matches = complete.nodes.has(id) ? [id] : [...complete.nodes.keys()].filter(full => full.startsWith(id));
    if (matches.length !== 1) return;
    const full = complete.nodes.get(matches[0])!;
    const label = full.text ?? full.id;
    const visible = node.text === id && label !== full.id ? '' : node.text ?? id;
    if (!label.startsWith(visible)) return;
    ids.set(id, full.id);
    node.id = full.id;
    node.text = label;
    node.type = full.type;
    if (visible !== label) reveals.set(escapeText(label), escapeText(visible));
  }
  model.nodes = new Map([...model.nodes].map(([id, node]) => [ids.get(id)!, node]));
  for (const edge of model.edges) {
    edge.start = ids.get(edge.start)!;
    edge.end = ids.get(edge.end)!;
  }
  const result = render(model, options);
  // Keep full labels in layout while revealing only the characters already typed.
  result.svg = result.svg.replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (text, open, label, close) => {
    const visible = reveals.get(label);
    return visible === undefined ? text : `${open}${visible}<tspan visibility="hidden" aria-hidden="true">${label.slice(visible.length)}</tspan>${close}`;
  });
  return result;
}
