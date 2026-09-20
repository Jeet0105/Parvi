const NODE_WIDTH = 190;
const NODE_HEIGHT = 96;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 90;

const EDGE_COLOURS = {
  VERIFIED: '#059669',
  PENDING: '#d97706',
  UNDER_REVIEW: '#2563eb',
  REJECTED: '#dc2626',
};

/**
 * Turns the API's graph into positioned React Flow nodes and edges.
 *
 * The backend supplies each member's generation; this only decides where
 * members sit within their row, so layout stays a presentation concern.
 */
export function toFlowElements({ nodes = [], relationships = [] }) {
  const rows = new Map();
  for (const node of nodes) {
    const row = rows.get(node.generation) || [];
    row.push(node);
    rows.set(node.generation, row);
  }

  const widestRow = Math.max(1, ...[...rows.values()].map((row) => row.length));
  const canvasWidth = widestRow * (NODE_WIDTH + HORIZONTAL_GAP);

  const flowNodes = [];
  for (const [generation, row] of rows) {
    // Centre each row so the tree reads as a pyramid rather than left-aligned.
    const rowWidth = row.length * (NODE_WIDTH + HORIZONTAL_GAP);
    const offset = (canvasWidth - rowWidth) / 2;

    row.forEach((node, index) => {
      flowNodes.push({
        id: node.id,
        type: 'member',
        position: {
          x: offset + index * (NODE_WIDTH + HORIZONTAL_GAP),
          y: generation * (NODE_HEIGHT + VERTICAL_GAP),
        },
        data: node,
      });
    });
  }

  const flowEdges = relationships.map((rel) => ({
    id: rel.id,
    source: rel.source,
    target: rel.target,
    label: rel.type.charAt(0) + rel.type.slice(1).toLowerCase(),
    type: rel.isHorizontal ? 'straight' : 'smoothstep',
    animated: rel.verificationStatus === 'PENDING',
    style: {
      stroke: EDGE_COLOURS[rel.verificationStatus] || '#94a3b8',
      // A dashed line reads as "claimed but not yet confirmed".
      strokeDasharray: rel.verificationStatus === 'VERIFIED' ? undefined : '6 4',
      strokeWidth: 1.5,
    },
    labelStyle: { fontSize: 11, fill: '#475569' },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
  }));

  return { flowNodes, flowEdges };
}

export { NODE_WIDTH, NODE_HEIGHT, EDGE_COLOURS };
