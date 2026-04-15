/**
 * Renders a single person node in the tree.
 * Supports highlighting, edit mode with add alliance/child/parent buttons.
 */
import type { GedcomData, Individual } from "../lib/gedcom-parser";
import type { PositionedNode } from "../lib/tree-layout";
import { useEditMode } from "../context/EditModeContext";
import PersonCard from "./PersonCard";
import AddPersonButton from "./AddPersonButton";

interface Props {
  posNode: PositionedNode;
  data: GedcomData;
  highlightedPersonId?: string | null;
  onDataChanged?: () => void;
}

const CARD_W = 90;
const CARD_H = 50;

export const NODE_WIDTH = CARD_W;
export const NODE_HEIGHT = CARD_H;

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
  highlightedPersonId,
  onDataChanged,
}: Props) {
  const { editMode } = useEditMode();
  const { node, x, y } = posNode;
  const indi = node.individual;

  const isHighlighted = highlightedPersonId === indi.id;

  return (
    <g>
      {/* Highlight ring */}
      {isHighlighted && (
        <rect
          x={x - 3}
          y={y - 3}
          width={CARD_W + 6}
          height={CARD_H + 6}
          rx={8}
          ry={8}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={3}
        />
      )}

      {/* Person card */}
      <PersonCard
        individual={indi}
        x={x}
        y={y}
        width={CARD_W}
        height={CARD_H}
        photoUrl={indi.photoUrl}
        onDataChanged={onDataChanged}
      />

      {/* Edit mode: Add parent button (above card, if < 2 parents) */}
      {editMode && countParents(data, indi) < 2 && (
        <AddPersonButton
          type="parent"
          x={x + CARD_W / 2}
          y={y - 14}
          linkedIndividualApiId={indi.apiId || ""}
          linkedIndividualSex={indi.sex}
          familyApiId={getParentFamilyApiId(data, indi)}
          onCreated={() => onDataChanged?.()}
        />
      )}

      {/* Edit mode: Add spouse button (right side) */}
      {editMode && (
        <AddPersonButton
          type="alliance"
          x={x + CARD_W + 14}
          y={y + CARD_H / 2}
          linkedIndividualApiId={indi.apiId || ""}
          linkedIndividualSex={indi.sex}
          tooltipKey={indi.familiesAsSpouse.length > 0 ? "tooltip.addAnotherSpouse" : undefined}
          onCreated={() => onDataChanged?.()}
        />
      )}

      {/* Edit mode: Add child button (below card) — only if person has a spouse family */}
      {editMode && indi.familiesAsSpouse.length > 0 && (() => {
        // Pick the first spouse family for the add-child button
        const famId = indi.familiesAsSpouse[0];
        const fam = data.families.get(famId);
        if (!fam) return null;
        const childApiIds = fam.childIds
          .map((cid) => data.individuals.get(cid)?.apiId)
          .filter((id): id is string => !!id);
        return (
          <AddPersonButton
            type="child"
            x={x + CARD_W / 2}
            y={y + CARD_H + 28}
            linkedIndividualApiId={indi.apiId || ""}
            linkedIndividualSex={indi.sex}
            familyApiId={fam.apiId || ""}
            existingChildApiIds={childApiIds}
            onCreated={() => onDataChanged?.()}
          />
        );
      })()}
    </g>
  );
}
