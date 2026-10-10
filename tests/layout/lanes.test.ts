import { describe, expect, it } from 'vitest';
import { cnode, type CEdge, type CNode, type Dir } from '../../src/layout/compound.js';
import { laneLayout } from '../../src/layout/lanes.js';
import { endSide } from '../../src/svg/shapes.js';
import { random } from '../support/corpus.js';

const OPTIONS = { nodeSep: 40, edgeSep: 16, rankSep: 48, portSep: 20 };
const DIRS: Dir[] = ['TB', 'BT', 'LR', 'RL'];

function edge(src: number, dst: number, labelW = 0, labelH = 0): CEdge {
  return { src, dst, minlen: 1, labelW, labelH, route: [], labelX: 0, labelY: 0 };
}

function group(parent = -1): CNode {
  const node = cnode(0, 0, parent);
  node.isGroup = true;
  node.padX = 20;
  node.padTop = 36;
  node.padBottom = 20;
  node.minW = 60;
  return node;
}

interface Sample {
  nodes: CNode[];
  edges: CEdge[];
  lanes: number[];
  leaves: number[];
  laneOf: number[];
  inner: number[];
  innerLane: number[];
  dir: Dir;
}

function randomGraph(seed: number): Sample {
  const rnd = random(seed);
  const int = (n: number): number => Math.floor(rnd() * n);
  const nodes: CNode[] = [];
  const leaves: number[] = [];
  const laneOf: number[] = [];
  const lanes: number[] = [];
  const leafCount = 1 + int(30);
  const laneCount = 1 + int(5);
  const inner: number[] = [];
  const innerLane: number[] = [];
  // Leaves first, lanes after them, as the flowchart graph lists them.
  for (let i = 0; i < leafCount; i++) {
    nodes.push(cnode(30 + int(120), 24 + int(60)));
    leaves.push(i);
  }
  for (let k = 0; k < laneCount; k++) {
    lanes.push(nodes.length);
    nodes.push(group());
  }
  for (let k = 0; k < int(4); k++) {
    const lane = lanes[int(laneCount)];
    inner.push(nodes.length);
    innerLane.push(lane);
    nodes.push(group(lane));
  }
  for (const i of leaves) {
    if (inner.length > 0 && rnd() < 0.25) {
      const g = int(inner.length);
      nodes[i].parent = inner[g];
      laneOf[i] = innerLane[g];
    } else {
      laneOf[i] = lanes[int(laneCount)];
      nodes[i].parent = laneOf[i];
    }
  }
  const edges: CEdge[] = [];
  for (let k = 0, count = int(leafCount * 2); k < count; k++) {
    const labelled = rnd() < 0.3;
    edges.push(edge(int(leafCount), int(leafCount), labelled ? 20 + int(80) : 0, labelled ? 18 : 0));
  }
  if (rnd() < 0.3) edges.push(edge(lanes[0], leaves[0]));
  return { nodes, edges, lanes, leaves, laneOf, inner, innerLane, dir: DIRS[int(4)] };
}

const box = (c: CNode): [number, number, number, number] => [c.x - c.w / 2, c.y - c.h / 2, c.x + c.w / 2, c.y + c.h / 2];

