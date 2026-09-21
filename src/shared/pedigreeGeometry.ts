import type { IssueSummary } from "./types";
import type { LineageEdge, LineageLayout } from "./lineageLayers";

export type PedigreeOrientation = "tb" | "lr";

export const PEDIGREE_CARD_W = 168;
export const PEDIGREE_CARD_H = 72;
export const PEDIGREE_GAP = 12;
/** Extra room between layers for staggered connector lanes. */
export const PEDIGREE_LAYER_GAP = 72;
export const PEDIGREE_PAD = 24;
/** Gutter for layer labels (TB: left of cards; LR: above cards). */
export const PEDIGREE_LABEL_STRIP = 56;

const PORT_INSET = 16;
const LANE_SPACING = 6;

export interface PedigreeNodeBox {
  key: string;
  issue: IssueSummary;
  x: number;
  y: number;
  w: number;
  h: number;
  layerIndex: number;
}

export interface PedigreeLayerLabel {
  layerIndex: number;
  x: number;
  y: number;
  label: string;
}

export interface PedigreeEdgePath {
  from: string;
  to: string;
  d: string;
  /** True when the edge spans more than one layer gap (passes through a layer). */
  skipsLayers: boolean;
}

export interface PedigreeGeometry {
  nodes: Map<string, PedigreeNodeBox>;
  layerLabels: PedigreeLayerLabel[];
  width: number;
  height: number;
  edges: LineageEdge[];
  edgePaths: PedigreeEdgePath[];
}

function barycenterLayers(layout: LineageLayout): LineageLayout["layers"] {
  const rows = layout.layers.map((row) => ({
    layerIndex: row.layerIndex,
    issues: [...row.issues],
    label: row.label,
  }));

  const sortByNeighbors = (
    li: number,
    neighborLi: number,
    useBlockers: boolean,
  ) => {
    const neighborKeys = new Set(rows[neighborLi].issues.map((i) => i.key));
    const neighborIndex = (key: string): number => {
      const idx = rows[neighborLi].issues.findIndex((i) => i.key === key);
      return idx >= 0 ? idx : rows[neighborLi].issues.length;
    };

    rows[li].issues.sort((a, b) => {
      const keysA = (useBlockers ? a.blockerKeys : a.blockedKeys).filter((k) =>
        neighborKeys.has(k),
      );
      const keysB = (useBlockers ? b.blockerKeys : b.blockedKeys).filter((k) =>
        neighborKeys.has(k),
      );
      const avg = (keys: string[]) =>
        keys.length === 0
          ? Number.POSITIVE_INFINITY
          : keys.reduce((sum, k) => sum + neighborIndex(k), 0) / keys.length;

      const avgA = avg(keysA);
      const avgB = avg(keysB);
      if (avgA !== avgB) return avgA - avgB;
      return b.leverage - a.leverage || a.key.localeCompare(b.key);
    });
  };

  // Two passes (down then up) cut crossings without a full Sugiyama solver.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let li = 1; li < rows.length; li += 1) {
      sortByNeighbors(li, li - 1, true);
    }
    for (let li = rows.length - 2; li >= 0; li -= 1) {
      sortByNeighbors(li, li + 1, false);
    }
  }

  return rows;
}

function portOffset(
  index: number,
  count: number,
  size: number,
): number {
  if (count <= 1) return size / 2;
  const usable = Math.max(size - PORT_INSET * 2, size * 0.4);
  return PORT_INSET + ((index + 0.5) / count) * usable;
}

function laneOffset(index: number, count: number, gapSpan: number): number {
  if (count <= 1) return 0;
  const maxSpread = Math.min(
    (count - 1) * LANE_SPACING,
    Math.max(gapSpan - 12, LANE_SPACING),
  );
  const step = count > 1 ? maxSpread / (count - 1) : 0;
  return -maxSpread / 2 + index * step;
}

