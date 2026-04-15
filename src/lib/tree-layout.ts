/**
 * Custom tree layout engine using d3-hierarchy.
 * Converts GEDCOM family data into a positioned tree for SVG rendering.
 */
import { hierarchy, tree } from "d3-hierarchy";
import type { GedcomData, Individual, Family } from "./gedcom-parser";
import { findRootFamily, formatLifespan } from "./gedcom-parser";

/** A single union within a multi-couple node. */
export interface Union {
  spouse?: Individual;
  family: Family;
  childNodes: TreeNode[];
}

export interface TreeNode {
  id: string;
  type: "couple" | "individual" | "multi-couple";
  // For couple nodes
  husband?: Individual;
  wife?: Individual;
  family?: Family;
  // For individual nodes (no spouse)
  individual?: Individual;
  // For multi-couple nodes: the common person + their unions
  commonPerson?: Individual;
  unions?: Union[];
  // Display
  label: string;
  sublabel: string;
  // Children (family units of this couple's children)
  childNodes: TreeNode[];
}

export interface PositionedNode {
  node: TreeNode;
  x: number;
  y: number;
}

export interface PositionedEdge {
  parentX: number;
  parentY: number;
  /** X anchor for the edge start — offset for multi-couple union edges. */
  parentAnchorX: number;
  childX: number;
  childY: number;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

/**
 * Build the child nodes for a single family.
 * Returns an array of TreeNode children (couple, multi-couple, or individual).
 */
function buildChildNodes(
  data: GedcomData,
  family: Family,
  visited: Set<string>
): TreeNode[] {
  const childNodes: TreeNode[] = [];

  for (const childId of family.childIds) {
    const child = data.individuals.get(childId);
    if (!child) continue;

    // Filter to families not yet visited
    const availableFamilies = child.familiesAsSpouse.filter(
      (fid) => !visited.has(fid)
    );

    if (availableFamilies.length > 1) {
      // Multiple families → build a multi-couple node
      const multiNode = buildMultiCoupleNode(data, child, availableFamilies, visited);
      if (multiNode) childNodes.push(multiNode);
    } else if (availableFamilies.length === 1) {
      // Single family → standard couple node
      const coupleNode = buildTreeNode(data, availableFamilies[0], visited);
      if (coupleNode) childNodes.push(coupleNode);
    } else {
      // No (unvisited) families → leaf individual
      childNodes.push({
        id: child.id,
        type: "individual",
        individual: child,
        label: child.displayName || child.givenName || "?",
        sublabel: formatLifespan(child),
        childNodes: [],
      });
    }
  }

  return childNodes;
}

/**
 * Build a multi-couple node: one common person with multiple unions.
 * Each union has a spouse, a family, and its own children subtree.
 */
function buildMultiCoupleNode(
  data: GedcomData,
  commonPerson: Individual,
  familyIds: string[],
  visited: Set<string>
): TreeNode | null {
  const unions: Union[] = [];
  const allChildNodes: TreeNode[] = [];

  for (const famId of familyIds) {
    if (visited.has(famId)) continue;
    visited.add(famId);

    const family = data.families.get(famId);
    if (!family) continue;

    // The spouse is the other person in this family
    const spouseId =
      family.husbandId === commonPerson.id ? family.wifeId : family.husbandId;
    const spouse = spouseId ? data.individuals.get(spouseId) : undefined;

    const familyChildNodes = buildChildNodes(data, family, visited);

    unions.push({ spouse, family, childNodes: familyChildNodes });
    allChildNodes.push(...familyChildNodes);
  }

  if (unions.length === 0) return null;

  const label = commonPerson.displayName || commonPerson.givenName || "?";

  return {
    id: `multi-${commonPerson.id}`,
    type: "multi-couple",
    commonPerson,
    unions,
    label,
    sublabel: formatLifespan(commonPerson),
    childNodes: allChildNodes,
  };
}

/**
 * Build a hierarchical tree structure from GEDCOM data.
 * Each node is either a couple (husband+wife), a multi-couple
 * (one person with multiple spouses), or a single individual.
 */
function buildTreeNode(
  data: GedcomData,
  familyId: string,
  visited: Set<string>
): TreeNode | null {
  if (visited.has(familyId)) return null;
  visited.add(familyId);

  const family = data.families.get(familyId);
  if (!family) return null;

  const husband = family.husbandId
    ? data.individuals.get(family.husbandId)
    : undefined;
  const wife = family.wifeId
    ? data.individuals.get(family.wifeId)
    : undefined;

  const childNodes = buildChildNodes(data, family, visited);

  const label = [
    husband?.displayName || husband?.givenName,
    wife?.displayName || wife?.givenName,
  ]
    .filter(Boolean)
    .join(" & ");

  const sublabel = family.marriageDate
    ? `m. ${family.marriageDate}`
    : "";

  return {
    id: familyId,
    type: "couple",
    husband,
    wife,
    family,
    label,
    sublabel,
    childNodes,
  };
}

/** Card dimensions — must match TreeNodeView constants. */
const CARD_W = 90;
const COUPLE_GAP = 8;

/** How many "standard couple widths" a node occupies. */
function nodeWidthMultiplier(node: TreeNode): number {
  if (node.type === "multi-couple" && node.unions) {
    return Math.max(1, node.unions.length);
  }
  return 1;
}

/**
 * For a multi-couple node at center X, compute the edge anchor X
 * for a given union index (the midpoint between common person and that spouse).
 */
function unionAnchorX(nodeX: number, unionCount: number, unionIdx: number): number {
  const totalW = CARD_W * (unionCount + 1) + COUPLE_GAP * unionCount;
  const mStartX = nodeX - totalW / 2;
  // Common person card starts at mStartX + CARD_W + COUPLE_GAP
  const commonCenterX = mStartX + CARD_W + COUPLE_GAP + CARD_W / 2;

  if (unionIdx === 0) {
    // First spouse is to the left
    const spouseCenterX = mStartX + CARD_W / 2;
    return (commonCenterX + spouseCenterX) / 2;
  }
  // Additional spouses are to the right
  const spouseX = mStartX + CARD_W + COUPLE_GAP + CARD_W + COUPLE_GAP + (unionIdx - 1) * (CARD_W + COUPLE_GAP);
  const spouseCenterX = spouseX + CARD_W / 2;
  return (commonCenterX + spouseCenterX) / 2;
}

/**
 * Build a map from child node ID → union index for a multi-couple node.
 */
function buildChildToUnionMap(node: TreeNode): Map<string, number> {
  const map = new Map<string, number>();
  if (node.type === "multi-couple" && node.unions) {
    for (let i = 0; i < node.unions.length; i++) {
      for (const child of node.unions[i].childNodes) {
        map.set(child.id, i);
      }
    }
  }
  return map;
}

/**
 * Compute a positioned tree layout using d3-hierarchy.
 */
export function computeTreeLayout(data: GedcomData): TreeLayout {
  const rootFamilyId = findRootFamily(data);
  if (!rootFamilyId) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const rootNode = buildTreeNode(data, rootFamilyId, new Set());
  if (!rootNode) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Create d3 hierarchy
  const root = hierarchy<TreeNode>(rootNode, (d) => d.childNodes);

  // Configure the tree layout
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;
  const treeLayout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH, NODE_HEIGHT])
    .separation((a, b) => {
      const aWidth = nodeWidthMultiplier(a.data);
      const bWidth = nodeWidthMultiplier(b.data);
      const base = a.parent === b.parent ? 1.2 : 1.5;
      return base * Math.max(1, (aWidth + bWidth) / 2);
    });

  treeLayout(root);

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  root.each((d) => {
    nodes.push({
      node: d.data,
      x: d.x ?? 0,
      y: d.y ?? 0,
    });
  });

  root.links().forEach((link) => {
    const parentNode = link.source.data;
    const childNode = link.target.data;
    const px = link.source.x ?? 0;
    const py = link.source.y ?? 0;

    // Compute the anchor X: for multi-couple parents, offset to the union's midpoint
    let anchorX = px;
    if (parentNode.type === "multi-couple" && parentNode.unions) {
      const childUnionMap = buildChildToUnionMap(parentNode);
      const unionIdx = childUnionMap.get(childNode.id);
      if (unionIdx !== undefined) {
        anchorX = unionAnchorX(px, parentNode.unions.length, unionIdx);
      }
    }

    edges.push({
      parentX: px,
      parentY: py,
      parentAnchorX: anchorX,
      childX: link.target.x ?? 0,
      childY: link.target.y ?? 0,
    });
  });

  // Compute bounds — account for wider multi-couple nodes
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    const halfW = (NODE_WIDTH * nodeWidthMultiplier(n.node)) / 2;
    minX = Math.min(minX, n.x - halfW);
    maxX = Math.max(maxX, n.x + halfW);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + NODE_HEIGHT);
  }

  // Shift all coordinates so the tree starts at (padding, padding)
  const padding = 40;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  for (const n of nodes) {
    n.x += offsetX;
    n.y += offsetY;
  }
  for (const e of edges) {
    e.parentX += offsetX;
    e.parentY += offsetY;
    e.parentAnchorX += offsetX;
    e.childX += offsetX;
    e.childY += offsetY;
  }

  return {
    nodes,
    edges,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}
