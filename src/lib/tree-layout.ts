/**
 * Custom tree layout engine using d3-hierarchy.
 * Converts GEDCOM family data into a positioned tree for SVG rendering.
 */
import { hierarchy, tree } from "d3-hierarchy";
import type { GedcomData, Individual, Family } from "./gedcom-parser";
import { findRootFamily, formatLifespan } from "./gedcom-parser";

export interface TreeNode {
  id: string;
  type: "couple" | "individual";
  // For couple nodes
  husband?: Individual;
  wife?: Individual;
  family?: Family;
  // For individual nodes (no spouse)
  individual?: Individual;
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
 * Build a hierarchical tree structure from GEDCOM data.
 * Each node is either a couple (husband+wife) or a single individual.
 * Children are the family units formed by the couple's children.
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

  const childNodes: TreeNode[] = [];

  for (const childId of family.childIds) {
    const child = data.individuals.get(childId);
    if (!child) continue;

    if (child.familiesAsSpouse.length > 0) {
      // This child formed their own family/families
      for (const spouseFamId of child.familiesAsSpouse) {
        const childFamilyNode = buildTreeNode(data, spouseFamId, visited);
        if (childFamilyNode) {
          childNodes.push(childFamilyNode);
        }
      }
    } else {
      // This child has no spouse — show as a leaf individual
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
      return a.parent === b.parent ? 1.2 : 1.5;
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
    edges.push({
      parentX: link.source.x ?? 0,
      parentY: link.source.y ?? 0,
      childX: link.target.x ?? 0,
      childY: link.target.y ?? 0,
    });
  });

  // Compute bounds
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - NODE_WIDTH / 2);
    maxX = Math.max(maxX, n.x + NODE_WIDTH / 2);
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
