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
 * Node dimensions including gap, used for scaling.
 * relatives-tree outputs in half-node units, so we multiply
 * coordinates by (NODE_W / 2) and (NODE_H / 2).
 * NODE_W/NODE_H must be larger than CARD_W/CARD_H to leave gaps.
 */
const NODE_W = CARD_W + 30;  // 120px per node slot horizontally
const NODE_H = CARD_H + 80;  // 130px per node slot vertically (room for connectors)

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
 * Uses the existing findRootFamily, then picks the first child of that
 * family (so both parent branches fan out above). Falls back to a parent.
 */
function findRootPerson(data: GedcomData): string | null {
  const rootFamId = findRootFamily(data);
  if (!rootFamId) {
    const first = data.individuals.keys().next();
    return first.done ? null : first.value;
  }

  const rootFam = data.families.get(rootFamId);
  if (!rootFam) return null;

  // Prefer a child who themselves formed families (most connected)
  for (const childId of rootFam.childIds) {
    const child = data.individuals.get(childId);
    if (child && child.familiesAsSpouse.length > 0) {
      return childId;
    }
  }

  // Fallback: first child, then husband, then wife
  if (rootFam.childIds.length > 0 && data.individuals.has(rootFam.childIds[0])) {
    return rootFam.childIds[0];
  }
  if (rootFam.husbandId && data.individuals.has(rootFam.husbandId)) {
    return rootFam.husbandId;
  }
  if (rootFam.wifeId && data.individuals.has(rootFam.wifeId)) {
    return rootFam.wifeId;
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

  // relatives-tree computes layout in half-node units.
  // Multiply by (NODE_SIZE / 2) to get pixel positions (per official example).
  const result = calcTree(rtNodes, { rootId });

  const halfW = NODE_W / 2;
  const halfH = NODE_H / 2;
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
      x: extNode.left * halfW + padding,
      y: extNode.top * halfH + padding,
      hasSubTree: extNode.hasSubTree,
    });
  }

  // Map connectors to our PositionedEdge format
  for (const conn of result.connectors) {
    edges.push({
      x1: conn[0] * halfW + padding,
      y1: conn[1] * halfH + padding,
      x2: conn[2] * halfW + padding,
      y2: conn[3] * halfH + padding,
    });
  }

  // Compute canvas size
  const width = result.canvas.width * halfW + padding * 2;
  const height = result.canvas.height * halfH + padding * 2;

  return { nodes, edges, width, height };
}
