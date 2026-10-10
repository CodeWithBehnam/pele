import type { CEdge, CNode, CompoundResult, Dir } from './compound.js';
import { ledge, lnode, orient, rank, type LEdge, type LNode, type LayeredOptions } from './layered.js';

// Layout for swimlanes. Every top-level group is a lane: a band that runs the length of the
// diagram along the flow. Ranks are shared by all lanes, so a step sits level with the steps
// that happen at the same time in other lanes, and each node stays inside its own lane.

const LANE_HEAD = 34;
const LANE_PAD = 24;
const SWEEPS = 8;
const MAX_DUMMIES = 20000;
const MAX_HOPS = 10000;

export function laneLayout(nodes: CNode[], edges: CEdge[], dir: Dir, opt: LayeredOptions, lanePad = LANE_PAD): CompoundResult {
  const n = nodes.length;
  if (n === 0) return { width: 0, height: 0 };
  const sideways = dir === 'LR' || dir === 'RL';
  const flipped = dir === 'BT' || dir === 'RL';

  // Lanes in the order they were written. The graph lists groups last-declared first.
  const lanes: number[] = [];
  for (let i = n - 1; i >= 0; i--) if (nodes[i].parent < 0 && nodes[i].isGroup) lanes.push(i);
  const laneCount = Math.max(1, lanes.length);
  const laneSlot = new Int32Array(n).fill(-1);
  lanes.forEach((id, k) => (laneSlot[id] = k));
  const hasChild = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (nodes[i].parent >= 0) hasChild[nodes[i].parent] = 1;
  // Room a lane keeps around its items, so that the groups drawn around them stay inside it.
  const pad = new Float64Array(laneCount).fill(lanePad);
  let endPad = lanePad;
  const laneOf = (i: number): number => {
    let t = i;
    let room = lanePad;
    for (let hops = 0; nodes[t].parent >= 0 && hops < MAX_HOPS; hops++) {
      t = nodes[t].parent;
      if (laneSlot[t] < 0) room += Math.max(nodes[t].padX, nodes[t].padTop, nodes[t].padBottom);
    }
    const lane = Math.max(0, laneSlot[t]);
    if (room > pad[lane]) pad[lane] = room;
    if (room > endPad) endPad = room;
    return lane;
  };

  // What gets ranked and placed: nodes, and groups that are empty and so act as nodes.
  const itemOf = new Int32Array(n).fill(-1);
  const real: number[] = [];
  for (let i = 0; i < n; i++) {
    if (laneSlot[i] >= 0) continue;
    if (!nodes[i].isGroup || !hasChild[i]) {
      itemOf[i] = real.length;
      real.push(i);
    }
  }
  const along = (c: CNode): number => (sideways ? c.w : c.h);
  const cross = (c: CNode): number => (sideways ? c.h : c.w);

  const lnodes: LNode[] = real.map((i) => lnode(cross(nodes[i]), along(nodes[i])));
  const ledges: LEdge[] = [];
  const edgeOf: number[] = [];
  let step = 1;
  {
    const seen = new Set<number>();
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      const a = itemOf[e.src];
      const b = itemOf[e.dst];
      if (a < 0 || b < 0 || a === b) continue;
      const key = Math.min(a, b) * real.length + Math.max(a, b);
      if (e.labelW > 0 || seen.has(key)) step = 2;
      seen.add(key);
      ledges.push(ledge(a, b, e.minlen, sideways ? e.labelH : e.labelW, sideways ? e.labelW : e.labelH));
      edgeOf.push(ei);
    }
  }
  orient(lnodes, ledges);
  rank(lnodes, ledges, step);

  // Items: the real ones, then a dummy for every rank an edge passes through.
  const m = ledges.length;
  let dummies = 0;
  const span = new Int32Array(m);
  for (let k = 0; k < m; k++) {
    span[k] = Math.abs(lnodes[ledges[k].head].rank - lnodes[ledges[k].tail].rank);
    dummies += span[k] - 1;
  }
  const direct = dummies > MAX_DUMMIES;
  const total = real.length + (direct ? 0 : dummies);
  const RANK = new Int32Array(total);
  const LANE = new Int32Array(total);
  const SIZE = new Float64Array(total);
  const DEPTH = new Float64Array(total);
  const DUMMY = new Uint8Array(total);
  let maxRank = 0;
  for (let k = 0; k < real.length; k++) {
    RANK[k] = lnodes[k].rank;
    LANE[k] = laneOf(real[k]);
    SIZE[k] = lnodes[k].w;
    DEPTH[k] = lnodes[k].h;
    if (RANK[k] > maxRank) maxRank = RANK[k];
  }
  const firstDummy = new Int32Array(m).fill(-1);
  const labelItem = new Int32Array(m).fill(-1);
  const links: number[] = [];
  {
    let next = real.length;
    for (let k = 0; k < m; k++) {
      const e = ledges[k];
      const a = e.reversed ? e.head : e.tail;
      const b = e.reversed ? e.tail : e.head;
      if (direct || span[k] < 2) {
        links.push(a, b);
        continue;
      }
      const ra = RANK[a];
      const rb = RANK[b];
      let labelRank = -1;
      if (e.labelW > 0) {
        labelRank = ra + ((rb - ra) >> 1);
        if (step === 2 && (labelRank & 1) === 0) labelRank--;
      }
      firstDummy[k] = next;
      let prev = a;
      for (let r = ra + 1; r < rb; r++) {
        const d = next++;
        RANK[d] = r;
        // The edge crosses from its first lane to its last one evenly along the way.
        LANE[d] = LANE[a] + Math.round(((LANE[b] - LANE[a]) * (r - ra)) / (rb - ra));
        DUMMY[d] = 1;
        if (r === labelRank) {
          SIZE[d] = e.labelW;
          DEPTH[d] = e.labelH;
          labelItem[k] = d;
        }
        links.push(prev, d);
        prev = d;
      }
      links.push(prev, b);
    }
  }

  const upStart = new Int32Array(total + 1);
  const downStart = new Int32Array(total + 1);
  for (let k = 0; k < links.length; k += 2) {
    downStart[links[k] + 1]++;
    upStart[links[k + 1] + 1]++;
  }
  for (let i = 0; i < total; i++) {
    upStart[i + 1] += upStart[i];
    downStart[i + 1] += downStart[i];
  }
  const up = new Int32Array(links.length / 2);
  const down = new Int32Array(links.length / 2);
  {
    const uf = upStart.slice(0, total);
    const df = downStart.slice(0, total);
    for (let k = 0; k < links.length; k += 2) {
      down[df[links[k]]++] = links[k + 1];
      up[uf[links[k + 1]]++] = links[k];
    }
  }

  // Order within each rank: by lane first, then by where the item's neighbours sit.
  const rows: number[][] = [];
  for (let r = 0; r <= maxRank; r++) rows.push([]);
  for (let i = 0; i < total; i++) rows[RANK[i]].push(i);
  const pos = new Float64Array(total);
  const key = new Float64Array(total);
  const settle = (row: number[]): void => {
    row.sort((a, b) => LANE[a] - LANE[b] || key[a] - key[b] || a - b);
    for (let k = 0; k < row.length; k++) pos[row[k]] = k;
  };
  for (const row of rows) {
    for (let k = 0; k < row.length; k++) key[row[k]] = k;
    settle(row);
  }
  for (let sweep = 0; sweep < SWEEPS && maxRank > 0; sweep++) {
    const downward = (sweep & 1) === 0;
    for (let s = 1; s <= maxRank; s++) {
      const row = rows[downward ? s : maxRank - s];
      const start = downward ? upStart : downStart;
      const list = downward ? up : down;
      for (const i of row) {
        let sum = 0;
        const count = start[i + 1] - start[i];
        for (let k = start[i]; k < start[i + 1]; k++) sum += pos[list[k]];
        key[i] = count > 0 ? sum / count : pos[i];
      }
      settle(row);
    }
  }

  // The items of one rank that share a lane sit side by side as a run.
  const gap = (a: number, b: number): number => (DUMMY[a] || DUMMY[b] ? opt.edgeSep : opt.nodeSep);
  const eachRun = (row: number[], visit: (row: number[], from: number, to: number) => void): void => {
    let from = 0;
    while (from < row.length) {
      let to = from;
      while (to + 1 < row.length && LANE[row[to + 1]] === LANE[row[from]]) to++;
      visit(row, from, to);
      from = to + 1;
    }
  };
  const runSize = (row: number[], from: number, to: number): number => {
    let size = SIZE[row[from]];
    for (let k = from; k < to; k++) size += gap(row[k], row[k + 1]) + SIZE[row[k + 1]];
    return size;
  };

  // Lane breadth: enough for its fullest rank, and for its title.
  const breadth = new Float64Array(laneCount);
  let head = lanes.length > 0 ? LANE_HEAD : 0;
  for (let k = 0; k < lanes.length; k++) {
    const lane = nodes[lanes[k]];
    breadth[k] = Math.max(0, lane.minW - 2 * pad[k]);
    if (lane.padTop > head) head = lane.padTop;
  }
  for (const row of rows) {
    eachRun(row, (_, from, to) => {
      const size = runSize(row, from, to);
      if (size > breadth[LANE[row[from]]]) breadth[LANE[row[from]]] = size;
    });
  }
  const laneStart = new Float64Array(laneCount + 1);
  for (let k = 0; k < laneCount; k++) laneStart[k + 1] = laneStart[k] + breadth[k] + 2 * pad[k];

  // Across the flow: each lane's items start centered, then line up with their neighbours in
  // the same lane as far as the lane and the items beside them allow.
  const C = new Float64Array(total);
  const want = new Float64Array(total);
  const center = (row: number[], from: number, to: number): void => {
    const lane = LANE[row[from]];
    let at = (laneStart[lane] + pad[lane] + (laneStart[lane + 1] - pad[lane]) - runSize(row, from, to)) / 2;
    for (let k = from; k <= to; k++) {
      C[row[k]] = at + SIZE[row[k]] / 2;
      if (k < to) at += SIZE[row[k]] + gap(row[k], row[k + 1]);
    }
  };
  const align = (row: number[], from: number, to: number): void => {
    const lane = LANE[row[from]];
    let floor = laneStart[lane] + pad[lane];
    for (let k = from; k <= to; k++) {
      const i = row[k];
      C[i] = Math.max(want[i], floor + SIZE[i] / 2);
      if (k < to) floor = C[i] + SIZE[i] / 2 + gap(i, row[k + 1]);
    }
    let ceil = laneStart[lane + 1] - pad[lane];
    for (let k = to; k >= from; k--) {
      const i = row[k];
      C[i] = Math.min(C[i], ceil - SIZE[i] / 2);
      if (k > from) ceil = C[i] - SIZE[i] / 2 - gap(row[k - 1], i);
    }
  };
  for (const row of rows) eachRun(row, center);
  for (let pass = 0; pass < 4 && maxRank > 0; pass++) {
    const downward = (pass & 1) === 0;
    for (let s = 1; s <= maxRank; s++) {
      const row = rows[downward ? s : maxRank - s];
      const start = downward ? upStart : downStart;
      const list = downward ? up : down;
      for (const i of row) {
        let sum = 0;
        let count = 0;
        for (let k = start[i]; k < start[i + 1]; k++) {
          if (LANE[list[k]] !== LANE[i]) continue;
          sum += C[list[k]];
          count++;
        }
        want[i] = count > 0 ? sum / count : C[i];
      }
      eachRun(row, align);
    }
  }

  // Along the flow: one band per rank, after the lane titles.
  const bandStart = new Float64Array(maxRank + 1);
  const bandEnd = new Float64Array(maxRank + 1);
  let at = head + endPad;
  for (let r = 0; r <= maxRank; r++) {
    let depth = 0;
    for (const i of rows[r]) if (DEPTH[i] > depth) depth = DEPTH[i];
    bandStart[r] = at;
    bandEnd[r] = at + depth;
    at += depth + (r === maxRank ? 0 : opt.rankSep / step);
  }
  const length = at + endPad;
  const breadthTotal = laneStart[laneCount];
  const flip = (a: number): number => (flipped ? head + length - a : a);
  const px = (c: number, a: number): number => (sideways ? flip(a) : c);
  const py = (c: number, a: number): number => (sideways ? c : flip(a));
  const axis = sideways ? 1 : 0;

  for (let k = 0; k < real.length; k++) {
    const node = nodes[real[k]];
    const a = (bandStart[RANK[k]] + bandEnd[RANK[k]]) / 2;
    node.x = px(C[k], a);
    node.y = py(C[k], a);
  }
  for (let k = 0; k < lanes.length; k++) {
    const lane = nodes[lanes[k]];
    const c = (laneStart[k] + laneStart[k + 1]) / 2;
    const size = laneStart[k + 1] - laneStart[k];
    lane.x = sideways ? length / 2 : c;
    lane.y = sideways ? c : length / 2;
    lane.w = sideways ? length : size;
    lane.h = sideways ? size : length;
    lane.padTop = head;
  }

  // Groups inside a lane are drawn around their members, deepest first.
  const depthOf = new Int32Array(n);
  const inner: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!nodes[i].isGroup || laneSlot[i] >= 0 || itemOf[i] >= 0) continue;
    let d = 0;
    for (let p = nodes[i].parent; p >= 0 && d < MAX_HOPS; p = nodes[p].parent) d++;
    depthOf[i] = d;
    inner.push(i);
  }
  inner.sort((a, b) => depthOf[b] - depthOf[a] || a - b);
  const box = new Float64Array(n * 4);
  for (let i = 0; i < n; i++) {
    box[i * 4] = Infinity;
    box[i * 4 + 1] = Infinity;
    box[i * 4 + 2] = -Infinity;
    box[i * 4 + 3] = -Infinity;
  }
  const grow = (g: number, c: CNode): void => {
    if (c.x - c.w / 2 < box[g * 4]) box[g * 4] = c.x - c.w / 2;
    if (c.y - c.h / 2 < box[g * 4 + 1]) box[g * 4 + 1] = c.y - c.h / 2;
    if (c.x + c.w / 2 > box[g * 4 + 2]) box[g * 4 + 2] = c.x + c.w / 2;
    if (c.y + c.h / 2 > box[g * 4 + 3]) box[g * 4 + 3] = c.y + c.h / 2;
  };
  for (const i of real) if (nodes[i].parent >= 0 && laneSlot[nodes[i].parent] < 0) grow(nodes[i].parent, nodes[i]);
  for (const g of inner) {
    const c = nodes[g];
    if (box[g * 4] === Infinity) continue;
    const w = Math.max(box[g * 4 + 2] - box[g * 4] + 2 * c.padX, c.minW);
    c.x = (box[g * 4] + box[g * 4 + 2]) / 2;
    c.w = w;
    c.y = (box[g * 4 + 1] - c.padTop + box[g * 4 + 3] + c.padBottom) / 2;
    c.h = box[g * 4 + 3] - box[g * 4 + 1] + c.padTop + c.padBottom;
    if (c.parent >= 0 && laneSlot[c.parent] < 0) grow(c.parent, c);
  }

  for (const e of edges) e.route = [];
  for (let k = 0; k < m; k++) {
    const e = ledges[k];
    const out = edges[edgeOf[k]];
    const a = e.reversed ? e.head : e.tail;
    const b = e.reversed ? e.tail : e.head;
    const pts: number[] = [C[a], bandEnd[RANK[a]] - (bandEnd[RANK[a]] - bandStart[RANK[a]] - DEPTH[a]) / 2];
    const d0 = firstDummy[k];
    if (d0 >= 0) {
      for (let d = d0; d < d0 + span[k] - 1; d++) {
        pts.push(C[d], bandStart[RANK[d]]);
        if (bandEnd[RANK[d]] > bandStart[RANK[d]]) pts.push(C[d], bandEnd[RANK[d]]);
      }
    }
    pts.push(C[b], bandStart[RANK[b]] + (bandEnd[RANK[b]] - bandStart[RANK[b]] - DEPTH[b]) / 2);
    const route: number[] = [];
    for (let p = 0; p < pts.length; p += 2) route.push(px(pts[p], pts[p + 1]), py(pts[p], pts[p + 1]), axis);
    if (e.reversed) {
      for (let i = 0, j = route.length - 3; i < j; i += 3, j -= 3) {
        for (let t = 0; t < 2; t++) {
          const keep = route[i + t];
          route[i + t] = route[j + t];
          route[j + t] = keep;
        }
      }
    }
    out.route = route;
    const label = labelItem[k];
    if (label >= 0) {
      const mid = (bandStart[RANK[label]] + bandEnd[RANK[label]]) / 2;
      out.labelX = px(C[label], mid);
      out.labelY = py(C[label], mid);
    } else {
      out.labelX = (route[0] + route[route.length - 3]) / 2;
      out.labelY = (route[1] + route[route.length - 2]) / 2;
    }
  }

  // An edge that starts or ends at a lane or a group runs straight to its border.
  for (const e of edges) {
    if (e.route.length > 0 || e.src === e.dst) continue;
    const a = nodes[e.src];
    const b = nodes[e.dst];
    const [ax, ay] = border(a, b);
    const [bx, by] = border(b, a);
    const flat = Math.abs(bx - ax) > Math.abs(by - ay) ? 1 : 0;
    e.route = [ax, ay, flat, bx, by, flat];
    e.labelX = (ax + bx) / 2;
    e.labelY = (ay + by) / 2;
  }

  return { width: sideways ? length : breadthTotal, height: sideways ? breadthTotal : length };
}

// The point where the line from one box's center to another's leaves the first box. When the
// other center is inside the box, the point is on the nearest side instead.
function border(from: CNode, to: CNode): [number, number] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const hw = Math.max(from.w / 2, 0.5);
  const hh = Math.max(from.h / 2, 0.5);
  if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
    const toSide = hw - Math.abs(dx);
    const toEnd = hh - Math.abs(dy);
    return toSide < toEnd ? [from.x + (dx < 0 ? -hw : hw), to.y] : [to.x, from.y + (dy < 0 ? -hh : hh)];
  }
  const scale = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
  return [from.x + dx * scale, from.y + dy * scale];
}
