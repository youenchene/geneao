/**
 * Dual-tree layout engine using d3-hierarchy.
 * Builds an "hourglass" layout: ancestors fan out upward, descendants
 * fan out downward, centered on a focal couple identified automatically.
 *
 * Spouse ancestors (parents of people who married into the tree) are
 * also shown as inverted mini-trees above the spouse.
 */
import { hierarchy, tree } from "d3-hierarchy";
import type { GedcomData, Individual, Family } from "./gedcom-parser";
import { formatLifespan } from "./gedcom-parser";

// ── Public types ─────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  type: "couple" | "individual";
  husband?: Individual;
  wife?: Individual;
  family?: Family;
  individual?: Individual;
  label: string;
  sublabel: string;
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
  focalY: number;
}

// ── Constants ────────────────────────────────────────────────────

const CARD_W = 90;
const CARD_H = 50;
const COUPLE_GAP = 8;
const NODE_WIDTH = CARD_W * 2 + COUPLE_GAP;  // 188
const NODE_HEIGHT_STEP = 120; // vertical distance between generations

// ── Focal couple identification ──────────────────────────────────

/**
 * Count ancestors reachable from an individual (walking up through
 * familyAsChild → parents → their familyAsChild, etc.)
 */
function countAncestors(
  data: GedcomData,
  individualId: string | null,
  visited: Set<string>
): number {
  if (!individualId || visited.has(individualId)) return 0;
  visited.add(individualId);

  const indi = data.individuals.get(individualId);
  if (!indi || !indi.familyAsChild) return 0;

  const parentFam = data.families.get(indi.familyAsChild);
  if (!parentFam) return 0;

  let count = 0;
  if (parentFam.husbandId) count++;
  if (parentFam.wifeId) count++;

  count += countAncestors(data, parentFam.husbandId, visited);
  count += countAncestors(data, parentFam.wifeId, visited);

  return count;
}

/**
 * Count descendants reachable from a family (walking down through
 * children → their familiesAsSpouse → their children, etc.)
 */
function countDescendants(
  data: GedcomData,
  familyId: string,
  visited: Set<string>
): number {
  if (visited.has(familyId)) return 0;
  visited.add(familyId);

  const family = data.families.get(familyId);
  if (!family) return 0;

  let count = family.childIds.length;
  for (const childId of family.childIds) {
    const child = data.individuals.get(childId);
    if (child) {
      for (const spouseFamId of child.familiesAsSpouse) {
        count += countDescendants(data, spouseFamId, visited);
      }
    }
  }
  return count;
}

/**
 * Find the focal couple: the family that maximizes
 * descendants + ancestors of both spouses.
 */
function findFocalFamily(data: GedcomData): string | null {
  let bestId: string | null = null;
  let bestScore = -1;

  for (const [famId, fam] of data.families) {
    const descCount = countDescendants(data, famId, new Set());
    const ancHusband = countAncestors(data, fam.husbandId, new Set());
    const ancWife = countAncestors(data, fam.wifeId, new Set());
    const score = descCount + ancHusband + ancWife;

    if (score > bestScore) {
      bestScore = score;
      bestId = famId;
    }
  }

  return bestId;
}

// ── Descendant tree (top-down) ───────────────────────────────────

/**
 * Build a top-down tree from a family: couple node with children
 * that are themselves couple nodes (or leaf individuals).
 */
