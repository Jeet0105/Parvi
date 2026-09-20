import { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Alert from '../components/Alert';
import MemberNode from '../components/MemberNode';
import Spinner from '../components/Spinner';
import * as familyApi from '../services/family.service';
import * as treeApi from '../services/tree.service';
import { toFlowElements } from '../utils/treeLayout';

const nodeTypes = { member: MemberNode };

const LEGEND = [
  { label: 'Verified', className: 'bg-emerald-500' },
  { label: 'Pending', className: 'bg-amber-500' },
  { label: 'Under review', className: 'bg-blue-500' },
];

export default function FamilyTreePage() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const familyResponse = await familyApi.getMyFamily();
      const family = familyResponse.data.family;

      if (!family) {
        setTree(null);
        return;
      }

      const treeResponse = await treeApi.getFamilyTree(family.id, {
        verificationStatus: verifiedOnly ? 'VERIFIED' : undefined,
      });
      setTree(treeResponse.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [verifiedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const { flowNodes, flowEdges } = useMemo(
    () => toFlowElements(tree || { nodes: [], relationships: [] }),
    [tree]
  );

  if (loading) return <Spinner label="Building family tree" />;

  if (error) return <Alert tone="error">{error}</Alert>;

  if (!tree) {
    return <Alert tone="info">Register your family to see your family tree.</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Family tree</h2>
          <p className="mt-1 text-sm text-slate-600">
            {tree.familyId} · {tree.nodes.length} member
            {tree.nodes.length === 1 ? '' : 's'} across {tree.generations}{' '}
            generation{tree.generations === 1 ? '' : 's'}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Show verified relationships only
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        {LEGEND.map(({ label, className }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-5 rounded ${className}`} aria-hidden="true" />
            {label}
          </span>
        ))}
        <span className="text-slate-400">
          Dashed lines are relationships not yet verified.
        </span>
      </div>

      {tree.relationships.length === 0 && (
        <Alert tone="info">
          {verifiedOnly
            ? 'No relationships have been verified yet.'
            : 'Add relationships between members to see how your family connects.'}
        </Alert>
      )}

      <div
        className="h-[32rem] rounded-xl border border-slate-200 bg-white"
        data-testid="family-tree-canvas"
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: false }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
        >
          <Background gap={16} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-slate-50" />
        </ReactFlow>
      </div>

      <div className="sr-only">
        <h3>Family tree as a list</h3>
        <ul>
          {tree.nodes.map((node) => (
            <li key={node.id}>
              {node.name}, generation {node.generation + 1}
              {node.isHead ? ', Family Head' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
