import type { IssueSummary } from "./types";
import { layerLabel, type LineageEdge, type LineageLayout } from "./lineageLayers";

export type PedigreeOrientation = "tb" | "lr";

export const PEDIGREE_CARD_W = 168;
export const PEDIGREE_CARD_H = 72;
export const PEDIGREE_GAP = 12;
export const PEDIGREE_LAYER_GAP = 56;
export const PEDIGREE_PAD = 24;
export const PEDIGREE_LABEL_STRIP = 28;

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
  }));

  for (let li = 1; li < rows.length; li += 1) {
    const prevKeys = new Set(rows[li - 1].issues.map((i) => i.key));
    const prevIndex = (key: string): number => {
      const idx = rows[li - 1].issues.findIndex((i) => i.key === key);
      return idx >= 0 ? idx : rows[li - 1].issues.length;
    };

    rows[li].issues.sort((a, b) => {
      const blockersA = a.blockerKeys.filter((k) => prevKeys.has(k));
      const blockersB = b.blockerKeys.filter((k) => prevKeys.has(k));
      const avg = (keys: string[]) =>
        keys.length === 0
          ? Number.POSITIVE_INFINITY
          : keys.reduce((sum, k) => sum + prevIndex(k), 0) / keys.length;

      const avgA = avg(blockersA);
      const avgB = avg(blockersB);
      if (avgA !== avgB) return avgA - avgB;
      return b.leverage - a.leverage || a.key.localeCompare(b.key);
    });
  }

  return rows;
}

function busPathTb(from: PedigreeNodeBox, to: PedigreeNodeBox): string {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2;
  const y2 = to.y;
  const busY = y1 + (y2 - y1) / 2;
  return `M ${x1} ${y1} L ${x1} ${busY} L ${x2} ${busY} L ${x2} ${y2}`;
}

function busPathLr(from: PedigreeNodeBox, to: PedigreeNodeBox): string {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const busX = x1 + (x2 - x1) / 2;
  return `M ${x1} ${y1} L ${busX} ${y1} L ${busX} ${y2} L ${x2} ${y2}`;
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
        label: layerLabel(row.layerIndex),
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
        label: layerLabel(row.layerIndex),
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

  const edgePaths: PedigreeEdgePath[] = [];
  for (const edge of layout.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) continue;
    const d =
      orientation === "tb" ? busPathTb(from, to) : busPathLr(from, to);
    edgePaths.push({ from: edge.from, to: edge.to, d });
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