function busPathTb(
  from: PedigreeNodeBox,
  to: PedigreeNodeBox,
  outIndex: number,
  outCount: number,
  inIndex: number,
  inCount: number,
  laneIndex: number,
  laneCount: number,
): string {
  const x1 = from.x + portOffset(outIndex, outCount, from.w);
  const y1 = from.y + from.h;
  const x2 = to.x + portOffset(inIndex, inCount, to.w);
  const y2 = to.y;
  const gapSpan = Math.abs(y2 - y1);
  const mid = (y1 + y2) / 2;
  const busY = mid + laneOffset(laneIndex, laneCount, gapSpan);
  return `M ${x1} ${y1} L ${x1} ${busY} L ${x2} ${busY} L ${x2} ${y2}`;
}

function busPathLr(
  from: PedigreeNodeBox,
  to: PedigreeNodeBox,
  outIndex: number,
  outCount: number,
  inIndex: number,
  inCount: number,
  laneIndex: number,
  laneCount: number,
): string {
  const x1 = from.x + from.w;
  const y1 = from.y + portOffset(outIndex, outCount, from.h);
  const x2 = to.x;
  const y2 = to.y + portOffset(inIndex, inCount, to.h);
  const gapSpan = Math.abs(x2 - x1);
  const mid = (x1 + x2) / 2;
  const busX = mid + laneOffset(laneIndex, laneCount, gapSpan);
  return `M ${x1} ${y1} L ${busX} ${y1} L ${busX} ${y2} L ${x2} ${y2}`;
}

/**
 * Continuous skip-layer path: horizontal jog only in the gutter next to the
 * source, then a straight vertical run that may pass through intermediate cards.
 */
function skipBusPathTb(
  from: PedigreeNodeBox,
  to: PedigreeNodeBox,
  outIndex: number,
  outCount: number,
  inIndex: number,
  inCount: number,
  laneIndex: number,
  laneCount: number,
): string {
  const x1 = from.x + portOffset(outIndex, outCount, from.w);
  const y1 = from.y + from.h;
  const x2 = to.x + portOffset(inIndex, inCount, to.w);
  const y2 = to.y;
  const lane = laneOffset(laneIndex, laneCount, PEDIGREE_LAYER_GAP);
  const busY =
    y2 >= y1
      ? y1 + PEDIGREE_LAYER_GAP / 2 + lane
      : from.y - PEDIGREE_LAYER_GAP / 2 + lane;
  return `M ${x1} ${y1} L ${x1} ${busY} L ${x2} ${busY} L ${x2} ${y2}`;
}

function skipBusPathLr(
  from: PedigreeNodeBox,
  to: PedigreeNodeBox,
  outIndex: number,
  outCount: number,
  inIndex: number,
  inCount: number,
  laneIndex: number,
  laneCount: number,
): string {
  const x1 = from.x + from.w;
  const y1 = from.y + portOffset(outIndex, outCount, from.h);
  const x2 = to.x;
  const y2 = to.y + portOffset(inIndex, inCount, to.h);
  const lane = laneOffset(laneIndex, laneCount, PEDIGREE_LAYER_GAP);
  const busX =
    x2 >= x1
      ? x1 + PEDIGREE_LAYER_GAP / 2 + lane
      : from.x - PEDIGREE_LAYER_GAP / 2 + lane;
  return `M ${x1} ${y1} L ${busX} ${y1} L ${busX} ${y2} L ${x2} ${y2}`;
}

/** Same-layer / cycle fallback: connect card sides instead of top/bottom. */
function peerPathTb(from: PedigreeNodeBox, to: PedigreeNodeBox): string {
  const fromLeftOfTo = from.x + from.w / 2 <= to.x + to.w / 2;
  const x1 = fromLeftOfTo ? from.x + from.w : from.x;
  const x2 = fromLeftOfTo ? to.x : to.x + to.w;
  const y1 = from.y + from.h / 2;
  const y2 = to.y + to.h / 2;
  const busX = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${busX} ${y1} L ${busX} ${y2} L ${x2} ${y2}`;
}

function peerPathLr(from: PedigreeNodeBox, to: PedigreeNodeBox): string {
  const fromAboveTo = from.y + from.h / 2 <= to.y + to.h / 2;
  const y1 = fromAboveTo ? from.y + from.h : from.y;
  const y2 = fromAboveTo ? to.y : to.y + to.h;
  const x1 = from.x + from.w / 2;
  const x2 = to.x + to.w / 2;
  const busY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${busY} L ${x2} ${busY} L ${x2} ${y2}`;
}

