---
source: Context7 API + GitHub
library: family-chart
package: family-chart
topic: D3-based family tree visualization, ancestry/progeny depth, couple handling
fetched: 2026-04-15T15:20:00Z
official_docs: https://donatso.github.io/family-chart-doc/
github: https://github.com/donatso/family-chart
npm: family-chart
stars: 714
---

# family-chart — D3.js Family Tree Visualization

A powerful D3.js-based visualization library for creating interactive family trees. Full rendering solution (not layout-only). Supports React, Vue, Angular, Svelte, and vanilla JS.

## Install

```bash
npm i family-chart
```

## Chart API

```typescript
// Create chart
const chart = new Chart(container: string | HTMLElement, data: Data);

// Configure ancestry depth (generations above focal person)
chart.setAncestryDepth(3);  // Show 3 generations of ancestors

// Configure progeny depth (generations below focal person)
chart.setProgenyDepth(3);   // Show 3 generations of descendants

// Set orientation
chart.setOrientationHorizontal();  // or vertical (default)

// Spacing
chart.setCardXSpacing(20);  // Horizontal spacing between cards
chart.setCardYSpacing(40);  // Vertical spacing between cards

// Card rendering
chart.setCardSvg();   // SVG-based cards
chart.setCardHtml();   // HTML-based cards

// Callbacks
chart.setBeforeUpdate(fn);
chart.setAfterUpdate(fn);

// Get main person
const mainPerson = chart.getMainDatum();

// Get max depth
const { ancestry, progeny } = chart.getMaxDepth("person-id");

// Kinship calculations
const kinships = chart.calculateKinships("person-id");
```

## TreeDatum Interface

```typescript
interface TreeDatum {
  data: Datum;           // The person's data
  x: number;             // Computed X position
  y: number;             // Computed Y position
  depth: number;         // Generation depth
  is_ancestry?: boolean; // Is this in the ancestor section?
  
  // Relationships
  parent?: TreeDatum;
  parents?: TreeDatum[];
  children?: TreeDatum[];
  spouse?: TreeDatum;
  spouses?: TreeDatum[];
  coparent?: TreeDatum;
  sibling?: boolean;
  
  // Display
  is_private?: boolean;
  duplicate?: number;
  all_rels_displayed?: boolean;
  
  // Spouse positioning
  sx?: number;   // Spouse X offset
  sy?: number;   // Spouse Y offset
}
```

## Key Features

- **Bidirectional**: Ancestry above + progeny below, controlled by depth settings
- **Couple handling**: Native spouse/coparent positioning
- **Duplicate detection**: Handles person appearing in multiple contexts
- **Kinship engine**: Calculate relationships between any two people
- **WikiData integration**: Load real genealogy data
- **Edit mode**: Built-in tree editing with form management
- **Framework support**: React, Vue, Angular, Svelte, vanilla JS

## React Example

```jsx
import { useEffect, useRef } from 'react';
import { Chart } from 'family-chart';

function FamilyTree({ data }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (containerRef.current) {
      const chart = new Chart(containerRef.current, data);
      chart.setAncestryDepth(3);
      chart.setProgenyDepth(3);
      chart.setCardHtml();
    }
  }, [data]);
  
  return <div ref={containerRef} />;
}
```

## Genealogy-Specific Considerations

### Strengths
- Purpose-built for genealogy — handles all the hard cases
- Bidirectional (ancestry + progeny) out of the box
- Couple/spouse positioning built-in
- Active development, 714 stars
- Visual builder for configuration
- Premium version available for advanced features

### Weaknesses
- Full rendering solution — harder to integrate with existing custom SVG components
- D3.js dependency (you already have d3-hierarchy, but this adds more D3)
- Less control over exact SVG output compared to layout-only libraries
- Premium features behind paywall (kinship engine, tree filtering, performance)
