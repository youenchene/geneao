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

/** A single union within a multi-couple node. */
export interface Union {
  spouse?: Individual;
  family: Family;
  childNodes: TreeNode[];
}

export interface TreeNode {
  id: string;
  type: "couple" | "individual" | "multi-couple";
  husband?: Individual;
  wife?: Individual;
  family?: Family;
  individual?: Individual;
  /** For multi-couple: the common person + their unions */
  commonPerson?: Individual;
  unions?: Union[];
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
  focalFamilyId: string | null;
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

/** GEDCOM month abbreviations → numeric month (1-indexed). */
const GEDCOM_MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/**
 * Parse a GEDCOM date string into a comparable numeric value.
 * Supports formats like:
 *   "1980"              → 198001010000
 *   "MAR 1980"          → 198003010000
 *   "15 MAR 1980"       → 198003150000
 *   "15 MAR 1980 08:30" → 198003150830
 * Returns NaN if no year can be extracted.
 */
function parseDateToNumber(dateStr: string): number {
  if (!dateStr) return NaN;

  const yearMatch = dateStr.match(/\d{4}/);
  if (!yearMatch) return NaN;
  const year = Number(yearMatch[0]);

  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;

  // Extract month from 3-letter abbreviation
  const monthMatch = dateStr.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/i);
  if (monthMatch) {
    month = GEDCOM_MONTHS[monthMatch[1].toUpperCase()] ?? 1;
  }

  // Extract day: 1-2 digit number that is NOT the year (not 4 digits)
  const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
  if (dayMatch) {
    const d = Number(dayMatch[1]);
    if (d >= 1 && d <= 31) day = d;
  }

  // Extract time: HH:MM
  const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  }

  // YYYYMMDDHHMM → comparable number
  return year * 100000000 + month * 1000000 + day * 10000 + hour * 100 + minute;
}

/**
 * Sort child IDs by full birth datetime (ascending), with ID as
 * tiebreaker for twins born at the same time. Children with no
 * birth date go last.
 */