function layerBandKey(fromLayer: number, toLayer: number): string {
  return `${fromLayer}->${toLayer}`;
}

/** Lane group for skip edges that share the source-adjacent gutter. */
function skipLaneBandKey(
  from: PedigreeNodeBox,
  to: PedigreeNodeBox,
  orientation: PedigreeOrientation,
): string {
  if (orientation === "tb") {
    return to.layerIndex >= from.layerIndex
      ? `skip-tb-below-${from.layerIndex}`
      : `skip-tb-above-${from.layerIndex}`;
  }
  return to.layerIndex >= from.layerIndex
    ? `skip-lr-right-${from.layerIndex}`
    : `skip-lr-left-${from.layerIndex}`;
}

export function buildPedigreeGeometry(
  layout: LineageLayout,
  orientation: PedigreeOrientation,
): PedigreeGeometry {
  const rows = barycenterLayers(layout);
  const nodes = new Map<string, PedigreeNodeBox>();
  const layerLabels: PedigreeLayerLabel[] = [];

  let maxRight = PEDIGREE_PAD;
  let maxBottom = PEDIGREE_PAD;

  if (orientation === "tb") {
    for (const row of rows) {
      const y = PEDIGREE_PAD + row.layerIndex * (PEDIGREE_CARD_H + PEDIGREE_LAYER_GAP);
      layerLabels.push({
        layerIndex: row.layerIndex,
        x: PEDIGREE_PAD,
        y: y + PEDIGREE_CARD_H / 2 - 6,
        label: row.label,
      });

      row.issues.forEach((issue, j) => {
        const x =
          PEDIGREE_PAD +
          PEDIGREE_LABEL_STRIP +
          j * (PEDIGREE_CARD_W + PEDIGREE_GAP);
        const box: PedigreeNodeBox = {
          key: issue.key,
          issue,
          x,
          y,
          w: PEDIGREE_CARD_W,
          h: PEDIGREE_CARD_H,
          layerIndex: row.layerIndex,
        };
        nodes.set(issue.key, box);
        maxRight = Math.max(maxRight, x + PEDIGREE_CARD_W + PEDIGREE_PAD);
        maxBottom = Math.max(maxBottom, y + PEDIGREE_CARD_H + PEDIGREE_PAD);
      });
    }
  } else {
    for (const row of rows) {
      const x = PEDIGREE_PAD + row.layerIndex * (PEDIGREE_CARD_W + PEDIGREE_LAYER_GAP);
      layerLabels.push({
        layerIndex: row.layerIndex,
        x,
        y: PEDIGREE_PAD,
        label: row.label,
      });

      row.issues.forEach((issue, j) => {
        const y =
          PEDIGREE_PAD +
          PEDIGREE_LABEL_STRIP +
          j * (PEDIGREE_CARD_H + PEDIGREE_GAP);
        const box: PedigreeNodeBox = {
          key: issue.key,
          issue,
          x,
          y,
          w: PEDIGREE_CARD_W,
          h: PEDIGREE_CARD_H,
          layerIndex: row.layerIndex,
        };
        nodes.set(issue.key, box);
        maxRight = Math.max(maxRight, x + PEDIGREE_CARD_W + PEDIGREE_PAD);
        maxBottom = Math.max(maxBottom, y + PEDIGREE_CARD_H + PEDIGREE_PAD);
      });
    }
  }

  const drawable = layout.edges.filter(
    (e) => nodes.has(e.from) && nodes.has(e.to),
  );

  const outByNode = new Map<string, LineageEdge[]>();
  const inByNode = new Map<string, LineageEdge[]>();
  const byBand = new Map<string, LineageEdge[]>();

  for (const edge of drawable) {
    const from = nodes.get(edge.from)!;
    const to = nodes.get(edge.to)!;
    const outs = outByNode.get(edge.from) ?? [];
    outs.push(edge);
    outByNode.set(edge.from, outs);
    const ins = inByNode.get(edge.to) ?? [];
    ins.push(edge);
    inByNode.set(edge.to, ins);
    const skips = Math.abs(to.layerIndex - from.layerIndex) > 1;
    const band = skips
      ? skipLaneBandKey(from, to, orientation)
      : layerBandKey(from.layerIndex, to.layerIndex);
    const list = byBand.get(band) ?? [];
    list.push(edge);
    byBand.set(band, list);
  }

  // Stable port order: sort by peer position so wires fan logically.
  for (const [key, edges] of outByNode) {
    edges.sort((a, b) => {
      const ta = nodes.get(a.to)!;
      const tb = nodes.get(b.to)!;
      return orientation === "tb" ? ta.x - tb.x : ta.y - tb.y;
    });
    outByNode.set(key, edges);
  }
  for (const [key, edges] of inByNode) {
    edges.sort((a, b) => {
      const fa = nodes.get(a.from)!;
      const fb = nodes.get(b.from)!;
      return orientation === "tb" ? fa.x - fb.x : fa.y - fb.y;
    });
    inByNode.set(key, edges);
  }
  for (const [band, edges] of byBand) {
    edges.sort((a, b) => {
      const fa = nodes.get(a.from)!;
      const fb = nodes.get(b.from)!;
      const primary =
        orientation === "tb" ? fa.x - fb.x || fa.y - fb.y : fa.y - fb.y || fa.x - fb.x;
      if (primary !== 0) return primary;
      const ta = nodes.get(a.to)!;
      const tb = nodes.get(b.to)!;
      return orientation === "tb" ? ta.x - tb.x : ta.y - tb.y;
    });
    byBand.set(band, edges);
  }

  const edgePaths: PedigreeEdgePath[] = [];
  for (const edge of drawable) {
    const from = nodes.get(edge.from)!;
    const to = nodes.get(edge.to)!;
    const outs = outByNode.get(edge.from)!;
    const ins = inByNode.get(edge.to)!;
    const skipsLayers = Math.abs(to.layerIndex - from.layerIndex) > 1;
    const band = byBand.get(
      skipsLayers
        ? skipLaneBandKey(from, to, orientation)
        : layerBandKey(from.layerIndex, to.layerIndex),
    )!;
    const outIndex = outs.indexOf(edge);
    const inIndex = ins.indexOf(edge);
    const laneIndex = band.indexOf(edge);

    const d =
      from.layerIndex === to.layerIndex
        ? orientation === "tb"
          ? peerPathTb(from, to)
          : peerPathLr(from, to)
        : skipsLayers
          ? orientation === "tb"
            ? skipBusPathTb(
                from,
                to,
                outIndex,
                outs.length,
                inIndex,
                ins.length,
                laneIndex,
                band.length,
              )
            : skipBusPathLr(
                from,
                to,
                outIndex,
                outs.length,
                inIndex,
                ins.length,
                laneIndex,
                band.length,
              )
          : orientation === "tb"
            ? busPathTb(
                from,
                to,
                outIndex,
                outs.length,
                inIndex,
                ins.length,
                laneIndex,
                band.length,
              )
            : busPathLr(
                from,
                to,
                outIndex,
                outs.length,
                inIndex,
                ins.length,
                laneIndex,
                band.length,
              );

    edgePaths.push({ from: edge.from, to: edge.to, d, skipsLayers });
  }

  return {
    nodes,
    layerLabels,
    width: maxRight,
    height: maxBottom,
    edges: layout.edges,
    edgePaths,
  };
}
