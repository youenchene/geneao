/**
 * Renders a tree node: either a couple (two person cards side-by-side)
 * or a single individual card. Supports highlighting a specific person.
 */
import { useState } from "react";
import type { PositionedNode } from "../lib/tree-layout";
import PersonCard from "./PersonCard";

interface Props {
  posNode: PositionedNode;
  onToggleCollapse?: (nodeId: string) => void;
  isCollapsed?: boolean;
  childCount?: number;
  highlightedPersonId?: string | null;
}

const CARD_W = 90;
const CARD_H = 50;
const COUPLE_GAP = 8;

export const NODE_WIDTH = CARD_W * 2 + COUPLE_GAP;
export const NODE_HEIGHT = CARD_H;

export default function TreeNodeView({
  posNode,
  onToggleCollapse,
  isCollapsed,
  childCount,
  highlightedPersonId,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const { node, x, y } = posNode;

  // Center the node at (x, y)
  const startX = x - NODE_WIDTH / 2;
  const startY = y;

  if (node.type === "couple") {
    const husbandHighlighted = highlightedPersonId && node.husband?.id === highlightedPersonId;
    const wifeHighlighted = highlightedPersonId && node.wife?.id === highlightedPersonId;

    return (
      <g
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Husband card (left) */}
        {node.husband && (
          <>
            {husbandHighlighted && (
              <rect
                x={startX - 3}
                y={startY - 3}
                width={CARD_W + 6}
                height={CARD_H + 6}
                rx={8}
                ry={8}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            )}
            <PersonCard
              individual={node.husband}
              x={startX}
              y={startY}
              width={CARD_W}
              height={CARD_H}
            />
          </>
        )}
        {/* Wife card (right) */}
        {node.wife && (
          <>
            {wifeHighlighted && (
              <rect
                x={startX + CARD_W + COUPLE_GAP - 3}
                y={startY - 3}
                width={CARD_W + 6}
                height={CARD_H + 6}
                rx={8}
                ry={8}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            )}
            <PersonCard
              individual={node.wife}
              x={startX + CARD_W + COUPLE_GAP}
              y={startY}
              width={CARD_W}
              height={CARD_H}
            />
          </>
        )}
        {/* Marriage connector line */}
        {node.husband && node.wife && (
          <line
            x1={startX + CARD_W}
            y1={startY + CARD_H / 2}
            x2={startX + CARD_W + COUPLE_GAP}
            y2={startY + CARD_H / 2}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        )}
        {/* If only one spouse, center the single card */}
        {!node.husband && !node.wife && node.family && (
          <rect
            x={startX}
            y={startY}
            width={NODE_WIDTH}
            height={CARD_H}
            rx={6}
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth={1}
          />
        )}
        {/* Collapse/expand toggle */}
        {childCount !== undefined && childCount > 0 && (
          <g
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.(node.id);
            }}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x}
              cy={startY + CARD_H + 12}
              r={9}
              fill={hovered ? "#e2e8f0" : "white"}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={x}
              y={startY + CARD_H + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fill="#475569"
              fontFamily="system-ui, sans-serif"
              fontWeight={700}
            >
              {isCollapsed ? `+${childCount}` : "−"}
            </text>
          </g>
        )}
      </g>
    );
  }

  // Single individual node
  const individualHighlighted =
    highlightedPersonId && node.individual?.id === highlightedPersonId;

  return (
    <g>
      {individualHighlighted && (
        <rect
          x={x - CARD_W / 2 - 3}
          y={startY - 3}
          width={CARD_W + 6}
          height={CARD_H + 6}
          rx={8}
          ry={8}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={3}
        />
      )}
      <PersonCard
        individual={node.individual!}
        x={x - CARD_W / 2}
        y={startY}
        width={CARD_W}
        height={CARD_H}
      />
    </g>
  );
}
