---
source: Context7 API
library: d3-dag
package: d3-dag
topic: Sugiyama DAG layout API, dagre compatibility, node positioning
fetched: 2026-04-15T15:20:00Z
official_docs: https://erikbrinkman.github.io/d3-dag/
github: https://github.com/erikbrinkman/d3-dag
npm: d3-dag
stars: 1498
---

# d3-dag — DAG Layout for JavaScript/TypeScript

Lightweight, TypeScript-first DAG layout. Provides layered graph layout algorithms for directed acyclic graphs. Drop-in replacement for dagre with better algorithms.

## Install

```bash
npm i d3-dag
```

## Key Features
- **Sugiyama layout**: layered hierarchical layout with optimal edge crossing minimization
- **Zherebko layout**: linear topological layout
- **Grid layout**: grid-based topological layout
- **dagre-compatible API**: drop-in replacement for dagre
- **TypeScript-first**: full type safety with generic operators
- **Small bundle**: fraction of elkjs's ~500KB

## Basic Usage — Sugiyama Layout

```typescript
import { graphStratify, sugiyama } from "d3-dag";

const data = [
  { id: "A" },
  { id: "B", parentIds: ["A"] },
  { id: "C", parentIds: ["A"] },
  { id: "D", parentIds: ["B", "C"] }  // D has TWO parents — DAG!
];

const dag = graphStratify()(data);
const layout = sugiyama();
const { width, height } = layout(dag);

// Access node positions
for (const node of dag.nodes()) {
  console.log(`${node.data.id}: (${node.x}, ${node.y})`);
}

// Access edge control points for SVG path drawing
for (const link of dag.links()) {
  console.log(`${link.source.data.id} → ${link.target.data.id}`);
  console.log("Control points:", link.points); // array of {x, y}
}
```

## Custom Node Sizes

```typescript
// Constant size
const sized = sugiyama().nodeSize([100, 50]); // width, height

// Dynamic size based on data
const dynamic = sugiyama().nodeSize((node) => {
  const labelLength = node.data.id.length;
  return [labelLength * 10 + 20, 40];
});
```

## Layout Configuration

```typescript
import {
  sugiyama,
  layeringSimplex, layeringLongestPath, layeringTopological,
  decrossOpt, decrossTwoLayer,
  coordSimplex, coordGreedy, coordCenter
} from "d3-dag";

const customLayout = sugiyama()
  .layering(layeringSimplex())       // Minimize edge length (default)
  .decross(decrossTwoLayer())        // Fast heuristic (default)
  .coord(coordSimplex())             // Minimize edge curves (default)
  .nodeSize([80, 40])
  .gap([20, 40]);                    // horizontal gap, vertical gap
```

## Flip Layout (Bidirectional Support)

```typescript
import { sugiyama, tweakFlip, tweakSize, tweakShape, shapeEllipse } from "d3-dag";

// Flip layout vertically (bottom-to-top for ancestors)
const ancestorLayout = sugiyama().tweaks([
  tweakFlip("vertical")
]);

// Combine multiple tweaks
const combined = sugiyama().tweaks([
  tweakShape(shapeEllipse()),
  tweakSize({ width: "+50", height: "+50" }),
  tweakFlip("vertical")
]);
```

## dagre-Compatible API (Drop-in Replacement)

```typescript
import { dagre } from "d3-dag";

const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: "TB" });  // TB, BT, LR, RL
g.setDefaultEdgeLabel(() => ({}));

// Add nodes with dimensions
g.setNode("A", { width: 100, height: 50 });
g.setNode("B", { width: 100, height: 50 });
g.setEdge("A", "B");

dagre.layout(g);

// Read positions
g.nodes().forEach((v) => {
  const node = g.node(v);
  console.log(`${v}: (${node.x}, ${node.y})`);
});
```

### Quality Presets

```typescript
g.setGraph({ quality: "fast" });    // 5ms for 184 nodes, ~4x faster than dagre
g.setGraph({});                     // "medium" default, 49ms, ~2x slower than dagre
g.setGraph({ quality: "slow" });    // Optimal, small graphs only
```

### Alternative Algorithms

```typescript
g.setGraph({ algorithm: "zherebko" }); // Linear topological layout
g.setGraph({ algorithm: "grid" });     // Grid-based topological layout
```

## Error Handling

```typescript
import { graphConnect, sugiyama } from "d3-dag";

// Detect cycles
const graph = graphConnect()([["A", "B"], ["B", "C"], ["C", "A"]]);
console.log(graph.acyclic()); // false — will fail layout

// Detect multi-edges
const multi = graphConnect()([["A", "B"], ["A", "B"]]);
console.log(multi.multi()); // true
```

## Genealogy-Specific Considerations

### Modeling Couples
d3-dag has no native "couple node" concept. Options:
1. **Grouped nodes**: Create a virtual "family" node that both spouses connect to, with children below
2. **Side-by-side constraint**: Use coordinate assignment to keep spouses adjacent
3. **Post-processing**: Run layout, then shift spouse nodes to be side-by-side

### Bidirectional Trees
d3-dag layouts are unidirectional. For ancestor↑ + descendant↓:
1. **Split into two sub-DAGs**: ancestors (flipped with `tweakFlip("vertical")`) and descendants (normal)
2. **Stitch together**: Place focal person at the junction, offset ancestor layout above descendant layout
3. **Or use dagre API with `rankdir: "BT"`** for the ancestor portion

### Multiple Parents
This is d3-dag's strength — `parentIds: ["mother", "father"]` works natively.