function buildDescendantTree(
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

    const availableFamilies = child.familiesAsSpouse.filter(
      (fid) => !visited.has(fid)
    );

    if (availableFamilies.length > 0) {
      for (const spouseFamId of availableFamilies) {
        const childFamilyNode = buildDescendantTree(data, spouseFamId, visited);
        if (childFamilyNode) childNodes.push(childFamilyNode);
      }
    } else {
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

  return {
    id: familyId,
    type: "couple",
    husband,
    wife,
    family,
    label,
    sublabel: family.marriageDate ? `m. ${family.marriageDate}` : "",
    childNodes,
  };
}

// ── Ancestor tree (inverted) ─────────────────────────────────────

/**
 * Build an inverted tree: the "root" is the focal couple, and
 * "children" are the parent families (going upward). d3 will lay
 * this out top-down, then we flip Y to make it grow upward.
 */
function buildAncestorTree(
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

  // "Children" in the inverted tree = parent families
  const childNodes: TreeNode[] = [];

  if (husband?.familyAsChild) {
    const parentNode = buildAncestorTree(data, husband.familyAsChild, visited);
    if (parentNode) childNodes.push(parentNode);
  }

  if (wife?.familyAsChild) {
    const parentNode = buildAncestorTree(data, wife.familyAsChild, visited);
    if (parentNode) childNodes.push(parentNode);
  }

  const label = [
    husband?.displayName || husband?.givenName,
    wife?.displayName || wife?.givenName,
  ]
    .filter(Boolean)
    .join(" & ");

  return {
    id: `anc-${familyId}`,
    type: "couple",
    husband,
    wife,
    family,
    label,
    sublabel: family.marriageDate ? `m. ${family.marriageDate}` : "",
    childNodes,
  };
}

// ── d3 layout helpers ────────────────────────────────────────────

interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

/**
 * Run d3-hierarchy tree layout on a TreeNode and return positioned
 * nodes + edges. The root is at y=0.
 */
function layoutTree(root: TreeNode): LayoutResult {
  const h = hierarchy<TreeNode>(root, (d) => d.childNodes);

  const treeLayout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH, NODE_HEIGHT_STEP])
    .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));

  treeLayout(h);

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  h.each((d) => {
    nodes.push({
      node: d.data,
      x: d.x ?? 0,
      y: d.y ?? 0,
    });
  });

  h.links().forEach((link) => {
    edges.push({
      parentX: link.source.x ?? 0,
      parentY: link.source.y ?? 0,
      childX: link.target.x ?? 0,
      childY: link.target.y ?? 0,
    });
  });

  return { nodes, edges };
}

// ── Spouse ancestor mini-trees ───────────────────────────────────

/**
 * For every spouse in the descendant tree whose parents are not
 * already in the layout, build a small inverted ancestor tree
 * above them.
 */
function addSpouseAncestors(
  data: GedcomData,
  descNodes: PositionedNode[],
  allNodes: PositionedNode[],
  allEdges: PositionedEdge[],
  visitedFamilies: Set<string>
): void {
  // Collect all family IDs already in the layout
  const layoutFamilyIds = new Set<string>();
  for (const pn of allNodes) {
    if (pn.node.family) layoutFamilyIds.add(pn.node.family.id);
  }

  const processedIndividuals = new Set<string>();

  // Only check spouses in the descendant tree (not the ancestor tree)
  for (const pn of descNodes) {
    const n = pn.node;
    if (n.type !== "couple") continue;

    const spouses = [n.husband, n.wife].filter(Boolean) as Individual[];
    for (const spouse of spouses) {
      if (processedIndividuals.has(spouse.id)) continue;
      processedIndividuals.add(spouse.id);

      if (!spouse.familyAsChild) continue;
      if (layoutFamilyIds.has(spouse.familyAsChild)) continue;

      // Build a small ancestor tree for this spouse
      const ancestorRoot = buildAncestorTree(
        data,
        spouse.familyAsChild,
        new Set(visitedFamilies)
      );
      if (!ancestorRoot) continue;

      // Layout it
      const miniLayout = layoutTree(ancestorRoot);

      // Find the root of the mini-layout (the spouse's parent couple)
      const miniRoot = miniLayout.nodes.find(
        (mn) => mn.node.id === ancestorRoot.id
      );
      if (!miniRoot) continue;

      // Position the mini-tree so its root is above the spouse's couple node
      const offsetX = pn.x - miniRoot.x;
      const offsetY = pn.y - NODE_HEIGHT_STEP - miniRoot.y;

      for (const mn of miniLayout.nodes) {
        mn.x += offsetX;
        mn.y += offsetY;
        allNodes.push(mn);
        layoutFamilyIds.add(mn.node.family?.id ?? "");
      }

      for (const me of miniLayout.edges) {
        me.parentX += offsetX;
        me.parentY += offsetY;
        me.childX += offsetX;
        me.childY += offsetY;
        allEdges.push(me);
      }

      // Edge from the mini-tree root down to the descendant couple node
      allEdges.push({
        parentX: pn.x,
        parentY: pn.y - NODE_HEIGHT_STEP,
        childX: pn.x,
        childY: pn.y,
      });
    }
  }
}

// ── Main layout function ─────────────────────────────────────────

/**
 * Compute the full hourglass layout:
 * - Ancestor tree (inverted) above the focal couple
 * - Descendant tree below the focal couple
 * - Spouse ancestor mini-trees above married-in spouses
 */
