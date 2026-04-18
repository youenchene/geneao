/**
 * Renders a tree node: a couple (two person cards side-by-side)
 * or a single individual card. Supports highlighting, edit mode
 * with add alliance/child/parent buttons.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GedcomData, Individual } from "../lib/gedcom-parser";
import type { PositionedNode, Union } from "../lib/tree-layout";
import { multiCoupleWidth } from "../lib/tree-layout";
import { useEditMode } from "../context/EditModeContext";
import PersonCard from "./PersonCard";
import AddPersonButton from "./AddPersonButton";

interface Props {
  posNode: PositionedNode;
  data: GedcomData;
  onToggleCollapse?: (nodeId: string) => void;
  isCollapsed?: boolean;
  childCount?: number;
  highlightedPersonId?: string | null;
  onDataChanged?: () => void;
}

const CARD_W = 90;
const CARD_H = 50;
const COUPLE_GAP = 8;

export const NODE_WIDTH = CARD_W * 2 + COUPLE_GAP;
export const NODE_HEIGHT = CARD_H;

/** Resolve GEDCOM child IDs of a family to their backend API UUIDs. */
function getChildApiIds(data: GedcomData, family: { childIds: string[] }): string[] {
  return family.childIds
    .map((cid) => data.individuals.get(cid)?.apiId)
    .filter((id): id is string => !!id);
}

/** Count how many parents a person has (0, 1, or 2). */
function countParents(data: GedcomData, individual: Individual): number {
  const famId = individual.familyAsChild;
  if (!famId) return 0;
  const family = data.families.get(famId);
  if (!family) return 0;
  let count = 0;
  if (family.husbandId) count++;
  if (family.wifeId) count++;
  return count;
}

/** Check if a person has children (is husband/wife in a family with children). */
function hasChildren(data: GedcomData, individual: Individual): boolean {
  for (const famId of individual.familiesAsSpouse) {
    const family = data.families.get(famId);
    if (family && family.childIds.length > 0) return true;
  }
  return false;
}

/** Get the API ID of the family where this person is a child (if any). */
function getParentFamilyApiId(data: GedcomData, individual: Individual): string | undefined {
  const famId = individual.familyAsChild;
  if (!famId) return undefined;
  const family = data.families.get(famId);
  return family?.apiId;
}

