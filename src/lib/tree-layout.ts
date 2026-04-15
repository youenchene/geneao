/**
 * Tree layout engine using relatives-tree.
 * Converts GEDCOM family data into positioned nodes for SVG rendering.
 * Supports ancestors, descendants, multiple spouses, and siblings.
 */
import calcTree from "relatives-tree";
import type { Node as RTNode, Relation, RelType, Gender } from "relatives-tree/lib/types";
import type { GedcomData, Individual } from "./gedcom-parser";
import { findRootFamily, formatLifespan } from "./gedcom-parser";

export interface TreeNode {
  id: string;
  type: "individual";
  individual: Individual;
  label: string;
  sublabel: string;
}

export interface PositionedNode {
  node: TreeNode;
  x: number;
  y: number;
  /** Whether this node has a subtree that can be collapsed. */
  hasSubTree: boolean;
}

export interface PositionedEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

/** Card dimensions used by the renderer. */
const CARD_W = 90;
const CARD_H = 50;

/**
 * Convert GedcomData individuals + families into the flat Node[]
 * format that relatives-tree expects.
 */
function toRelativesNodes(data: GedcomData): RTNode[] {
  const nodes: RTNode[] = [];

  for (const [id, indi] of data.individuals) {
    const BLOOD = "blood" as RelType;
    const MARRIED = "married" as RelType;

    const parents: Relation[] = [];
    const children: Relation[] = [];
    const spouses: Relation[] = [];
    const siblings: Relation[] = [];

    // Parents: from familyAsChild
    if (indi.familyAsChild) {
      const parentFam = data.families.get(indi.familyAsChild);
      if (parentFam) {
        if (parentFam.husbandId && data.individuals.has(parentFam.husbandId)) {
          parents.push({ id: parentFam.husbandId, type: BLOOD });
        }
        if (parentFam.wifeId && data.individuals.has(parentFam.wifeId)) {
          parents.push({ id: parentFam.wifeId, type: BLOOD });
        }
      }
    }

    // Children + spouses: from familiesAsSpouse
    const spouseIds = new Set<string>();
    for (const famId of indi.familiesAsSpouse) {
      const fam = data.families.get(famId);
      if (!fam) continue;

      // The other spouse in this family
      const otherId = fam.husbandId === id ? fam.wifeId : fam.husbandId;
      if (otherId && data.individuals.has(otherId) && !spouseIds.has(otherId)) {
        spouseIds.add(otherId);
        spouses.push({ id: otherId, type: MARRIED });
      }

      // Children of this family
      for (const childId of fam.childIds) {
        if (data.individuals.has(childId)) {
          children.push({ id: childId, type: BLOOD });
        }
      }
    }

    // Siblings: other children in the same parent family
    if (indi.familyAsChild) {
      const parentFam = data.families.get(indi.familyAsChild);
      if (parentFam) {
        for (const sibId of parentFam.childIds) {
          if (sibId !== id && data.individuals.has(sibId)) {
            siblings.push({ id: sibId, type: BLOOD });
          }
        }
      }
    }

    const gender = (indi.sex === "F" ? "female" : "male") as Gender;

    nodes.push({
      id,
      gender,
      parents,
      children,
      spouses,
      siblings,
    } as RTNode);
  }

  return nodes;
}

/**
 * Find the best root individual for the tree.
 * Uses the existing findRootFamily, then picks the husband (or wife)
 * of that family as the root person.
 */
function findRootPerson(data: GedcomData): string | null {
  const rootFamId = findRootFamily(data);
  if (!rootFamId) {
    // Fallback: first individual
    const first = data.individuals.keys().next();
    return first.done ? null : first.value;
  }

  const rootFam = data.families.get(rootFamId);
  if (!rootFam) return null;

  // Prefer husband, then wife, then first child
  if (rootFam.husbandId && data.individuals.has(rootFam.husbandId)) {
    return rootFam.husbandId;
  }
  if (rootFam.wifeId && data.individuals.has(rootFam.wifeId)) {
    return rootFam.wifeId;
  }
  if (rootFam.childIds.length > 0) {
    return rootFam.childIds[0];
  }
  return null;
}

/**
 * Compute a positioned tree layout using relatives-tree.
 */
export function computeTreeLayout(data: GedcomData): TreeLayout {
  if (data.individuals.size === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const rootId = findRootPerson(data);
  if (!rootId) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const rtNodes = toRelativesNodes(data);

  // relatives-tree computes layout in unit coordinates.
  // Each node occupies 1×1 unit; we scale to our card dimensions.
  const result = calcTree(rtNodes, { rootId });

  const scaleX = CARD_W + 16; // card width + horizontal gap
  const scaleY = CARD_H + 70; // card height + vertical gap for edges
  const padding = 40;

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  // Map ExtNode positions to our PositionedNode format
  for (const extNode of result.nodes) {
    const indi = data.individuals.get(extNode.id);
    if (!indi) continue;

    const treeNode: TreeNode = {
      id: extNode.id,
      type: "individual",
      individual: indi,
      label: indi.displayName || indi.givenName || "?",
      sublabel: formatLifespan(indi),
    };

    nodes.push({
      node: treeNode,
      x: extNode.left * scaleX + padding,
      y: extNode.top * scaleY + padding,
      hasSubTree: extNode.hasSubTree,
    });
  }

  // Map connectors to our PositionedEdge format
  for (const conn of result.connectors) {
    edges.push({
      x1: conn[0] * scaleX + padding,
      y1: conn[1] * scaleY + padding,
      x2: conn[2] * scaleX + padding,
      y2: conn[3] * scaleY + padding,
    });
  }

  // Compute canvas size
  const width = result.canvas.width * scaleX + padding * 2;
  const height = result.canvas.height * scaleY + padding * 2;

  return { nodes, edges, width, height };
}