function sortChildIds(data: GedcomData, childIds: string[]): string[] {
  return [...childIds].sort((a, b) => {
    const indA = data.individuals.get(a);
    const indB = data.individuals.get(b);
    const numA = indA ? parseDateToNumber(indA.birthDate) : NaN;
    const numB = indB ? parseDateToNumber(indB.birthDate) : NaN;

    // No birth date → sort last
    if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;

    const cmp = numA - numB;
    if (cmp !== 0) return cmp;

    // Same datetime (twins) → tiebreak by ID for deterministic order
    return a.localeCompare(b);
  });
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
  for (const childId of sortChildIds(data, family.childIds)) {
    const child = data.individuals.get(childId);
    if (!child) continue;

    const availableFamilies = child.familiesAsSpouse.filter(
      (fid) => !visited.has(fid)
    );

    if (availableFamilies.length > 1) {
      // Multiple spouses → multi-couple node
      const multiNode = buildMultiCoupleNode(data, child, availableFamilies, visited);
      if (multiNode) childNodes.push(multiNode);
    } else if (availableFamilies.length === 1) {
      const childFamilyNode = buildDescendantTree(data, availableFamilies[0], visited);
      if (childFamilyNode) childNodes.push(childFamilyNode);
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

    const spouseId =
      family.husbandId === commonPerson.id ? family.wifeId : family.husbandId;
    const spouse = spouseId ? data.individuals.get(spouseId) : undefined;

    // Build children for this union
    const unionChildNodes: TreeNode[] = [];
    for (const childId of sortChildIds(data, family.childIds)) {
      const child = data.individuals.get(childId);
      if (!child) continue;

      const childFamilies = child.familiesAsSpouse.filter(
        (fid) => !visited.has(fid)
      );

      if (childFamilies.length > 1) {
        const multiNode = buildMultiCoupleNode(data, child, childFamilies, visited);
        if (multiNode) unionChildNodes.push(multiNode);
      } else if (childFamilies.length === 1) {
        const childFamilyNode = buildDescendantTree(data, childFamilies[0], visited);
        if (childFamilyNode) unionChildNodes.push(childFamilyNode);
      } else {
        unionChildNodes.push({
          id: child.id,
          type: "individual",
          individual: child,
          label: child.displayName || child.givenName || "?",
          sublabel: formatLifespan(child),
          childNodes: [],
        });
      }
    }

    unions.push({ spouse, family, childNodes: unionChildNodes });
    allChildNodes.push(...unionChildNodes);
  }

  if (unions.length === 0) return null;

  return {
    id: `multi-${commonPerson.id}`,
    type: "multi-couple",
    commonPerson,
    unions,
    label: commonPerson.displayName || commonPerson.givenName || "?",
    sublabel: formatLifespan(commonPerson),
    childNodes: allChildNodes,
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

/** How many standard couple widths a node occupies. */
function nodeWidthMultiplier(node: TreeNode): number {
  if (node.type === "multi-couple" && node.unions) {
    return Math.max(1, node.unions.length);
  }
  return 1;
}

/** Compute the total pixel width of a multi-couple node. */
export function multiCoupleWidth(unionCount: number): number {
  return CARD_W * (unionCount + 1) + COUPLE_GAP * unionCount;
}

/**
 * For a multi-couple node at center X, compute the edge anchor X
 * for a given union index (midpoint between common person and that spouse).
 */
function unionAnchorX(nodeX: number, unionCount: number, unionIdx: number): number {
  const totalW = multiCoupleWidth(unionCount);
  const mStartX = nodeX - totalW / 2;
  const commonCenterX = mStartX + CARD_W + COUPLE_GAP + CARD_W / 2;

  if (unionIdx === 0) {
    const spouseCenterX = mStartX + CARD_W / 2;
    return (commonCenterX + spouseCenterX) / 2;
  }
  const spouseX = mStartX + CARD_W + COUPLE_GAP + CARD_W + COUPLE_GAP + (unionIdx - 1) * (CARD_W + COUPLE_GAP);
  const spouseCenterX = spouseX + CARD_W / 2;
  return (commonCenterX + spouseCenterX) / 2;
}

/** Build a map from child node ID → union index for a multi-couple node. */
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
 * Run d3-hierarchy tree layout on a TreeNode and return positioned
 * nodes + edges. The root is at y=0.
 */
function layoutTree(
  root: TreeNode,
  sibSep = 1.2,
  cousinSep = 1.5
): LayoutResult {
  const h = hierarchy<TreeNode>(root, (d) => d.childNodes);

  const treeLayout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH, NODE_HEIGHT_STEP])
    .separation((a, b) => {
      const aW = nodeWidthMultiplier(a.data);
      const bW = nodeWidthMultiplier(b.data);
      const base = a.parent === b.parent ? sibSep : cousinSep;
      return base * Math.max(1, (aW + bW) / 2);
    });

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
    const parentNode = link.source.data;
    const childNode = link.target.data;
    const px = link.source.x ?? 0;
    const py = link.source.y ?? 0;

    // For multi-couple parents, offset the edge anchor to the correct union
    let anchorX = px;
    if (parentNode.type === "multi-couple" && parentNode.unions) {
      const childUnionMap = buildChildToUnionMap(parentNode);
      const unionIdx = childUnionMap.get(childNode.id);
      if (unionIdx !== undefined) {
        anchorX = unionAnchorX(px, parentNode.unions.length, unionIdx);
      }
    }

    edges.push({
      parentX: anchorX,
      parentY: py,
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
    return { nodes: [], edges: [], width: 0, height: 0, focalY: 0, focalFamilyId: null };
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

  // Offset from focal center to each ancestor branch anchor.
  // Must be at least NODE_WIDTH/2 so the two parent couples don't overlap.
  const ANC_OFFSET = NODE_WIDTH / 2 + 20; // 114px each side → 228px apart

  if (focalFamily) {
    const husband = focalFamily.husbandId
      ? data.individuals.get(focalFamily.husbandId)
      : undefined;
    const wife = focalFamily.wifeId
      ? data.individuals.get(focalFamily.wifeId)
      : undefined;

    let hFlipped: LayoutResult | null = null;
    let wFlipped: LayoutResult | null = null;
    let hAnchorX = focalX - ANC_OFFSET;
    let wAnchorX = focalX + ANC_OFFSET;

    // Husband's ancestor branch (left side)
    if (husband?.familyAsChild) {
      const hAncRoot = buildAncestorTree(data, husband.familyAsChild, new Set([focalFamilyId]));
      if (hAncRoot) {
        const hLayout = layoutTree(hAncRoot, 1.8, 2.2);
        hFlipped = flipAncestorLayout(hLayout, hAncRoot.id, hAnchorX, -NODE_HEIGHT_STEP);
      }
    }

    // Wife's ancestor branch (right side)
    if (wife?.familyAsChild) {
      const wAncRoot = buildAncestorTree(data, wife.familyAsChild, new Set([focalFamilyId]));
      if (wAncRoot) {
        const wLayout = layoutTree(wAncRoot, 1.8, 2.2);
        wFlipped = flipAncestorLayout(wLayout, wAncRoot.id, wAnchorX, -NODE_HEIGHT_STEP);
      }
    }

    // Resolve overlap: push branches apart if they collide
    if (hFlipped && wFlipped) {
      const hMaxX = Math.max(...hFlipped.nodes.map((n) => n.x + NODE_WIDTH / 2));
      const wMinX = Math.min(...wFlipped.nodes.map((n) => n.x - NODE_WIDTH / 2));
      const gap = 40; // minimum gap between the two branches

      if (hMaxX + gap > wMinX) {
        const overlap = hMaxX + gap - wMinX;
        const shift = overlap / 2;

        // Shift husband's branch left
        for (const n of hFlipped.nodes) n.x -= shift;
        for (const e of hFlipped.edges) { e.parentX -= shift; e.childX -= shift; }
        hAnchorX -= shift;

        // Shift wife's branch right
        for (const n of wFlipped.nodes) n.x += shift;
        for (const e of wFlipped.edges) { e.parentX += shift; e.childX += shift; }
        wAnchorX += shift;
      }
    }

    // Add husband's branch to layout
    if (hFlipped) {
      allNodes.push(...hFlipped.nodes);
      allEdges.push(...hFlipped.edges);
      allEdges.push({
        parentX: hAnchorX,
        parentY: -NODE_HEIGHT_STEP,
        childX: focalX,
        childY: 0,
      });
    }

    // Add wife's branch to layout
    if (wFlipped) {
      allNodes.push(...wFlipped.nodes);
      allEdges.push(...wFlipped.edges);
      allEdges.push({
        parentX: wAnchorX,
        parentY: -NODE_HEIGHT_STEP,
        childX: focalX,
        childY: 0,
      });
    }
  }

  // ── 3. Spouse ancestor mini-trees ──
  addSpouseAncestors(data, descNodes, allNodes, allEdges, visitedFamilies);

  // ── 4. Compute bounds and shift to positive coordinates ──
  if (allNodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0, focalY: 0, focalFamilyId };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const n of allNodes) {
    const halfW = (NODE_WIDTH * nodeWidthMultiplier(n.node)) / 2;
    minX = Math.min(minX, n.x - halfW);
    maxX = Math.max(maxX, n.x + halfW);
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
    focalFamilyId,
  };
}

/**
 * Count descendants of the focal family grouped by generation.
 * Returns an array where index 0 = children, 1 = grandchildren, etc.
 * Each entry is the number of individuals in that generation.
 */
export function countDescendantsByGeneration(
  data: GedcomData,
  focalFamilyId: string
): number[] {
  const counts: number[] = [];
  const focalFamily = data.families.get(focalFamilyId);
  if (!focalFamily) return counts;

  // BFS: each level is one generation of individuals
  let currentGen: string[] = [...focalFamily.childIds];

  while (currentGen.length > 0) {
    counts.push(currentGen.length);
    const nextGen: string[] = [];
    for (const childId of currentGen) {
      const child = data.individuals.get(childId);
      if (!child) continue;
      for (const famId of child.familiesAsSpouse) {
        const fam = data.families.get(famId);
        if (!fam) continue;
        nextGen.push(...fam.childIds);
      }
    }
    currentGen = nextGen;
  }

  return counts;
}