export default function TreeNodeView({
  posNode,
  data,
  onToggleCollapse,
  isCollapsed,
  childCount,
  highlightedPersonId,
  onDataChanged,
}: Props) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const { editMode } = useEditMode();
  const { node, x, y } = posNode;

  const startX = x - NODE_WIDTH / 2;
  const startY = y;

  // ── Multi-couple node ───────────────────────────────────────────
  if (node.type === "multi-couple" && node.commonPerson && node.unions) {
    const unions = node.unions;
    const totalW = multiCoupleWidth(unions.length);
    const mStartX = x - totalW / 2;
    const commonHighlighted = highlightedPersonId === node.commonPerson.id;
    const commonX = mStartX + CARD_W + COUPLE_GAP;

    return (
      <g
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* First spouse (left of common person) */}
        {unions[0]?.spouse && (
          <>
            {highlightedPersonId === unions[0].spouse.id && (
              <rect x={mStartX - 3} y={startY - 3} width={CARD_W + 6} height={CARD_H + 6}
                rx={8} ry={8} fill="none" stroke="#f59e0b" strokeWidth={3} />
            )}
            <PersonCard
              individual={unions[0].spouse} x={mStartX} y={startY}
              width={CARD_W} height={CARD_H}
              photoUrl={unions[0].spouse.photoUrl}
              isDeletable={!hasChildren(data, unions[0].spouse)}
              onDataChanged={onDataChanged}
            />
            <line x1={mStartX + CARD_W} y1={startY + CARD_H / 2}
              x2={commonX} y2={startY + CARD_H / 2} stroke="#a8a29e" strokeWidth={1.5} />
          </>
        )}

        {/* Common person card (center) */}
        {commonHighlighted && (
          <rect x={commonX - 3} y={startY - 3} width={CARD_W + 6} height={CARD_H + 6}
            rx={8} ry={8} fill="none" stroke="#f59e0b" strokeWidth={3} />
        )}
        <PersonCard
          individual={node.commonPerson} x={commonX} y={startY}
          width={CARD_W} height={CARD_H}
          photoUrl={node.commonPerson.photoUrl}
          isDeletable={!hasChildren(data, node.commonPerson)}
          onDataChanged={onDataChanged}
        />

        {/* Additional spouses (right of common person) */}
        {unions.slice(1).map((union: Union, idx: number) => {
          const spouseX = commonX + CARD_W + COUPLE_GAP + idx * (CARD_W + COUPLE_GAP);
          const spouseHighlighted = highlightedPersonId && union.spouse?.id === highlightedPersonId;
          return (
            <g key={union.family.id}>
              <line x1={commonX + CARD_W} y1={startY + CARD_H / 2}
                x2={spouseX} y2={startY + CARD_H / 2} stroke="#a8a29e" strokeWidth={1.5} />
              {union.spouse && (
                <>
                  {spouseHighlighted && (
                    <rect x={spouseX - 3} y={startY - 3} width={CARD_W + 6} height={CARD_H + 6}
                      rx={8} ry={8} fill="none" stroke="#f59e0b" strokeWidth={3} />
                  )}
                  <PersonCard
                    individual={union.spouse} x={spouseX} y={startY}
                    width={CARD_W} height={CARD_H}
                    photoUrl={union.spouse.photoUrl}
                    isDeletable={!hasChildren(data, union.spouse)}
                    onDataChanged={onDataChanged}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* Edit mode: Add child buttons — one per union */}
        {editMode && unions.map((union: Union, idx: number) => {
          const spX = idx === 0
            ? mStartX + CARD_W / 2
            : commonX + CARD_W + COUPLE_GAP + (idx - 1) * (CARD_W + COUPLE_GAP) + CARD_W / 2;
          const midX = (commonX + CARD_W / 2 + spX) / 2;
          const childApiIds = union.family.childIds
            .map((cid) => data.individuals.get(cid)?.apiId)
            .filter((id): id is string => !!id);
          return (
            <AddPersonButton
              key={`child-${union.family.id}`}
              type="child" x={midX} y={startY + CARD_H + 28}
              linkedIndividualApiId={node.commonPerson?.apiId || ""}
              linkedIndividualSex={node.commonPerson?.sex}
              familyApiId={union.family.apiId || ""}
              existingChildApiIds={childApiIds}
              onCreated={() => onDataChanged?.()}
            />
          );
        })}

        {/* Edit mode: Add another spouse (rightmost side) */}
        {editMode && (
          <AddPersonButton
            type="alliance" x={mStartX + totalW + 14} y={startY + CARD_H / 2}
            linkedIndividualApiId={node.commonPerson.apiId || ""}
            linkedIndividualSex={node.commonPerson.sex}
            tooltipKey="tooltip.addAnotherSpouse"
            onCreated={() => onDataChanged?.()}
          />
        )}

        {/* Collapse/expand toggle */}
        {childCount !== undefined && childCount > 0 && (() => {
          const isAncestor = node.id.startsWith("anc-");
          const toggleY = isAncestor ? startY - 12 : startY + CARD_H + 12;
          return (
            <g onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(node.id); }}
              style={{ cursor: "pointer" }}>
              <title>{isCollapsed ? t("tooltip.expand", { count: childCount }) : t("tooltip.collapse")}</title>
              <circle cx={x} cy={toggleY} r={9}
                fill={hovered ? "#e7e5e4" : "white"} stroke="#a8a29e" strokeWidth={1} />
              <text x={x} y={toggleY} textAnchor="middle" dominantBaseline="central"
                fontSize={10} fill="#57534e" fontFamily="system-ui, sans-serif" fontWeight={700}>
                {isCollapsed ? `+${childCount}` : "−"}
              </text>
            </g>
          );
        })()}
      </g>
    );
  }

  // ── Couple node ────────────────────────────────────────────────
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
                x={startX - 3} y={startY - 3}
                width={CARD_W + 6} height={CARD_H + 6}
                rx={8} ry={8} fill="none" stroke="#f59e0b" strokeWidth={3}
              />
            )}
            <PersonCard
              individual={node.husband} x={startX} y={startY}
              width={CARD_W} height={CARD_H}
              photoUrl={node.husband.photoUrl}
              isDeletable={!hasChildren(data, node.husband)}
              onDataChanged={onDataChanged}
            />
          </>
        )}
        {/* Wife card (right) */}
        {node.wife && (
          <>
            {wifeHighlighted && (
              <rect
                x={startX + CARD_W + COUPLE_GAP - 3} y={startY - 3}
                width={CARD_W + 6} height={CARD_H + 6}
                rx={8} ry={8} fill="none" stroke="#f59e0b" strokeWidth={3}
              />
            )}
            <PersonCard
              individual={node.wife}
              x={startX + CARD_W + COUPLE_GAP} y={startY}
              width={CARD_W} height={CARD_H}
              photoUrl={node.wife.photoUrl}
              isDeletable={!hasChildren(data, node.wife)}
              onDataChanged={onDataChanged}
            />
          </>
        )}
        {/* Marriage connector line */}
        {node.husband && node.wife && (
          <line
            x1={startX + CARD_W} y1={startY + CARD_H / 2}
            x2={startX + CARD_W + COUPLE_GAP} y2={startY + CARD_H / 2}
            stroke="#a8a29e" strokeWidth={1.5}
          />
        )}

        {/* Edit mode: Add parent buttons (above cards) */}
        {editMode && node.husband && countParents(data, node.husband) < 2 && (
          <AddPersonButton
            type="parent" x={startX + CARD_W / 2} y={startY - 14}
            linkedIndividualApiId={node.husband.apiId || ""}
            linkedIndividualSex={node.husband.sex}
            familyApiId={getParentFamilyApiId(data, node.husband)}
            onCreated={() => onDataChanged?.()}
          />
        )}
        {editMode && node.wife && countParents(data, node.wife) < 2 && (
          <AddPersonButton
            type="parent" x={startX + CARD_W + COUPLE_GAP + CARD_W / 2} y={startY - 14}
            linkedIndividualApiId={node.wife.apiId || ""}
            linkedIndividualSex={node.wife.sex}
            familyApiId={getParentFamilyApiId(data, node.wife)}
            onCreated={() => onDataChanged?.()}
          />
        )}

        {/* Edit mode: Add alliance buttons */}
        {editMode && node.husband && !node.wife && (
          <AddPersonButton
            type="alliance" x={startX + CARD_W + COUPLE_GAP + CARD_W / 2} y={startY + CARD_H / 2}
            linkedIndividualApiId={node.husband.apiId || ""}
            linkedIndividualSex={node.husband.sex}
            onCreated={() => onDataChanged?.()}
          />
        )}
        {editMode && node.wife && !node.husband && (
          <AddPersonButton
            type="alliance" x={startX + CARD_W / 2} y={startY + CARD_H / 2}
            linkedIndividualApiId={node.wife.apiId || ""}
            linkedIndividualSex={node.wife.sex}
            onCreated={() => onDataChanged?.()}
          />
        )}
        {editMode && node.husband && node.wife && (
          <>
            <AddPersonButton
              type="alliance" x={startX - 14} y={startY + CARD_H / 2}
              linkedIndividualApiId={node.husband.apiId || ""}
              linkedIndividualSex={node.husband.sex}
              tooltipKey="tooltip.addAnotherSpouse"
              onCreated={() => onDataChanged?.()}
            />
            <AddPersonButton
              type="alliance" x={startX + NODE_WIDTH + 14} y={startY + CARD_H / 2}
              linkedIndividualApiId={node.wife.apiId || ""}
              linkedIndividualSex={node.wife.sex}
              tooltipKey="tooltip.addAnotherSpouse"
              onCreated={() => onDataChanged?.()}
            />
          </>
        )}

        {/* Edit mode: Add child button (bottom) */}
        {editMode && (
          <AddPersonButton
            type="child" x={x} y={startY + CARD_H + 28}
            linkedIndividualApiId={node.husband?.apiId || node.wife?.apiId || ""}
            linkedIndividualSex={node.husband?.sex || node.wife?.sex}
            familyApiId={node.family?.apiId || ""}
            existingChildApiIds={node.family ? getChildApiIds(data, node.family) : []}
            dataOnboarding="add-button"
            onCreated={() => onDataChanged?.()}
          />
        )}

        {/* Collapse/expand toggle — above for ancestors, below for descendants */}
        {childCount !== undefined && childCount > 0 && (() => {
          const isAncestor = node.id.startsWith("anc-");
          const toggleY = isAncestor ? startY - 12 : startY + CARD_H + 12;
          return (
            <g
              onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(node.id); }}
              style={{ cursor: "pointer" }}
            >
              <title>{isCollapsed ? t("tooltip.expand", { count: childCount }) : t("tooltip.collapse")}</title>
              <circle
                cx={x} cy={toggleY} r={9}
                fill={hovered ? "#e7e5e4" : "white"} stroke="#a8a29e" strokeWidth={1}
              />
              <text
                x={x} y={toggleY}
                textAnchor="middle" dominantBaseline="central"
                fontSize={10} fill="#57534e" fontFamily="system-ui, sans-serif" fontWeight={700}
              >
                {isCollapsed ? `+${childCount}` : "−"}
              </text>
            </g>
          );
        })()}
      </g>
    );
  }

  // ── Single individual node ─────────────────────────────────────
  const individualHighlighted =
    highlightedPersonId && node.individual?.id === highlightedPersonId;

  return (
    <g>
      {individualHighlighted && (
        <rect
          x={x - CARD_W / 2 - 3} y={startY - 3}
          width={CARD_W + 6} height={CARD_H + 6}
          rx={8} ry={8} fill="none" stroke="#f59e0b" strokeWidth={3}
        />
      )}
      <PersonCard
        individual={node.individual!}
        x={x - CARD_W / 2} y={startY}
        width={CARD_W} height={CARD_H}
        photoUrl={node.individual!.photoUrl}
        isDeletable={!hasChildren(data, node.individual!)}
        onDataChanged={onDataChanged}
      />

      {/* Edit mode: Add parent button */}
      {editMode && node.individual && countParents(data, node.individual) < 2 && (
        <AddPersonButton
          type="parent" x={x} y={startY - 14}
          linkedIndividualApiId={node.individual.apiId || ""}
          linkedIndividualSex={node.individual.sex}
          familyApiId={getParentFamilyApiId(data, node.individual)}
          onCreated={() => onDataChanged?.()}
        />
      )}

      {/* Edit mode: Add alliance button */}
      {editMode && node.individual && (
        <AddPersonButton
          type="alliance" x={x + CARD_W / 2 + 14} y={startY + CARD_H / 2}
          linkedIndividualApiId={node.individual.apiId || ""}
          linkedIndividualSex={node.individual.sex}
          onCreated={() => onDataChanged?.()}
        />
      )}
    </g>
  );
}
