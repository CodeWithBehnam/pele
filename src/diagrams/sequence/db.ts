import { PeleError } from '../../errors.js';
import { parseYaml, type YamlValue } from '../../util/yaml.js';
import { isCssColor } from './colors.js';
import {
  LINETYPE,
  type SeqActor,
  type SeqBox,
  type SeqBoxData,
  type SeqItem,
  type SeqMessage,
  type SeqNote,
  type SeqStatement,
  type SeqText,
  type SequenceModel,
} from './types.js';

export interface SeqDbOptions {
  // The top-level `wrap` setting, which the `%%{wrap}%%` directive also sets.
  wrap?: boolean;
  // `sequence.wrap`.
  sequenceWrap?: boolean;
}

const RE_WRAP = /^:?wrap:/;
const RE_NOWRAP = /^:?nowrap:/;
const RE_WRAP_PREFIX = /^:?(?:no)?wrap:/;
const RE_BOX_FUNCTION = /^(?:rgba?|hsla?)\s*\(/;
const RE_LINE_TERMINATOR = /[\r\u2028\u2029]/;
const RE_WORD = /^\w*/;

function fail(message: string): never {
  throw new PeleError(message, 'semantic', { type: 'sequence' });
}

function extractWrap(raw: string): SeqText {
  const text = raw.trim();
  const wrap = RE_WRAP.test(text) ? true : RE_NOWRAP.test(text) ? false : undefined;
  return { text: (wrap === undefined ? text : text.replace(RE_WRAP_PREFIX, '')).trim(), wrap };
}

// Splits a box line into a leading color and the rest, as Mermaid's
// /^((?:rgba?|hsla?)\s*\(.*\)|\w*)(.*)$/ does. `.` stops at a line terminator, so a line that
// holds one outside the gap before the parenthesis does not match at all.
function splitBox(str: string): [string, string] | undefined {
  const fn = RE_BOX_FUNCTION.exec(str);
  if (fn) {
    const close = str.lastIndexOf(')');
    if (close >= fn[0].length) {
      if (RE_LINE_TERMINATOR.test(str.slice(fn[0].length))) return undefined;
      return [str.slice(0, close + 1), str.slice(close + 1)];
    }
  }
  if (RE_LINE_TERMINATOR.test(str)) return undefined;
  const word = RE_WORD.exec(str)![0];
  return [word, str.slice(word.length)];
}

function entries(value: unknown): [string, unknown][] {
  if (typeof value === 'string') return [...value].map((ch, i) => [String(i), ch]);
  return value !== null && typeof value === 'object' ? Object.entries(value) : [];
}

export class SeqDb implements SequenceModel {
  readonly type = 'sequence' as const;
  actors = new Map<string, SeqActor>();
  createdActors = new Map<string, number>();
  destroyedActors = new Map<string, number>();
  boxes: SeqBox[] = [];
  messages: SeqMessage[] = [];
  notes: SeqNote[] = [];
  title: string | undefined;
  accTitle: string | undefined;
  accDescr: string | undefined;
  private prevActor: string | undefined;
  private currentBox: SeqBox | undefined;
  private lastCreated: string | undefined;
  private lastDestroyed: string | undefined;
  private wrapEnabled: boolean | undefined;
  private sequenceWrap: boolean;
  private active = new Map<string, number>();

  constructor(options: SeqDbOptions = {}) {
    this.wrapEnabled = options.wrap;
    this.sequenceWrap = options.sequenceWrap ?? false;
  }

  autoWrap(): boolean {
    return this.wrapEnabled ?? this.sequenceWrap;
  }

  setAccTitle(text: string): void {
    this.accTitle = text.replace(/^\s+/g, '');
  }

  setAccDescription(text: string): void {
    this.accDescr = text.replace(/\n\s+/g, '\n');
  }

  setDiagramTitle(text: string): void {
    this.title = text;
  }

  parseMessage(str: string): SeqText {
    return extractWrap(str);
  }

  parseBoxData(str: string): SeqBoxData {
    const match = splitBox(str);
    let color = match?.[0] ? match[0].trim() : 'transparent';
    let title = match?.[1] ? match[1].trim() : undefined;
    if (!isCssColor(color)) {
      color = 'transparent';
      title = str.trim();
    }
    if (title === undefined) return { text: undefined, color, wrap: undefined };
    const { text, wrap } = extractWrap(title);
    return { text: text || undefined, color, wrap };
  }

  addBox(data: SeqBoxData): void {
    this.currentBox = { name: data.text, wrap: data.wrap ?? this.autoWrap(), fill: data.color, actorKeys: [] };
    this.boxes.push(this.currentBox);
  }

  addActor(
    id: string,
    name: string,
    description: { text: string; wrap?: boolean; type?: string } | undefined,
    type: string | undefined,
    metadata?: string
  ): void {
    let assignedBox = this.currentBox;
    let doc: Record<string, YamlValue> | undefined;
    if (metadata !== undefined) {
      let parsed: YamlValue;
      try {
        parsed = parseYaml(metadata.includes('\n') ? metadata + '\n' : '{\n' + metadata + '\n}');
      } catch (error) {
        throw new PeleError(`Config of participant "${id}" is not valid YAML. ${(error as Error).message}`, 'syntax', {
          type: 'sequence',
        });
      }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) doc = parsed;
    }
    const docType = doc && Object.prototype.hasOwnProperty.call(doc, 'type') ? doc.type : undefined;
    const docAlias = doc && Object.prototype.hasOwnProperty.call(doc, 'alias') ? doc.alias : undefined;
    if (docType !== undefined && docType !== null) type = String(docType);
    if (docAlias && (!description || description.text === name)) {
      description = { text: String(docAlias), wrap: description?.wrap, type };
    }

    const old = this.actors.get(id);
    if (old) {
      if (this.currentBox && old.box && this.currentBox !== old.box) {
        fail(
          `A same participant should only be defined in one Box: ${old.name} can't be in '${old.box.name}' and in '${this.currentBox.name}' at the same time.`
        );
      }
      assignedBox = old.box ? old.box : this.currentBox;
      old.box = assignedBox;
      if (name === old.name && description == null) return;
    }
    // A participant that is only mentioned in a message has no kind and takes its name as its label.
    if (description?.text == null || type == null) description = { text: name, type };

    this.actors.set(id, {
      box: assignedBox,
      name,
      description: description.text,
      wrap: description.wrap ?? this.autoWrap(),
      prevActor: this.prevActor,
      links: new Map(),
      properties: new Map(),
      type: type ?? 'participant',
    });
    if (this.prevActor) {
      const prev = this.actors.get(this.prevActor);
      if (prev) prev.nextActor = id;
    }
    if (this.currentBox) this.currentBox.actorKeys.push(id);
    this.prevActor = id;
  }

  addMessage(from: string, to: string, message: { text: string; wrap?: boolean }, answer: unknown): void {
    this.messages.push({
      id: String(this.messages.length),
      from,
      to,
      message: message.text,
      wrap: message.wrap ?? this.autoWrap(),
      answer,
    });
  }

  addSignal(
    from?: string,
    to?: string,
    message?: { text: string; wrap?: boolean },
    type?: number,
    activate = false,
    centralConnection?: number
  ): boolean {
    // Mermaid recounts every earlier message here. A running count per participant says the same.
    if (type === LINETYPE.ACTIVE_END) {
      const count = from ? (this.active.get(from) ?? 0) : 0;
      if (count < 1) fail(`Trying to inactivate an inactive participant (${from})`);
      this.active.set(from!, count - 1);
    } else if (type === LINETYPE.ACTIVE_START && from) {
      this.active.set(from, (this.active.get(from) ?? 0) + 1);
    }
    this.messages.push({
      id: String(this.messages.length),
      from,
      to,
      message: message?.text ?? '',
      wrap: message?.wrap ?? this.autoWrap(),
      type,
      activate,
      centralConnection: centralConnection ?? 0,
    });
    return true;
  }

  addNote(actor: string | string[], placement: number, message: { text: string; wrap?: boolean }): void {
    const wrap = message.wrap ?? this.autoWrap();
    const note: SeqNote = { actor, placement, message: message.text, wrap };
    const pair = typeof actor === 'string' ? [actor, actor] : actor;
    this.notes.push(note);
    this.messages.push({
      id: String(this.messages.length),
      from: pair[0],
      to: pair[1],
      message: message.text,
      wrap,
      type: LINETYPE.NOTE,
      placement,
    });
  }

  // Mermaid logs and ignores menu text that is not valid JSON. It also undoes the `&amp;` and
  // `&equals;` its sanitizer writes; Pele has no sanitizer, and a `;` cannot occur in the text.
  addLinks(actorId: string, text: { text: string }): void {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    try {
      const parsed: unknown = JSON.parse(text.text);
      for (const [key, value] of entries(parsed)) actor.links.set(key, value);
    } catch {
      return;
    }
  }

  addALink(actorId: string, text: { text: string }): void {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    const sep = text.text.indexOf('@');
    actor.links.set(text.text.slice(0, sep - 1).trim(), text.text.slice(sep + 1).trim());
  }

  addProperties(actorId: string, text: { text: string }): void {
    const actor = this.actors.get(actorId);
    if (!actor) return;
    try {
      const parsed: unknown = JSON.parse(text.text);
      for (const [key, value] of entries(parsed)) actor.properties.set(key, value);
    } catch {
      return;
    }
  }

  // Mermaid reads the properties and links from a page element with this id. Pele keeps the id.
  addDetails(actorId: string, text: { text: string }): void {
    const actor = this.actors.get(actorId);
    if (actor) actor.details = text.text;
  }

  // Mermaid walks the nested statement lists by recursion; an explicit stack takes any depth.
  apply(root: SeqItem): void {
    const lists: SeqItem[][] = [];
    const at: number[] = [];
    let item: SeqItem | undefined = root;
    while (true) {
      if (item !== undefined) {
        if (Array.isArray(item)) {
          lists.push(item);
          at.push(0);
        } else if (typeof item !== 'string') {
          this.applyOne(item);
        }
      }
      const depth = lists.length - 1;
      if (depth < 0) return;
      const list = lists[depth];
      if (at[depth] < list.length) {
        item = list[at[depth]++];
      } else {
        lists.pop();
        at.pop();
        item = undefined;
      }
    }
  }

  private applyOne(param: SeqStatement): void {
    const actor = param.actor as string;
    switch (param.type) {
      case 'sequenceIndex':
        this.messages.push({
          id: String(this.messages.length),
          from: undefined,
          to: undefined,
          message: { start: param.sequenceIndex, step: param.sequenceIndexStep, visible: param.sequenceVisible === true },
          wrap: false,
          type: param.signalType,
        });
        break;
      case 'addParticipant':
        this.addActor(actor, actor, param.description, param.draw, param.config);
        break;
      case 'createParticipant':
        if (this.actors.has(actor)) {
          fail(
            "It is not possible to have actors with the same id, even if one is destroyed before the next is created. Use 'AS' aliases to simulate the behavior"
          );
        }
        this.lastCreated = actor;
        this.addActor(actor, actor, param.description, param.draw, param.config);
        this.createdActors.set(actor, this.messages.length);
        break;
      case 'destroyParticipant':
        this.lastDestroyed = actor;
        this.destroyedActors.set(actor, this.messages.length);
        break;
      case 'activeStart':
      case 'activeEnd':
      case 'centralConnection':
      case 'centralConnectionReverse':
        this.addSignal(actor, undefined, undefined, param.signalType);
        break;
      case 'addNote':
        this.addNote(param.actor!, param.placement!, param.text!);
        break;
      case 'addLinks':
        this.addLinks(actor, param.text!);
        break;
      case 'addALink':
        this.addALink(actor, param.text!);
        break;
      case 'addProperties':
        this.addProperties(actor, param.text!);
        break;
      case 'addDetails':
        this.addDetails(actor, param.text!);
        break;
      case 'addMessage':
        if (this.lastCreated) {
          if (param.to !== this.lastCreated) {
            fail(
              `The created participant ${this.lastCreated} does not have an associated creating message after its declaration. Please check the sequence diagram.`
            );
          }
          this.lastCreated = undefined;
        } else if (this.lastDestroyed) {
          if (param.to !== this.lastDestroyed && param.from !== this.lastDestroyed) {
            fail(
              `The destroyed participant ${this.lastDestroyed} does not have an associated destroying message after its declaration. Please check the sequence diagram.`
            );
          }
          this.lastDestroyed = undefined;
        }
        this.addSignal(param.from, param.to, param.msg, param.signalType, param.activate, param.centralConnection);
        break;
      case 'boxStart':
        this.addBox(param.boxData!);
        break;
      case 'boxEnd':
        this.currentBox = undefined;
        break;
      case 'loopStart':
        this.addSignal(undefined, undefined, param.loopText as SeqText, param.signalType);
        break;
      case 'rectStart':
        this.addSignal(undefined, undefined, param.color, param.signalType);
        break;
      case 'optStart':
        this.addSignal(undefined, undefined, param.optText, param.signalType);
        break;
      case 'altStart':
      case 'else':
        this.addSignal(undefined, undefined, param.altText, param.signalType);
        break;
      case 'parStart':
      case 'and':
        this.addSignal(undefined, undefined, param.parText, param.signalType);
        break;
      case 'criticalStart':
        this.addSignal(undefined, undefined, param.criticalText, param.signalType);
        break;
      case 'option':
        this.addSignal(undefined, undefined, param.optionText, param.signalType);
        break;
      case 'breakStart':
        this.addSignal(undefined, undefined, param.breakText, param.signalType);
        break;
      case 'loopEnd':
      case 'rectEnd':
      case 'optEnd':
      case 'altEnd':
      case 'parEnd':
      case 'criticalEnd':
      case 'breakEnd':
        this.addSignal(undefined, undefined, undefined, param.signalType);
        break;
    }
  }
}
