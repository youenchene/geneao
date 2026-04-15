---
source: Context7 API
library: dagre
package: dagre / @dagrejs/dagre
topic: Directed graph layout API, node positioning, rankdir
fetched: 2026-04-15T15:20:00Z
official_docs: https://github.com/dagrejs/dagre/wiki
github: https://github.com/dagrejs/dagre
npm: dagre / @dagrejs/dagre
stars: 5027
---

# dagre — Directed Graph Layout

Simple, widely-used directed graph layout library. Note: the original `dagre` is unmaintained. Use `@dagrejs/dagre` or consider `d3-dag` which now provides a dagre-compatible API.

## Install

```bash
npm i @dagrejs/dagre
# or use d3-dag's dagre-compatible API:
npm i d3-dag
```

## Basic Usage

```javascript
const dagre = require('@dagrejs/dagre');

const g = new dagre.graphlib.Graph();
g.setGraph({
  rankdir: 'TB',    // TB (top→bottom), BT (bottom→top), LR, RL
  nodesep: 50,      // Horizontal spacing between nodes
  edgesep: 10,      // Horizontal spacing between edges
  ranksep: 50,      // Vertical spacing between ranks/layers
  marginx: 0,
  marginy: 0,
  ranker: 'network-simplex'  // or 'tight-tree', 'longest-path'
});
g.setDefaultEdgeLabel(() => ({}));

// Add nodes with dimensions
g.setNode("kspacey", { label: "Kevin Spacey", width: 144, height: 100 });
g.setNode("swilliams", { label: "Saul Williams", width: 160, height: 100 });
g.setNode("bpitt", { label: "Brad Pitt", width: 108, height: 100 });

// Add edges
g.setEdge("kspacey", "swilliams");
g.setEdge("swilliams", "kbacon");
g.setEdge("bpitt", "kbacon");

// Run layout
dagre.layout(g);

// Read results
g.nodes().forEach(v => {
  const node = g.node(v);
  console.log(`${v}: (${node.x}, ${node.y})`);
  // x, y are CENTER of node
});

g.edges().forEach(e => {
  const edge = g.edge(e);
  console.log(`${e.v} → ${e.w}:`, edge.points);
  // points is array of {x, y} control points
});
```

## Graph Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `rankdir` | `TB` | Direction: `TB`, `BT`, `LR`, `RL` |
| `align` | `undefined` | Alignment: `UL`, `UR`, `DL`, `DR` |
| `nodesep` | `50` | Horizontal pixel spacing between nodes |
| `edgesep` | `10` | Horizontal pixel spacing between edges |
| `ranksep` | `50` | Vertical pixel spacing between ranks |
| `marginx` | `0` | Left/right margin |
| `marginy` | `0` | Top/bottom margin |
| `acyclicer` | `undefined` | Set to `greedy` for cycle removal heuristic |
| `ranker` | `network-simplex` | Algorithm: `network-simplex`, `tight-tree`, `longest-path` |

## Output Format

After `dagre.layout(g)`:
- **Nodes**: `g.node(v)` → `{ x, y, width, height }` (x,y = center)
- **Edges**: `g.edge(e)` → `{ points: [{x,y}, ...] }` (control points for SVG path)
- **Graph**: `g.graph()` → `{ width, height }` (total dimensions)

## Bidirectional Support

```javascript
// For ancestors (bottom-to-top)
g.setGraph({ rankdir: 'BT' });

// For descendants (top-to-bottom)
g.setGraph({ rankdir: 'TB' });
```

## Genealogy-Specific Considerations

### Strengths
- Simple, well-understood API
- Widely used (5k stars), lots of examples
- `rankdir: 'BT'` for ancestor sections
- Works well with React Flow

### Weaknesses
- Original dagre is unmaintained (last commit 2018)
- No native couple/spouse concept
- No compound node support
- d3-dag's dagre-compatible API is now a better choice
- Limited layout quality compared to d3-dag or ELK.js