describe('lane layout', () => {
  it('lays out nothing', () => {
    expect(laneLayout([], [], 'TB', OPTIONS)).toEqual({ width: 0, height: 0 });
  });

  it('puts lanes side by side across the flow, in the order written', () => {
    for (const dir of DIRS) {
      const nodes = [cnode(60, 30), cnode(60, 30), group(), group()];
      nodes[0].parent = 3;
      nodes[1].parent = 2;
      const result = laneLayout(nodes, [edge(0, 1)], dir, OPTIONS);
      const first = nodes[3];
      const second = nodes[2];
      if (dir === 'TB' || dir === 'BT') {
        expect(first.x).toBeLessThan(second.x);
        expect(first.h).toBe(result.height);
        expect(first.w + second.w).toBeCloseTo(result.width, 6);
      } else {
        expect(first.y).toBeLessThan(second.y);
        expect(first.w).toBe(result.width);
        expect(first.h + second.h).toBeCloseTo(result.height, 6);
      }
    }
  });

  it('runs the flow in the direction asked for', () => {
    const at = (dir: Dir): CNode[] => {
      const nodes = [cnode(60, 30), cnode(60, 30), group()];
      nodes[0].parent = 2;
      nodes[1].parent = 2;
      laneLayout(nodes, [edge(0, 1)], dir, OPTIONS);
      return nodes;
    };
    expect(at('TB')[0].y).toBeLessThan(at('TB')[1].y);
    expect(at('BT')[0].y).toBeGreaterThan(at('BT')[1].y);
    expect(at('LR')[0].x).toBeLessThan(at('LR')[1].x);
    expect(at('RL')[0].x).toBeGreaterThan(at('RL')[1].x);
  });

  it('keeps a chain in one lane on a straight line', () => {
    const nodes = [cnode(50, 30), cnode(120, 30), cnode(70, 30), group()];
    for (let i = 0; i < 3; i++) nodes[i].parent = 3;
    const edges = [edge(0, 1), edge(1, 2)];
    laneLayout(nodes, edges, 'TB', OPTIONS);
    expect(nodes[0].x).toBeCloseTo(nodes[1].x, 6);
    expect(nodes[1].x).toBeCloseTo(nodes[2].x, 6);
  });

  it.each(DIRS)('separates an approval decision’s incoming, accepted and returned paths in %s', (dir) => {
    const nodes = [cnode(60, 40), cnode(80, 40), cnode(70, 70), cnode(80, 40), cnode(80, 40), cnode(60, 40), group(), group(), group()];
    nodes[0].parent = nodes[5].parent = 8;
    nodes[1].parent = nodes[2].parent = 7;
    nodes[3].parent = nodes[4].parent = 6;
    const edges = [edge(0, 1, 70, 20), edge(1, 2), edge(2, 3, 50, 20), edge(3, 4), edge(4, 5), edge(2, 0, 70, 20)];
    laneLayout(nodes, edges, dir, OPTIONS);
    const incoming = endSide(edges[1].route, edges[1].route.length - 3, nodes[2]);
    const accepted = endSide(edges[2].route, 0, nodes[2]);
    const returned = endSide(edges[5].route, 0, nodes[2]);
    expect(new Set([incoming, accepted, returned]).size).toBe(3);
    expect([incoming, accepted, returned]).not.toContain(-1);
    expect(edges[5].route.length).toBe(9);
    // Every segment of the return is orthogonal, and its label clears every step.
    const back = edges[5];
    for (let p = 3; p < back.route.length; p += 3) {
      expect(back.route[p] === back.route[p - 3] || back.route[p + 1] === back.route[p - 2]).toBe(true);
    }
    for (const node of nodes.slice(0, 6)) {
      const [l, t, r, b] = box(node);
      const clear = back.labelX + back.labelW / 2 <= l || back.labelX - back.labelW / 2 >= r ||
        back.labelY + back.labelH / 2 <= t || back.labelY - back.labelH / 2 >= b;
      expect(clear).toBe(true);
    }
  });

  it.each([24, 12])('keeps random graphs well formed with %i pixels of lane padding', (lanePad) => {
    for (let seed = 1; seed <= 300; seed++) {
      const { nodes, edges, lanes, leaves, laneOf, inner, innerLane, dir } = randomGraph(seed);
      const result = laneLayout(nodes, edges, dir, OPTIONS, lanePad);
      const where = `seed ${seed}`;
      expect(Number.isFinite(result.width) && Number.isFinite(result.height), where).toBe(true);
      for (const c of nodes) {
        expect(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.w) && Number.isFinite(c.h), where).toBe(true);
      }
      for (const i of leaves) {
        const [l, t, r, b] = box(nodes[i]);
        const [ll, lt, lr, lb] = box(nodes[laneOf[i]]);
        expect(l >= ll - 0.01 && r <= lr + 0.01 && t >= lt - 0.01 && b <= lb + 0.01, `${where}: node ${i} in its lane`).toBe(true);
      }
      inner.forEach((g, k) => {
        if (!leaves.some((i) => nodes[i].parent === g)) return;
        const [l, t, r, b] = box(nodes[g]);
        const [ll, lt, lr, lb] = box(nodes[innerLane[k]]);
        expect(l >= ll - 0.01 && r <= lr + 0.01 && t >= lt - 0.01 && b <= lb + 0.01, `${where}: group ${g} in its lane`).toBe(true);
        for (const i of leaves) {
          if (nodes[i].parent !== g) continue;
          const [nl, nt, nr, nb] = box(nodes[i]);
          expect(nl >= l - 0.01 && nr <= r + 0.01 && nt >= t - 0.01 && nb <= b + 0.01, `${where}: node ${i} in its group`).toBe(true);
        }
      });
      for (let a = 0; a < leaves.length; a++) {
        for (let b = a + 1; b < leaves.length; b++) {
          const [al, at, ar, ab] = box(nodes[leaves[a]]);
          const [bl, bt, br, bb] = box(nodes[leaves[b]]);
          const apart = ar <= bl + 0.01 || br <= al + 0.01 || ab <= bt + 0.01 || bb <= at + 0.01;
          expect(apart, `${where}: nodes ${a} and ${b} overlap`).toBe(true);
        }
      }
      for (let a = 0; a < lanes.length; a++) {
        const [l, t, r, b] = box(nodes[lanes[a]]);
        expect(l >= -0.01 && t >= -0.01 && r <= result.width + 0.01 && b <= result.height + 0.01, `${where}: lane inside`).toBe(true);
        for (let k = a + 1; k < lanes.length; k++) {
          const [ol, ot, or, ob] = box(nodes[lanes[k]]);
          expect(r <= ol + 0.01 || or <= l + 0.01 || b <= ot + 0.01 || ob <= t + 0.01, `${where}: lanes overlap`).toBe(true);
        }
      }
      for (const e of edges) {
        if (e.src === e.dst) continue;
        expect(e.route.length >= 6 && e.route.length % 3 === 0, `${where}: route`).toBe(true);
        for (const v of e.route) expect(Number.isFinite(v), `${where}: route value`).toBe(true);
        expect(Number.isFinite(e.labelX) && Number.isFinite(e.labelY), `${where}: label`).toBe(true);
      }
    }
  });

  it('gives the same result every time', () => {
    const a = randomGraph(42);
    const b = randomGraph(42);
    laneLayout(a.nodes, a.edges, a.dir, OPTIONS);
    laneLayout(b.nodes, b.edges, b.dir, OPTIONS);
    expect(a.nodes.map((c) => [c.x, c.y, c.w, c.h])).toEqual(b.nodes.map((c) => [c.x, c.y, c.w, c.h]));
    expect(a.edges.map((e) => e.route)).toEqual(b.edges.map((e) => e.route));
  });
});
