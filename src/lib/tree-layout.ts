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
const NODE_HEIGHT_STEP = 150; // vertical distance between generations

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
 * @param sibSep - separation multiplier for siblings (default 1.2)
 * @param cousinSep - separation multiplier for non-siblings (default 1.5)
 */
function layoutTree(
  root: TreeNode,
  sibSep = 1.2,
  cousinSep = 1.5
): LayoutResult {
  const h = hierarchy<TreeNode>(root, (d) => d.childNodes);

  const treeLayout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH, NODE_HEIGHT_STEP])
    .separation((a, b) => (a.parent === b.parent ? sibSep : cousinSep));

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
 * Take a d3 layout result (top-down) and flip it so it grows upward.
 * Positions the root at (anchorX, anchorY) and flips children above.
 * Skips the root node itself (skipRootId) if it's already in the layout.
 * Returns the flipped nodes and edges.
 */
function flipAncestorLayout(
  layout: LayoutResult,
  rootId: string,
  anchorX: number,
  anchorY: number,
  skipRootId?: string
): LayoutResult {
  const rootNode = layout.nodes.find((n) => n.node.id === rootId);
  const rootX = rootNode?.x ?? 0;
  const rootY = rootNode?.y ?? 0;

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  for (const n of layout.nodes) {
    if (skipRootId && n.node.id === skipRootId) continue;
    const relX = n.x - rootX;
    const relY = n.y - rootY;
    nodes.push({
      ...n,
      x: anchorX + relX,
      y: anchorY - relY, // flip Y
    });
  }

  for (const e of layout.edges) {
    // In the flipped tree, swap parent/child so edges point correctly:
    // d3 "source" (parent) = the node closer to root = closer to focal = larger Y after flip
    // d3 "target" (child) = the node further from root = further up = smaller Y after flip
    const srcRelX = e.parentX - rootX;
    const srcRelY = e.parentY - rootY;
    const tgtRelX = e.childX - rootX;
    const tgtRelY = e.childY - rootY;

    // After flip: source is at anchorY - srcRelY (closer to anchor, larger Y)
    //             target is at anchorY - tgtRelY (further from anchor, smaller Y)
    // For edge drawing: "parent" should be the one ABOVE (smaller Y = the ancestor)
    //                   "child" should be the one BELOW (larger Y = closer to focal)
    edges.push({
      parentX: anchorX + tgtRelX,
      parentY: anchorY - tgtRelY,
      childX: anchorX + srcRelX,
      childY: anchorY - srcRelY,
    });
  }

  return { nodes, edges };
}

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
  const layoutFamilyIds = new Set<string>();
  for (const pn of allNodes) {
    if (pn.node.family) layoutFamilyIds.add(pn.node.family.id);
  }

  const processedIndividuals = new Set<string>();

  for (const pn of descNodes) {
    const n = pn.node;
    if (n.type !== "couple") continue;

    const spouses = [n.husband, n.wife].filter(Boolean) as Individual[];
    for (const spouse of spouses) {
      if (processedIndividuals.has(spouse.id)) continue;
      processedIndividuals.add(spouse.id);

      if (!spouse.familyAsChild) continue;
      if (layoutFamilyIds.has(spouse.familyAsChild)) continue;

      const ancestorRoot = buildAncestorTree(
        data,
        spouse.familyAsChild,
        new Set(visitedFamilies)
      );
      if (!ancestorRoot) continue;

      const miniLayout = layoutTree(ancestorRoot, 1.8, 2.2);

      // Flip the mini-tree so it grows upward, anchored above the spouse's node
      const flipped = flipAncestorLayout(
        miniLayout,
        ancestorRoot.id,
        pn.x,
        pn.y - NODE_HEIGHT_STEP
      );

      for (const fn of flipped.nodes) {
        allNodes.push(fn);
        layoutFamilyIds.add(fn.node.family?.id ?? "");
      }
      allEdges.push(...flipped.edges);

      // Edge from the mini-tree root (now above) down to the spouse's couple node
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

  // ── 2. Ancestor trees (two separate trees, one per spouse) ──
  // Husband's ancestors → anchored above the LEFT side of the focal couple
  // Wife's ancestors → anchored above the RIGHT side of the focal couple
  const focalNode = descNodes.find((n) => n.node.id === focalFamilyId);
  const focalX = focalNode?.x ?? 0;
  const focalFamily = data.families.get(focalFamilyId);

  const HALF_COUPLE = (CARD_W + COUPLE_GAP / 2) / 2; // offset from center to card center

  if (focalFamily) {
    const husband = focalFamily.husbandId
      ? data.individuals.get(focalFamily.husbandId)
      : undefined;
    const wife = focalFamily.wifeId
      ? data.individuals.get(focalFamily.wifeId)
      : undefined;

    // Husband's ancestor branch (left side)
    if (husband?.familyAsChild) {
      const hAncRoot = buildAncestorTree(data, husband.familyAsChild, new Set([focalFamilyId]));
      if (hAncRoot) {
        const hLayout = layoutTree(hAncRoot, 1.8, 2.2);
        const anchorX = focalX - HALF_COUPLE;
        const flipped = flipAncestorLayout(hLayout, hAncRoot.id, anchorX, -NODE_HEIGHT_STEP);

        allNodes.push(...flipped.nodes);
        allEdges.push(...flipped.edges);

        // Edge from husband's parent couple down to focal couple
        allEdges.push({
          parentX: anchorX,
          parentY: -NODE_HEIGHT_STEP,
          childX: focalX,
          childY: 0,
        });
      }
    }

    // Wife's ancestor branch (right side)
    if (wife?.familyAsChild) {
      const wAncRoot = buildAncestorTree(data, wife.familyAsChild, new Set([focalFamilyId]));
      if (wAncRoot) {
        const wLayout = layoutTree(wAncRoot, 1.8, 2.2);
        const anchorX = focalX + HALF_COUPLE;
        const flipped = flipAncestorLayout(wLayout, wAncRoot.id, anchorX, -NODE_HEIGHT_STEP);

        allNodes.push(...flipped.nodes);
        allEdges.push(...flipped.edges);

        // Edge from wife's parent couple down to focal couple
        allEdges.push({
          parentX: anchorX,
          parentY: -NODE_HEIGHT_STEP,
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
