/**
 * Custom SVG tree viewer.
 * Uses relatives-tree for layout, react-zoom-pan-pinch for navigation,
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
import type { TreeLayout } from "../lib/tree-layout";
import TreeNodeView from "../components/TreeNodeView";
import SearchPanel from "../components/SearchPanel";

interface Props {
  data: GedcomData;
  onDataChanged?: () => void;
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
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleHighlight = useCallback((personId: string | null) => {
    setHighlightedPersonId(personId);
  }, []);

  const { nodes, edges } = layout;

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
            {/* Connectors (edges) */}
            <g>
              {edges.map((edge, i) => (
                <line
                  key={i}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke="#d6d3d1"
                  strokeWidth={1.5}
                />
              ))}
            </g>
            {/* Nodes */}
            <g>
              {nodes.map((posNode) => (
                <TreeNodeView
                  key={posNode.node.id}
                  posNode={posNode}
                  data={data}
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