export function computeTreeLayout(data: GedcomData): TreeLayout {
  const focalFamilyId = findFocalFamily(data);
  if (!focalFamilyId) {
    return { nodes: [], edges: [], width: 0, height: 0, focalY: 0 };
  }

  const allNodes: PositionedNode[] = [];
  const allEdges: PositionedEdge[] = [];
  const visitedFamilies = new Set<string>();

  // ── 1. Descendant tree (top-down, root at y=0) ──
  const descRoot = buildDescendantTree(data, focalFamilyId, visitedFamilies);
  let descNodes: PositionedNode[] = [];
  if (descRoot) {
    const descLayout = layoutTree(descRoot);
    descNodes = descLayout.nodes;
    allNodes.push(...descLayout.nodes);
    allEdges.push(...descLayout.edges);
  }

  // ── 2. Ancestor tree (inverted, root at y=0, flipped upward) ──
  // We need a fresh visited set for ancestors, but mark the focal family
  const ancVisited = new Set<string>();
  ancVisited.add(focalFamilyId);
  const ancRoot = buildAncestorTree(data, focalFamilyId, ancVisited);

  if (ancRoot && ancRoot.childNodes.length > 0) {
    // Build a virtual root that only has the parent branches as children
    // (skip the focal couple itself since it's already in the descendant tree)
    const parentBranches: TreeNode = {
      id: "anc-virtual-root",
      type: "couple",
      husband: ancRoot.husband,
      wife: ancRoot.wife,
      family: ancRoot.family,
      label: ancRoot.label,
      sublabel: ancRoot.sublabel,
      childNodes: ancRoot.childNodes,
    };

    const ancLayout = layoutTree(parentBranches);

    // Find the virtual root position
    const ancRootNode = ancLayout.nodes.find(
      (n) => n.node.id === "anc-virtual-root"
    );
    const ancRootX = ancRootNode?.x ?? 0;
    const ancRootY = ancRootNode?.y ?? 0;

    // Find the focal couple position in the descendant tree
    const focalNode = descNodes.find(
      (n) => n.node.id === focalFamilyId
    );
    const focalX = focalNode?.x ?? 0;

    // Offset: align the ancestor root with the focal couple,
    // then flip Y so ancestors grow upward
    for (const an of ancLayout.nodes) {
      // Skip the virtual root (it's the same as the focal couple)
      if (an.node.id === "anc-virtual-root") continue;

      const relX = an.x - ancRootX;
      const relY = an.y - ancRootY;

      an.x = focalX + relX;
      an.y = -relY; // flip: positive Y becomes negative (upward)
      allNodes.push(an);
    }

    for (const ae of ancLayout.edges) {
      const srcRelX = ae.parentX - ancRootX;
      const srcRelY = ae.parentY - ancRootY;
      const tgtRelX = ae.childX - ancRootX;
      const tgtRelY = ae.childY - ancRootY;

      // In the flipped tree, "parent" is actually the child (closer to focal)
      // and "child" is the ancestor (further from focal, more negative Y)
      allEdges.push({
        parentX: focalX + tgtRelX,
        parentY: -tgtRelY,
        childX: focalX + srcRelX,
        childY: -srcRelY,
      });
    }

    // Edges from focal couple up to the first ancestor generation
    // The virtual root's direct children are the parent families
    for (const an of ancLayout.nodes) {
      if (an.node.id === "anc-virtual-root") continue;
      // Check if this node is a direct child of the virtual root
      const isDirectChild = ancRoot.childNodes.some(
        (c) => c.id === an.node.id
      );
      if (isDirectChild) {
        const relX = an.x - ancRootX;
        const relY = an.y - ancRootY;
        allEdges.push({
          parentX: focalX + relX,
          parentY: -relY,
          childX: focalX,
          childY: 0,
        });
      }
    }
  }

  // ── 3. Spouse ancestor mini-trees ──
  addSpouseAncestors(data, descNodes, allNodes, allEdges, visitedFamilies);

  // ── 4. Compute bounds and shift to positive coordinates ──
  if (allNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0, focalY: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const n of allNodes) {
    minX = Math.min(minX, n.x - NODE_WIDTH / 2);
    maxX = Math.max(maxX, n.x + NODE_WIDTH / 2);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + CARD_H);
  }

  const padding = 60;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  for (const n of allNodes) {
    n.x += offsetX;
    n.y += offsetY;
  }
  for (const e of allEdges) {
    e.parentX += offsetX;
    e.parentY += offsetY;
    e.childX += offsetX;
    e.childY += offsetY;
  }

  const focalY = 0 + offsetY;

  return {
    nodes: allNodes,
    edges: allEdges,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    focalY,
  };
}
