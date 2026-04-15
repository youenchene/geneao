---
source: GitHub README + npm
library: relatives-tree
package: relatives-tree
topic: Family tree layout, genealogy-specific node positioning
fetched: 2026-04-15T15:20:00Z
official_docs: https://github.com/SanichKotikov/relatives-tree
github: https://github.com/SanichKotikov/relatives-tree
npm: relatives-tree
stars: 55
demo: https://sanichkotikov.github.io/react-family-tree-example/
---

# relatives-tree — Genealogy-Specific Layout Library

A tiny library (~3.23 kB) for calculating JSON data to family tree nodes and connectors. Purpose-built for genealogy with native support for parents, children, spouses, and siblings.

## Install

```bash
npm i relatives-tree
```

## Basic Usage

```typescript
import calcTree, { type Node } from 'relatives-tree';

const nodes: Node[] = [
  {
    id: "father",
    gender: "male",
    spouses: [{ id: "mother", type: "married" }],
    siblings: [],
    parents: [],
    children: [
      { id: "child1", type: "blood" },
      { id: "child2", type: "blood" }
    ]
  },
  {
    id: "mother",
    gender: "female",
    spouses: [{ id: "father", type: "married" }],
    siblings: [],
    parents: [],
    children: [
      { id: "child1", type: "blood" },
      { id: "child2", type: "blood" }
    ]
  },
  {
    id: "child1",
    gender: "female",
    spouses: [],
    siblings: [{ id: "child2", type: "blood" }],
    parents: [
      { id: "father", type: "blood" },
      { id: "mother", type: "blood" }
    ],
    children: []
  },
  {
    id: "child2",
    gender: "male",
    spouses: [],
    siblings: [{ id: "child1", type: "blood" }],
    parents: [
      { id: "father", type: "blood" },
      { id: "mother", type: "blood" }
    ],
    children: []
  }
];

const tree = calcTree(nodes, { rootId: "father" });

// tree contains positioned nodes and connectors for rendering
```

## Node Data Structure

```typescript
interface Node {
  id: string;
  gender: "male" | "female";
  parents: Relation[];    // { id: string, type: "blood" | "adopted" | ... }
  children: Relation[];
  siblings: Relation[];
  spouses: Relation[];
}

interface Relation {
  id: string;
  type: "blood" | "married" | "adopted" | "half" | ...;
}
```

## Output

The `calcTree()` function returns positioned data including:
- Node positions (x, y coordinates)
- Connector/line data for drawing relationships
- Family groupings

## Rendering Examples

- **Canvas**: Built-in canvas example in `/docs`
- **React**: [react-family-tree](https://github.com/SanichKotikov/react-family-tree)
- **Solid**: [solid-family-tree-example](https://github.com/SanichKotikov/solid-family-tree-example)

## Key Advantages for Genealogy

1. **Native relationship types**: blood, adopted, married, half-siblings
2. **Spouse handling**: Spouses are placed side-by-side automatically
3. **Bidirectional**: Parents above, children below, centered on rootId
4. **Tiny bundle**: ~3.2KB, zero dependencies
5. **TypeScript**: Full type definitions
6. **Framework agnostic**: Returns data, you render however you want

## Limitations

- Small community (55 stars, 31 forks)
- Limited documentation beyond README and examples
- Less layout customization than general-purpose libraries
- No built-in animation or interaction
