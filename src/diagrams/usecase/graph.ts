import {
  Arrow,
  type ActorType,
  type Animation,
  type BoundaryType,
  type LabelType,
  type Relationship,
  type RelationshipType,
  type UsecaseJsonNode,
  type UsecaseModel,
} from './types.js';

export interface JsonRow {
  // Blank on the second and later values of an array.
  key: string;
  // The key again, for every row.
  accessibleKey: string;
  value: string;
}

export interface UsecaseGraphNode {
  id: string;
  label: string;
  labelType: LabelType;
  // Mermaid's shape names.
  shape:
    | 'usecaseActor'
    | 'usecaseActorHollow'
    | 'usecaseActorAwesome'
    | 'usecaseActorIcon'
    | 'usecaseEllipse'
    | 'usecaseBusiness'
    | 'rect'
    | 'note'
    | 'usecaseJsonTable'
    | 'usecaseSystemBoundary';
  isGroup: boolean;
  padding: number;
  cssClasses: string;
  cssStyles: string[];
  cssCompiledStyles: string[];
  actorType?: ActorType;
  business?: boolean;
  icon?: string;
  stereotype?: string;
  parentId?: string;
  noteTarget?: string;
  jsonRows?: JsonRow[];
  boundaryType?: BoundaryType;
}

export interface UsecaseGraphEdge {
  id: string;
  start: string;
  end: string;
  relationshipType: RelationshipType | 'note';
  pattern: 'solid' | 'dotted';
  arrowTypeStart: string;
  arrowTypeEnd: string;
  label?: string;
  labelType?: LabelType;
  classes: string;
  style: string[];
  cssCompiledStyles: string[];
  animate: boolean;
  animation?: Animation;
  minlen: number;
  explicitId: boolean;
  // The dotted line from a note to what it is about.
  internal: boolean;
}

export interface UsecaseGraph {
  nodes: UsecaseGraphNode[];
  edges: UsecaseGraphEdge[];
}

const ACTOR_SHAPES = {
  normal: 'usecaseActor',
  hollow: 'usecaseActorHollow',
  awesome: 'usecaseActorAwesome',
  icon: 'usecaseActorIcon',
} as const;

// Start and end markers for each arrow type, in the order of the Arrow enum.
const MARKERS = [
  ['none', 'arrow_point'],
  ['arrow_point', 'none'],
  ['none', 'none'],
  ['none', 'arrow_circle'],
  ['none', 'arrow_cross'],
  ['arrow_circle', 'none'],
  ['arrow_cross', 'none'],
];

function scalar(value: unknown): string {
  return typeof value === 'string' ? value : value === null ? 'null' : String(value);
}

