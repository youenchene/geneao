/**
 * Custom SVG tree viewer with hourglass layout.
 * Ancestors fan out upward, descendants fan out downward,
 * centered on the focal couple.
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
import type { TreeLayout, PositionedNode, PositionedEdge } from "../lib/tree-layout";
import TreeNodeView, { NODE_HEIGHT } from "../components/TreeNodeView";
import SearchPanel from "../components/SearchPanel";

interface Props {
  data: GedcomData;
  onDataChanged?: () => void;
}

/** Filter layout to hide collapsed subtrees (downward) or ancestor branches (upward). */
function filterLayout(
  layout: TreeLayout,
  collapsedIds: Set<string>
): { nodes: PositionedNode[]; edges: PositionedEdge[] } {
  if (collapsedIds.size === 0) return { nodes: layout.nodes, edges: layout.edges };

  const hiddenPositions = new Set<string>();

  /** Hide descendants (walk downward: parent → child). */
  function markHiddenDown(px: number, py: number) {
    for (const edge of layout.edges) {
      if (edge.parentX === px && edge.parentY === py && edge.childY > py) {
        const key = `${edge.childX},${edge.childY}`;
        if (!hiddenPositions.has(key)) {
          hiddenPositions.add(key);
          markHiddenDown(edge.childX, edge.childY);
        }
      }
    }
  }

  /** Hide ancestors (walk upward: child → parent). */
  function markHiddenUp(cx: number, cy: number) {
    for (const edge of layout.edges) {
      if (edge.childX === cx && edge.childY === cy && edge.parentY < cy) {
        const key = `${edge.parentX},${edge.parentY}`;
        if (!hiddenPositions.has(key)) {
          hiddenPositions.add(key);
          markHiddenUp(edge.parentX, edge.parentY);
        }
      }
    }
  }

  for (const pn of layout.nodes) {
    if (!collapsedIds.has(pn.node.id)) continue;

    // Ancestor nodes (id starts with "anc-"): collapse hides parents (upward)
    if (pn.node.id.startsWith("anc-")) {
      markHiddenUp(pn.x, pn.y);
    } else {
      // Descendant nodes: collapse hides children (downward)
      markHiddenDown(pn.x, pn.y);
    }
  }

  const nodes = layout.nodes.filter(
    (pn) => !hiddenPositions.has(`${pn.x},${pn.y}`)
  );
  const edges = layout.edges.filter(
    (e) =>
      !hiddenPositions.has(`${e.parentX},${e.parentY}`) &&
      !hiddenPositions.has(`${e.childX},${e.childY}`)
  );

  return { nodes, edges };
}

/**
 * Count collapsible connections for a node.
 * For ancestor nodes: count parent edges (upward).
 * For descendant nodes: count child edges (downward).
 */
function countCollapsible(
  layout: TreeLayout,
  nodeId: string,
  nodeX: number,
  nodeY: number
): number {
  if (nodeId.startsWith("anc-")) {
    // Count edges going up from this node
    return layout.edges.filter(
      (e) => e.childX === nodeX && e.childY === nodeY && e.parentY < nodeY
    ).length;
  }
  // Count edges going down from this node
  return layout.edges.filter(
    (e) => e.parentX === nodeX && e.parentY === nodeY && e.childY > nodeY
  ).length;
}

/**
 * Zoom control buttons + search.
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
      <button onClick={() => zoomIn(0.3)} className={btnClass} title={t("viewer.zoomIn")}>+</button>
      <button onClick={() => zoomOut(0.3)} className={btnClass} title={t("viewer.zoomOut")}>−</button>
      <button onClick={() => resetTransform()} className={`${btnClass} text-xs font-semibold`} title={t("viewer.fitToScreen")}>⊞</button>
    </div>
  );
}

export default function CustomViewerPage({ data, onDataChanged }: Props) {
  const { t } = useTranslation();
  const layout = useMemo(() => computeTreeLayout(data), [data]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
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
                const goingDown = edge.childY > edge.parentY;

                if (goingDown) {
                  // Descendant edge: parent bottom → child top
                  const startY = edge.parentY + NODE_HEIGHT;
                  const endY = edge.childY;
                  const midY = (startY + endY) / 2;
                  return (
                    <path
                      key={i}
                      d={`M ${edge.parentX} ${startY}
                          L ${edge.parentX} ${midY}
                          L ${edge.childX} ${midY}
                          L ${edge.childX} ${endY}`}
                      fill="none"
                      stroke="#d6d3d1"
                      strokeWidth={1.5}
                    />
                  );
                } else {
                  // Ancestor edge: parent top → child bottom (upward)
                  const startY = edge.parentY;
                  const endY = edge.childY + NODE_HEIGHT;
                  const midY = (startY + endY) / 2;
                  return (
                    <path
                      key={i}
                      d={`M ${edge.parentX} ${startY}
                          L ${edge.parentX} ${midY}
                          L ${edge.childX} ${midY}
                          L ${edge.childX} ${endY}`}
                      fill="none"
                      stroke="#d6d3d1"
                      strokeWidth={1.5}
                    />
                  );
                }
              })}
            </g>
            {/* Nodes */}
            <g>
              {nodes.map((posNode) => (
                <TreeNodeView
                  key={posNode.node.id}
                  posNode={posNode}
                  data={data}
                  onToggleCollapse={handleToggleCollapse}
                  isCollapsed={collapsedIds.has(posNode.node.id)}
                  childCount={countCollapsible(layout, posNode.node.id, posNode.x, posNode.y)}
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
