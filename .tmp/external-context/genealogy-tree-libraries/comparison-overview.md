---
source: Context7 API + GitHub + Official Docs
library: Multiple genealogy/DAG layout libraries
topic: Library comparison for genealogy tree layout
fetched: 2026-04-15T15:20:00Z
official_docs: See individual library sections
---

# Genealogy Tree Layout Libraries — Comparison Overview

## The Problem

Genealogy trees are **not strict trees** — they are **DAGs (Directed Acyclic Graphs)**:
- A person has 2 parents (not 1 like in a tree)
- Spouses who married into the family also have their own parents
- A person can appear in multiple family contexts
- The structure is bidirectional: ancestors above, descendants below

`d3-hierarchy` only supports strict single-root top-down trees. You need a library that handles DAGs or is purpose-built for genealogy.

---

## Library Comparison Matrix

| Library | Type | DAG Support | Couple Nodes | Bidirectional | Layout Only | Bundle Size | Stars | Maintained |
|---------|------|-------------|--------------|---------------|-------------|-------------|-------|------------|
| **d3-dag** | DAG layout engine | ✅ Native | ❌ Manual | ⚠️ tweakFlip | ✅ Yes | ~15KB | 1.5k | ✅ Active |
| **ELK.js** | General graph layout | ✅ Layered algo | ⚠️ Compound nodes | ✅ elk.direction | ✅ Yes | ~500KB | 2.0k | ✅ Active |
| **dagre** | DAG layout engine | ✅ Native | ❌ Manual | ✅ rankdir BT/TB | ✅ Yes | ~30KB | 5.0k | ❌ Unmaintained |
| **@dagrejs/dagre** | dagre fork | ✅ Native | ❌ Manual | ✅ rankdir BT/TB | ✅ Yes | ~30KB | — | ⚠️ Minimal |
| **family-chart** | Genealogy-specific | ✅ Built-in | ✅ Built-in | ✅ Built-in | ❌ Full renderer | ~25KB | 714 | ✅ Active |
| **relatives-tree** | Genealogy-specific | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Yes | ~3.2KB | 55 | ✅ Active |
| **Cytoscape.js** | Full graph library | ✅ Any graph | ❌ Manual | ⚠️ Via layout | ❌ Full renderer | ~300KB | 10.4k | ✅ Active |
| **React Flow** | React graph UI | ⚠️ Via plugins | ❌ Manual | ⚠️ Via layout | ❌ Full renderer | ~150KB | — | ✅ Active |
| **Graphology** | Graph data structure | ✅ DAG utils | ❌ Manual | ❌ No layout | ⚠️ Data only | ~20KB | 1.4k | ✅ Active |

### Legend
- **Layout Only**: Returns `{x, y}` positions without rendering (what you need for custom SVG)
- **Couple Nodes**: Native support for spouse/partner pairs as a unit
- **Bidirectional**: Can grow both up (ancestors) and down (descendants) from a focal node

---

## Recommendation Tiers for Your Use Case

### Tier 1: Best Fit — Genealogy-Specific Libraries

#### 1. `relatives-tree` (npm: relatives-tree)
**Best for: Layout-only genealogy with custom SVG rendering**
- ✅ Purpose-built for family trees
- ✅ Tiny (~3.2KB), zero dependencies
- ✅ Returns node positions + connector data for your own rendering
- ✅ Handles parents, children, spouses, siblings natively
- ✅ TypeScript-first
- ✅ React example available (react-family-tree)
- ⚠️ Small community (55 stars), but actively maintained
- ⚠️ Limited layout customization compared to general-purpose libs

#### 2. `family-chart` (npm: family-chart)
**Best for: Full-featured genealogy visualization**
- ✅ Purpose-built for family trees with D3.js
- ✅ Ancestry depth + progeny depth control
- ✅ Spouse/couple handling built-in
- ✅ SVG and HTML card rendering
- ✅ WikiData integration for real genealogy data
- ✅ React/Vue/Angular/Svelte support
- ✅ Visual builder tool
- ⚠️ Full rendering framework (not layout-only) — harder to integrate with custom SVG
- ⚠️ Premium version for advanced features

### Tier 2: Strong Alternatives — DAG Layout Engines

#### 3. `d3-dag` (npm: d3-dag)
**Best for: High-quality DAG layout with dagre-compatible API**
- ✅ Native DAG support (multiple parents per node)
- ✅ Sugiyama layout with optimal edge crossing minimization
- ✅ Drop-in dagre replacement API
- ✅ TypeScript-first, small bundle
- ✅ `tweakFlip("vertical")` for bottom-to-top sections
- ✅ Quality presets: "fast" (5ms), "medium" (49ms), "slow" (optimal)
- ✅ Works with React Flow
- ⚠️ No native couple/spouse concept — must model as compound nodes or edges
- ⚠️ Bidirectional requires manual splitting into ancestor/descendant sub-DAGs

#### 4. `elkjs` (npm: elkjs)
**Best for: Complex hierarchical graphs with compound nodes**
- ✅ Most powerful layout engine (Eclipse Layout Kernel)
- ✅ Multiple algorithms: layered, stress, force, mrtree, radial
- ✅ `elk.direction: 'UP'` or `'DOWN'` for bidirectional
- ✅ Compound/nested nodes (could model couples as parent containers)
- ✅ Port constraints for precise edge routing
- ✅ Hierarchy handling with `INCLUDE_CHILDREN`
- ⚠️ Large bundle (~500KB) — transpiled from Java
- ⚠️ Runs in Web Worker (async API)
- ⚠️ Complex configuration, steep learning curve

#### 5. `dagre` / `@dagrejs/dagre`
**Best for: Simple DAG layout, widely used**
- ✅ Simple API, well-documented
- ✅ `rankdir: 'BT'` for bottom-to-top (ancestors)
- ✅ Widely used with React Flow
- ⚠️ Original dagre is unmaintained
- ⚠️ @dagrejs/dagre fork has minimal maintenance
- ⚠️ d3-dag now provides a dagre-compatible API that's better maintained

### Tier 3: Possible but Overkill

#### 6. Cytoscape.js — Full graph theory library, headless mode available, but massive for just layout
#### 7. React Flow — Great UI framework but you'd still need dagre/ELK/d3-dag for layout
#### 8. Graphology — Graph data structure with DAG utilities, but no layout algorithms for positioning

---

## Architecture Recommendation for Geneao

Given your requirements (custom SVG rendering with React, bidirectional trees, couple nodes, DAG support):

### Option A: `relatives-tree` (Simplest)
```
relatives-tree (layout) → your SVG components (PersonCard, TreeNodeView)
```
- Replace d3-hierarchy with relatives-tree
- It returns positions + connectors, you render with your existing SVG components
- Native genealogy concepts (parents, spouses, children, siblings)

### Option B: `d3-dag` + Custom Genealogy Layer (Most Flexible)
```
d3-dag sugiyama (layout) → custom genealogy adapter → your SVG components
```
- Use d3-dag for DAG layout (handles multiple parents)
- Build a thin adapter that models couples as grouped nodes
- Split tree into ancestor sub-DAG (flipped) + descendant sub-DAG
- Most control over layout quality and customization

### Option C: `ELK.js` (Most Powerful)
```
elkjs (layout) → your SVG components
```
- Model couples as compound nodes with children
- Use `elk.direction` to control up/down sections
- Most powerful but largest bundle and most complex API

### Option D: `family-chart` (Fastest to Ship)
```
family-chart (full solution) — replaces your entire tree rendering
```
- Replaces both layout AND rendering
- Least custom code but least control over SVG output