// One row for each leaf of a JSON object, depth first in the order the keys were written.
// Nesting is kept on a stack of its own, so depth is limited by memory and not by the call stack.
export function flattenJsonRows(json: Pick<UsecaseJsonNode, 'value' | 'propertyOrder'>): JsonRow[] {
  const rows: JsonRow[] = [];
  const stack: [value: unknown, path: string, pointer: string][] = [[json.value, '', '']];
  const children: [unknown, string, string][] = [];
  while (stack.length > 0) {
    const [current, path, pointer] = stack.pop()!;
    children.length = 0;
    if (Array.isArray(current)) {
      if (current.length === 0) rows.push({ key: path, accessibleKey: path, value: '[]' });
      else if (current.every((item) => item === null || typeof item !== 'object')) {
        current.forEach((item, i) => rows.push({ key: i === 0 ? path : '', accessibleKey: path, value: scalar(item) }));
      } else current.forEach((item, i) => children.push([item, `${path}[${i}]`, `${pointer}/${i}`]));
    } else if (current !== null && typeof current === 'object') {
      const object = current as Record<string, unknown>;
      const keys = json.propertyOrder.get(pointer) ?? Object.keys(object);
      if (keys.length === 0) rows.push({ key: path, accessibleKey: path, value: '{}' });
      for (const key of keys) {
        children.push([
          Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined,
          path ? `${path}.${key}` : key,
          `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
        ]);
      }
    } else rows.push({ key: path, accessibleKey: path, value: scalar(current) });
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return rows;
}

function classList(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

function markers(relationship: Relationship): string[] {
  if (relationship.type === 'generalization') return ['none', 'extension'];
  if (relationship.type !== 'association') return MARKERS[Arrow.SOLID_ARROW];
  return MARKERS[relationship.arrowType] ?? MARKERS[Arrow.LINE_SOLID];
}

// Resolves a parsed use case diagram into what is drawn: every actor, use case, note, JSON table
// and boundary as a node with its class styles, and every relationship and note connector as an
// edge with its markers. Ports getData from Mermaid's use case DB.
export function buildUsecaseGraph(model: UsecaseModel): UsecaseGraph {
  const nodes: UsecaseGraphNode[] = [];
  const edges: UsecaseGraphEdge[] = [];

  // A later class wins a property but keeps the place the property first took.
  const compiled = (classNames: readonly string[]): string[] => {
    const out = new Map<string, string>();
    for (const name of ['default', ...classNames]) {
      const definition = model.classDefs.get(name);
      if (!definition) continue;
      for (const raw of definition.styles) {
        const style = raw.trim();
        const colon = style.indexOf(':');
        const property = (colon === -1 ? style : style.slice(0, colon)).trim();
        if (property) out.set(property, style);
      }
    }
    return [...out.values()];
  };

  for (const actor of model.actors.values()) {
    nodes.push({
      id: actor.id,
      label: actor.label,
      labelType: actor.labelType,
      shape: ACTOR_SHAPES[actor.type],
      isGroup: false,
      padding: 10,
      cssClasses: classList(
        'default',
        'usecase-actor',
        `usecase-actor-${actor.type}`,
        actor.business && 'usecase-business',
        ...actor.classes
      ),
      cssStyles: [...actor.styles],
      cssCompiledStyles: compiled(actor.classes),
      actorType: actor.type,
      business: actor.business,
      icon: actor.icon || undefined,
      stereotype: actor.stereotype || undefined,
      parentId: actor.parentId || undefined,
    });
  }
  for (const useCase of model.useCases.values()) {
    const ellipse = useCase.shape === 'ellipse';
    nodes.push({
      id: useCase.id,
      label: useCase.label,
      labelType: useCase.labelType,
      shape: !ellipse ? 'rect' : useCase.business ? 'usecaseBusiness' : 'usecaseEllipse',
      isGroup: false,
      padding: ellipse ? 20 : 10,
      cssClasses: classList(
        'default',
        'usecase-element',
        `usecase-${useCase.shape}`,
        useCase.business && 'usecase-business',
        ...useCase.classes
      ),
      cssStyles: [...useCase.styles],
      cssCompiledStyles: compiled(useCase.classes),
      business: useCase.business,
      stereotype: useCase.stereotype || undefined,
      parentId: useCase.parentId || undefined,
    });
  }
  for (const note of model.notes.values()) {
    nodes.push({
      id: note.id,
      label: note.label,
      labelType: note.labelType,
      shape: 'note',
      isGroup: false,
      padding: 10,
      cssClasses: 'default usecase-note',
      cssStyles: [],
      cssCompiledStyles: compiled([]),
      noteTarget: note.target,
    });
  }
  for (const json of model.jsonNodes.values()) {
    nodes.push({
      id: json.id,
      label: json.id,
      labelType: 'text',
      shape: 'usecaseJsonTable',
      isGroup: false,
      padding: 10,
      cssClasses: classList('default', 'usecase-json-table', ...json.classes),
      cssStyles: [...json.styles],
      cssCompiledStyles: compiled(json.classes),
      jsonRows: flattenJsonRows(json),
    });
  }
  for (const boundary of model.systemBoundaries.values()) {
    nodes.push({
      id: boundary.id,
      label: boundary.label,
      labelType: boundary.labelType,
      shape: 'usecaseSystemBoundary',
      isGroup: true,
      padding: 20,
      cssClasses: classList('default', 'system-boundary', `system-boundary-${boundary.type}`, ...boundary.classes),
      cssStyles: [...boundary.styles],
      cssCompiledStyles: compiled(boundary.classes),
      boundaryType: boundary.type,
    });
  }

  for (const relationship of model.relationships) {
    const semantic = relationship.type === 'include' || relationship.type === 'extend';
    const [arrowTypeStart, arrowTypeEnd] = markers(relationship);
    const animated = relationship.animate || relationship.animation !== undefined;
    const edge: UsecaseGraphEdge = {
      id: relationship.id,
      start: relationship.source,
      end: relationship.target,
      relationshipType: relationship.type,
      pattern: semantic ? 'dotted' : 'solid',
      arrowTypeStart,
      arrowTypeEnd,
      classes: classList(
        'default',
        'relationship',
        `relationship-${relationship.type}`,
        ...relationship.classes,
        animated && `edge-animation-${relationship.animation ?? 'fast'}`
      ),
      style: [...relationship.styles],
      cssCompiledStyles: compiled(relationship.classes),
      animate: relationship.animate,
      animation: relationship.animation,
      minlen: relationship.minlen,
      explicitId: relationship.explicitId,
      internal: false,
    };
    // Include and extend are labelled with their kind, whatever label the relationship carries.
    if (semantic) {
      edge.label = relationship.type;
      edge.labelType = 'text';
    } else if (relationship.type === 'association') {
      if (relationship.label) edge.label = relationship.label;
      if (relationship.labelType) edge.labelType = relationship.labelType;
    }
    edges.push(edge);
  }
  for (const note of model.notes.values()) {
    edges.push({
      id: `${note.id}-edge`,
      start: note.id,
      end: note.target,
      relationshipType: 'note',
      pattern: 'dotted',
      arrowTypeStart: 'none',
      arrowTypeEnd: 'none',
      classes: 'default relationship relationship-note',
      style: [],
      cssCompiledStyles: compiled([]),
      animate: false,
      minlen: 1,
      explicitId: false,
      internal: true,
    });
  }
  return { nodes, edges };
}
