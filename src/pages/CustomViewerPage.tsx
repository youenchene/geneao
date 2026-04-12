/**
 * Custom SVG tree viewer.
 * Uses d3-hierarchy for layout, react-zoom-pan-pinch for navigation,
 * and custom SVG components for rendering.
 */
import { useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import type { GedcomData } from "../lib/gedcom-parser";
import { computeTreeLayout } from "../lib/tree-layout";
import type {
  PositionedNode,
  PositionedEdge,
  TreeLayout,
} from "../lib/tree-layout";
import TreeNodeView, { NODE_HEIGHT } from "../components/TreeNodeView";
import SearchPanel from "../components/SearchPanel";

interface Props {
  data: GedcomData;
  onDataChanged?: () => void;
}

/**
 * Filter out collapsed subtrees from the layout.
 */
function filterLayout(
  layout: TreeLayout,
  collapsedIds: Set<string>
): { nodes: PositionedNode[]; edges: PositionedEdge[] } {
  if (collapsedIds.size === 0) {
    return { nodes: layout.nodes, edges: layout.edges };
  }

  const hiddenNodePositions = new Set<string>();

  function collectDescendants(nodeId: string, nodes: PositionedNode[]) {
    const node = nodes.find((n) => n.node.id === nodeId);
    if (!node) return;

    for (const edge of layout.edges) {
      if (edge.parentX === node.x && edge.parentY === node.y) {
        const childNode = nodes.find(
          (n) => n.x === edge.childX && n.y === edge.childY
        );
        if (childNode) {
          hiddenNodePositions.add(`${childNode.x},${childNode.y}`);
          collectDescendants(childNode.node.id, nodes);
        }
      }
    }
  }

  for (const id of collapsedIds) {
    collectDescendants(id, layout.nodes);
  }

  const filteredNodes = layout.nodes.filter(
    (n) => !hiddenNodePositions.has(`${n.x},${n.y}`)
  );
  const filteredNodePosSet = new Set(
    filteredNodes.map((n) => `${n.x},${n.y}`)
  );

  const filteredEdges = layout.edges.filter(
    (e) =>
      filteredNodePosSet.has(`${e.parentX},${e.parentY}`) &&
      filteredNodePosSet.has(`${e.childX},${e.childY}`)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

function countDirectChildren(
  layout: TreeLayout,
  node: PositionedNode
): number {
  return layout.edges.filter(
    (e) => e.parentX === node.x && e.parentY === node.y
  ).length;
}

/**
 * Zoom control buttons + search, rendered inside the TransformWrapper context.
 */
function Controls({
  data,
  layout,
  wrapperRef,
  onHighlight,
}: {
  data: GedcomData;
  layout: TreeLayout;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onHighlight: (personId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, resetTransform } = useControls();

  const btnClass =
    "w-8 h-8 flex items-center justify-center bg-white border border-stone-300 rounded shadow-sm hover:bg-stone-100 text-stone-700 text-lg font-bold select-none cursor-pointer";

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
      <SearchPanel
        data={data}
        layout={layout}
        wrapperRef={wrapperRef}
        onHighlight={onHighlight}
      />
      <button
        onClick={() => zoomIn(0.3)}
        className={btnClass}
        title={t("viewer.zoomIn")}
      >
        +
      </button>
      <button
        onClick={() => zoomOut(0.3)}
        className={btnClass}
        title={t("viewer.zoomOut")}
      >
        −
      </button>
      <button
        onClick={() => resetTransform()}
        className={`${btnClass} text-xs font-semibold`}
        title={t("viewer.fitToScreen")}
      >
        ⊞
      </button>
    </div>
  );
}

export default function CustomViewerPage({ data, onDataChanged }: Props) {
  const { t } = useTranslation();
  const layout = useMemo(() => computeTreeLayout(data), [data]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleHighlight = useCallback((personId: string | null) => {
    setHighlightedPersonId(personId);
  }, []);

  const { nodes, edges } = useMemo(
    () => filterLayout(layout, collapsedIds),
    [layout, collapsedIds]
  );

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-500">
        {t("viewer.noData")}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full h-full bg-stone-50">
      <TransformWrapper
        initialScale={0.4}
        minScale={0.05}
        maxScale={2}
        centerOnInit
        limitToBounds={false}
      >
        <Controls
          data={data}
          layout={layout}
          wrapperRef={wrapperRef}
          onHighlight={handleHighlight}
        />
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: layout.width, height: layout.height }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {/* Edges */}
            <g>
              {edges.map((edge, i) => {
                const midY =
                  (edge.parentY + NODE_HEIGHT + edge.childY) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${edge.parentX} ${edge.parentY + NODE_HEIGHT}
                        L ${edge.parentX} ${midY}
                        L ${edge.childX} ${midY}
                        L ${edge.childX} ${edge.childY}`}
                    fill="none"
                    stroke="#d6d3d1"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
            {/* Nodes */}
            <g>
              {nodes.map((posNode) => (
                <TreeNodeView
                  key={posNode.node.id}
                  posNode={posNode}
                  data={data}
                  onToggleCollapse={toggleCollapse}
                  isCollapsed={collapsedIds.has(posNode.node.id)}
                  childCount={countDirectChildren(layout, posNode)}
                  highlightedPersonId={highlightedPersonId}
                  onDataChanged={onDataChanged}
                />
              ))}
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
