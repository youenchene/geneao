---
source: Context7 API
library: ELK.js
package: elkjs
topic: Layered graph layout, compound nodes, bidirectional, node positioning
fetched: 2026-04-15T15:20:00Z
official_docs: https://www.eclipse.org/elk/
github: https://github.com/kieler/elkjs
npm: elkjs
stars: 2040
---

# ELK.js — Eclipse Layout Kernel for JavaScript

The most powerful graph layout engine available in JavaScript. Transpiled from Java (Eclipse Layout Kernel). Supports multiple algorithms, compound/nested nodes, port constraints, and bidirectional layouts.

## Install

```bash
npm i elkjs
```

## Basic Usage

```javascript
const ELK = require('elkjs');
const elk = new ELK();

const graph = {
  id: "root",
  layoutOptions: { 'elk.algorithm': 'layered' },
  children: [
    { id: "n1", width: 30, height: 30 },
    { id: "n2", width: 30, height: 30 },
    { id: "n3", width: 30, height: 30 }
  ],
  edges: [
    { id: "e1", sources: ["n1"], targets: ["n2"] },
    { id: "e2", sources: ["n1"], targets: ["n3"] }
  ]
};

elk.layout(graph).then(layoutedGraph => {
  // Each child now has x, y coordinates
  console.log('Node n1:', layoutedGraph.children[0].x, layoutedGraph.children[0].y);
  console.log('Node n2:', layoutedGraph.children[1].x, layoutedGraph.children[1].y);
});
```

## Layout Direction (Bidirectional Support)

```javascript
// Top-to-bottom (descendants)
elk.layout(graph, { layoutOptions: { 'elk.direction': 'DOWN' } });

// Bottom-to-top (ancestors)
elk.layout(graph, { layoutOptions: { 'elk.direction': 'UP' } });

// Left-to-right
elk.layout(graph, { layoutOptions: { 'elk.direction': 'RIGHT' } });
```

## Compound/Nested Nodes (Couple Modeling)

```javascript
const hierarchicalGraph = {
  id: "root",
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN'
  },
  children: [
    {
      id: "couple1",  // Compound node representing a couple
      width: 200,
      height: 150,
      children: [
        { id: "husband", width: 80, height: 60 },
        { id: "wife", width: 80, height: 60 }
      ],
      edges: [
        { id: "marriage", sources: ["husband"], targets: ["wife"] }
      ]
    },
    { id: "child1", width: 80, height: 60 }
  ],
  edges: [
    { id: "e1", sources: ["couple1"], targets: ["child1"] }
  ]
};

elk.layout(hierarchicalGraph).then(result => {
  // Couple container position
  console.log('Couple:', result.children[0].x, result.children[0].y);
  // Individual spouse positions (relative to couple container)
  console.log('Husband:', result.children[0].children[0].x);
  console.log('Wife:', result.children[0].children[1].x);
});
```

## Available Algorithms

```javascript
// Layered (Sugiyama-style) — best for DAGs
elk.layout(graph, { layoutOptions: { 'algorithm': 'layered' } });

// Stress — force-directed based on stress minimization
elk.layout(graph, { layoutOptions: { 'algorithm': 'stress' } });

// Force — force-directed layout
elk.layout(graph, { layoutOptions: { 'algorithm': 'force' } });

// MrTree — tree layouts
elk.layout(graph, { layoutOptions: { 'algorithm': 'mrtree' } });

// Radial — radial tree layouts
elk.layout(graph, { layoutOptions: { 'algorithm': 'radial' } });
```

## Spacing Configuration

```javascript
const graph = {
  id: "root",
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': 20,
    'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': 30,
    'elk.padding': '[left=10, top=10, right=10, bottom=10]'
  },
  children: [/* ... */],
  edges: [/* ... */]
};
```

## Port Constraints (Edge Routing)

```javascript
{
  id: "n1",
  width: 50,
  height: 30,
  properties: {
    'org.eclipse.elk.portConstraints': 'FIXED_ORDER'
  },
  ports: [
    { id: "p1", width: 5, height: 5, properties: { side: 'WEST' } },
    { id: "p2", width: 5, height: 5, properties: { side: 'EAST' } }
  ]
}
```

## React Flow Integration

```typescript
import ELK from 'elkjs/lib/elk.bundled.js';
import { useReactFlow } from '@xyflow/react';

const elk = new ELK();

const getLayoutedNodes = async (nodes, edges) => {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '40',
    },
    children: nodes.map(n => ({
      id: n.id,
      width: n.width ?? 150,
      height: n.height ?? 50,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);
  return nodes.map(node => {
    const layoutedNode = layoutedGraph.children?.find(n => n.id === node.id);
    return { ...node, position: { x: layoutedNode?.x ?? 0, y: layoutedNode?.y ?? 0 } };
  });
};
```

## Genealogy-Specific Considerations

### Strengths
- Compound nodes can model couples as containers
- `elk.direction: 'UP'` for ancestor sections
- Most powerful edge routing of any JS library
- Handles very complex graphs well

### Weaknesses
- ~500KB bundle (transpiled from Java)
- Async API (runs in Web Worker)
- Complex configuration with many options
- No genealogy-specific concepts
- Steep learning curve
