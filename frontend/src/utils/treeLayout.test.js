import { describe, expect, it } from 'vitest';

import { toFlowElements, NODE_WIDTH } from './treeLayout';

const node = (id, generation, extra = {}) => ({
  id,
  name: id,
  generation,
  gender: 'MALE',
  age: 40,
  status: 'ACTIVE',
  verificationStatus: 'PENDING',
  isHead: false,
  ...extra,
});

describe('toFlowElements', () => {
  it('handles an empty graph', () => {
    const { flowNodes, flowEdges } = toFlowElements({});
    expect(flowNodes).toEqual([]);
    expect(flowEdges).toEqual([]);
  });

  it('places each generation on its own row', () => {
    const { flowNodes } = toFlowElements({
      nodes: [node('a', 0), node('b', 1), node('c', 2)],
    });

    const y = Object.fromEntries(flowNodes.map((n) => [n.id, n.position.y]));
    expect(y.a).toBeLessThan(y.b);
    expect(y.b).toBeLessThan(y.c);
  });

  it('gives members in the same generation the same row', () => {
    const { flowNodes } = toFlowElements({
      nodes: [node('a', 1), node('b', 1)],
    });

    expect(flowNodes[0].position.y).toBe(flowNodes[1].position.y);
    expect(flowNodes[0].position.x).not.toBe(flowNodes[1].position.x);
  });

  it('centres a narrow row against the widest one', () => {
    const { flowNodes } = toFlowElements({
      nodes: [node('solo', 0), node('a', 1), node('b', 1), node('c', 1)],
    });

    const solo = flowNodes.find((n) => n.id === 'solo');
    const row = flowNodes.filter((n) => n.data.generation === 1);
    const rowCentre =
      (Math.min(...row.map((n) => n.position.x)) +
        Math.max(...row.map((n) => n.position.x)) +
        NODE_WIDTH) /
      2;

    expect(solo.position.x + NODE_WIDTH / 2).toBeCloseTo(rowCentre, 0);
  });

  it('passes member detail through to the node', () => {
    const { flowNodes } = toFlowElements({
      nodes: [node('head', 0, { isHead: true, name: 'Rahul Patel' })],
    });

    expect(flowNodes[0].type).toBe('member');
    expect(flowNodes[0].data).toMatchObject({ name: 'Rahul Patel', isHead: true });
  });

  it('labels edges with a readable relationship name', () => {
    const { flowEdges } = toFlowElements({
      nodes: [node('a', 0), node('b', 1)],
      relationships: [
        {
          id: 'r1',
          source: 'a',
          target: 'b',
          type: 'GRANDFATHER',
          verificationStatus: 'VERIFIED',
          isHorizontal: false,
        },
      ],
    });

    expect(flowEdges[0].label).toBe('Grandfather');
  });

  it('draws horizontal links straight and descent links stepped', () => {
    const { flowEdges } = toFlowElements({
      nodes: [node('a', 0), node('b', 0), node('c', 1)],
      relationships: [
        { id: 'r1', source: 'a', target: 'b', type: 'SPOUSE', verificationStatus: 'VERIFIED', isHorizontal: true },
        { id: 'r2', source: 'a', target: 'c', type: 'FATHER', verificationStatus: 'VERIFIED', isHorizontal: false },
      ],
    });

    expect(flowEdges.find((e) => e.id === 'r1').type).toBe('straight');
    expect(flowEdges.find((e) => e.id === 'r2').type).toBe('smoothstep');
  });

  it('draws only verified relationships as solid lines', () => {
    const { flowEdges } = toFlowElements({
      nodes: [node('a', 0), node('b', 1), node('c', 1)],
      relationships: [
        { id: 'r1', source: 'a', target: 'b', type: 'FATHER', verificationStatus: 'VERIFIED', isHorizontal: false },
        { id: 'r2', source: 'a', target: 'c', type: 'FATHER', verificationStatus: 'PENDING', isHorizontal: false },
      ],
    });

    const verified = flowEdges.find((e) => e.id === 'r1');
    const pending = flowEdges.find((e) => e.id === 'r2');

    expect(verified.style.strokeDasharray).toBeUndefined();
    expect(pending.style.strokeDasharray).toBe('6 4');
  });

  it('colours edges by verification status', () => {
    const { flowEdges } = toFlowElements({
      nodes: [node('a', 0), node('b', 1)],
      relationships: [
        { id: 'r1', source: 'a', target: 'b', type: 'FATHER', verificationStatus: 'VERIFIED', isHorizontal: false },
      ],
    });

    expect(flowEdges[0].style.stroke).toBe('#059669');
  });

  it('animates only relationships still awaiting a first decision', () => {
    const { flowEdges } = toFlowElements({
      nodes: [node('a', 0), node('b', 1), node('c', 1)],
      relationships: [
        { id: 'r1', source: 'a', target: 'b', type: 'FATHER', verificationStatus: 'PENDING', isHorizontal: false },
        { id: 'r2', source: 'a', target: 'c', type: 'FATHER', verificationStatus: 'VERIFIED', isHorizontal: false },
      ],
    });

    expect(flowEdges.find((e) => e.id === 'r1').animated).toBe(true);
    expect(flowEdges.find((e) => e.id === 'r2').animated).toBe(false);
  });
});
