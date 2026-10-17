import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomEventNode } from './CustomEventNode';
import { Plus, RotateCcw, Info } from 'lucide-react';

const nodeTypes = {
  eventStage: CustomEventNode,
};

function hasCycle(edges: Edge[], source: string, target: string): boolean {
  if (source === target) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const visited = new Set<string>();
  const queue = [target];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === source) return true;
    if (!visited.has(curr)) {
      visited.add(curr);
      for (const next of adj.get(curr) || []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }
  return false;
}

/** Returns true if the user is focused on a text-entry element */
function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onDeleteEdge?: (edge: Edge) => void;
  onPaneClick: () => void;
  onNodeDragStop?: (event: MouseEvent | TouchEvent, node: Node) => void;
  onAddTaskClick: () => void;
  onResetSampleClick: () => void;
  selectedEdgeId?: string | null;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onDeleteEdge,
  onPaneClick,
  onNodeDragStop,
  onAddTaskClick,
  onResetSampleClick,
  selectedEdgeId,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Keyboard-guarded edge deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (isTypingInInput()) return;
      if (!selectedEdgeId) return;
      const edge = edges.find((ed) => ed.id === selectedEdgeId);
      if (edge && onDeleteEdge) {
        e.preventDefault();
        e.stopPropagation();
        onDeleteEdge(edge);
      }
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('keydown', handleKeyDown, true);
    }
    return () => {
      if (wrapper) {
        wrapper.removeEventListener('keydown', handleKeyDown, true);
      }
    };
  }, [selectedEdgeId, edges, onDeleteEdge]);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      const alreadyExists = edges.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      if (alreadyExists) return false;
      return !hasCycle(edges, connection.source, connection.target);
    },
    [edges]
  );

  // Apply selection highlight to edges
  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      const isSelected = edge.id === selectedEdgeId;
      return {
        ...edge,
        selected: isSelected,
        animated: !isSelected,
        style: {
          stroke: isSelected ? '#b94a4a' : '#8b96a8',
          strokeWidth: isSelected ? 2.5 : 1.5,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
        },
      };
    });
  }, [edges, selectedEdgeId]);

  return (
    <div className="ops-canvas-wrapper" ref={wrapperRef} tabIndex={-1}>
      {/* Top Floating Operations Toolbar */}
      <div className="ops-canvas-toolbar">
        <button
          type="button"
          className="ops-btn-toolbar ops-btn-toolbar-primary"
          onClick={onAddTaskClick}
          title="Add a new task node to this mission"
        >
          <Plus size={13} />
          <span>Add Task</span>
        </button>

        <div className="ops-toolbar-separator" />

        <div className="ops-canvas-legend">
          <span className="ops-legend-dot" />
          <span>Source precedes target</span>
        </div>

        <div className="ops-toolbar-spacer" />

        <button
          type="button"
          className="ops-btn-toolbar"
          onClick={onResetSampleClick}
          title="Restore the standard sample event workflow"
        >
          <RotateCcw size={12} />
          <span>Reset sample</span>
        </button>
      </div>

      {/* Edge Selection Hint Banner */}
      {selectedEdgeId && (
        <div className="ops-canvas-hint">
          <Info size={13} />
          <span>Edge selected — press <kbd>Delete</kbd> or <kbd>Backspace</kbd> to remove this dependency</span>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        isValidConnection={isValidConnection}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="#d8d8d1"
        />
        <Controls
          className="ops-flow-controls"
          showInteractive={false}
        />
        <MiniMap
          className="ops-flow-minimap"
          nodeStrokeColor="#8490a2"
          nodeColor="#ffffff"
          maskColor="rgba(245, 244, 239, 0.72)"
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};
