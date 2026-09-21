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
  id: string;
  from: string;
  to: string;
  d: string;
  /** True when this segment uses skip (dotted) styling. */
  skipsLayers: boolean;
  /** Draw arrowhead at path end (skip branches only). */
  showArrow: boolean;
  /** Keys that activate this segment on focus. */
  related: string[];
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

interface BundleTarget {
  edge: LineageEdge;
  box: PedigreeNodeBox;
  skipsLayers: boolean;
}

function bundlePathsTb(
  from: PedigreeNodeBox,
  targets: BundleTarget[],
  downward: boolean,
  idPrefix: string,
): PedigreeEdgePath[] {
  if (targets.length === 0) return [];

  const sorted = [...targets].sort(
    (a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2),
  );
  const cx = from.x + from.w / 2;
  const yExit = downward ? from.y + from.h : from.y;
  const busY = downward
    ? from.y + from.h + PEDIGREE_LAYER_GAP / 2
    : from.y - PEDIGREE_LAYER_GAP / 2;

  const relatedAll = [from.key, ...sorted.map((t) => t.edge.to)];
  const xs = sorted.map((t) => t.box.x + t.box.w / 2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const paths: PedigreeEdgePath[] = [];

  // Shared trunk: leave source, then horizontal span covering all branches.
  // Style: dotted only if every branch is a skip; otherwise solid.
  const trunkSkip = sorted.every((t) => t.skipsLayers);
  paths.push({
    id: `${idPrefix}-trunk`,
    from: from.key,
    to: sorted[0].edge.to,
    d: `M ${cx} ${yExit} L ${cx} ${busY} L ${minX} ${busY} L ${maxX} ${busY}`,
    skipsLayers: trunkSkip,
    showArrow: false,
    related: relatedAll,
  });

  for (const t of sorted) {
    const tx = t.box.x + t.box.w / 2;
    const ty = downward ? t.box.y : t.box.y + t.box.h;
    paths.push({
      id: `${idPrefix}-to-${t.edge.to}`,
      from: from.key,
      to: t.edge.to,
      d: `M ${tx} ${busY} L ${tx} ${ty}`,
      skipsLayers: t.skipsLayers,
      showArrow: t.skipsLayers,
      related: [from.key, t.edge.to],
    });
  }

  return paths;
}

function bundlePathsLr(
  from: PedigreeNodeBox,
  targets: BundleTarget[],
  rightward: boolean,
  idPrefix: string,
): PedigreeEdgePath[] {
  if (targets.length === 0) return [];

  const sorted = [...targets].sort(
    (a, b) => a.box.y + a.box.h / 2 - (b.box.y + b.box.h / 2),
  );
  const cy = from.y + from.h / 2;
  const xExit = rightward ? from.x + from.w : from.x;
  const busX = rightward
    ? from.x + from.w + PEDIGREE_LAYER_GAP / 2
    : from.x - PEDIGREE_LAYER_GAP / 2;

  const relatedAll = [from.key, ...sorted.map((t) => t.edge.to)];
  const ys = sorted.map((t) => t.box.y + t.box.h / 2);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const paths: PedigreeEdgePath[] = [];
  const trunkSkip = sorted.every((t) => t.skipsLayers);

  paths.push({
    id: `${idPrefix}-trunk`,
    from: from.key,
    to: sorted[0].edge.to,
    d: `M ${xExit} ${cy} L ${busX} ${cy} L ${busX} ${minY} L ${busX} ${maxY}`,
    skipsLayers: trunkSkip,
    showArrow: false,
    related: relatedAll,
  });

  for (const t of sorted) {
    const ty = t.box.y + t.box.h / 2;
    const tx = rightward ? t.box.x : t.box.x + t.box.w;
    paths.push({
      id: `${idPrefix}-to-${t.edge.to}`,
      from: from.key,
      to: t.edge.to,
      d: `M ${busX} ${ty} L ${tx} ${ty}`,
      skipsLayers: t.skipsLayers,
      showArrow: t.skipsLayers,
      related: [from.key, t.edge.to],
    });
  }

  return paths;
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

  const bySource = new Map<string, LineageEdge[]>();
  for (const edge of drawable) {
    const list = bySource.get(edge.from) ?? [];
    list.push(edge);
    bySource.set(edge.from, list);
  }

  const edgePaths: PedigreeEdgePath[] = [];

  for (const [fromKey, edges] of bySource) {
    const from = nodes.get(fromKey)!;
    const peers: BundleTarget[] = [];
    const forward: BundleTarget[] = [];
    const backward: BundleTarget[] = [];

    for (const edge of edges) {
      const box = nodes.get(edge.to)!;
      const skipsLayers = Math.abs(box.layerIndex - from.layerIndex) > 1;
      const target: BundleTarget = { edge, box, skipsLayers };
      if (box.layerIndex === from.layerIndex) {
        peers.push(target);
      } else if (box.layerIndex > from.layerIndex) {
        forward.push(target);
      } else {
        backward.push(target);
      }
    }

    for (const t of peers) {
      edgePaths.push({
        id: `peer-${fromKey}-${t.edge.to}`,
        from: fromKey,
        to: t.edge.to,
        d:
          orientation === "tb"
            ? peerPathTb(from, t.box)
            : peerPathLr(from, t.box),
        skipsLayers: false,
        showArrow: false,
        related: [fromKey, t.edge.to],
      });
    }

    if (orientation === "tb") {
      edgePaths.push(
        ...bundlePathsTb(from, forward, true, `tb-fwd-${fromKey}`),
        ...bundlePathsTb(from, backward, false, `tb-back-${fromKey}`),
      );
    } else {
      edgePaths.push(
        ...bundlePathsLr(from, forward, true, `lr-fwd-${fromKey}`),
        ...bundlePathsLr(from, backward, false, `lr-back-${fromKey}`),
      );
    }
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
