<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-04-13 -->

# Technical Domain

**Purpose**: Tech stack, architecture, and development patterns for Geneao.
**Last Updated**: 2026-04-13

## Quick Reference
**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

## Primary Stack
| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | React | 19.2 | SPA with functional components |
| Bundler | Vite | 8.0 | Fast static builds |
| Language | TypeScript | 6.0 | Strict typing throughout |
| Styling | Tailwind CSS | 4.2 | Utility-first, stone palette |
| Data format | GEDCOM (.ged) | — | Standard genealogy interchange |
| Tree layout | d3-hierarchy | 3.1 | Tree computation for SVG viewer |
| Zoom/Pan | react-zoom-pan-pinch | 4.0 | Interactive tree navigation |
| i18n | i18next + react-i18next | 26.0 / 17.0 | French default, English fallback |
| Backend | Go REST API (external) | — | Separate service, HttpOnly cookie auth |

## Architecture
- **Static SPA** — no SSR, deployable to any static host / GitHub Pages / `file://`
- **Backend is external** — Go API serves data via REST, auth via HttpOnly JWT cookie
- **GEDCOM parsing** — client-side via `gedcom` npm package, transformed to typed Maps
- **SVG tree rendering** — d3-hierarchy computes layout, custom SVG components render nodes

## Code Patterns

### API Client (`src/lib/api.ts`)
```typescript
// Generic fetch wrapper — auto-auth via HttpOnly cookie
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options, headers, credentials: "include",
  });
  if (response.status === 401) { setToken(null); window.location.reload(); throw new Error("Unauthorized"); }
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

// Thin typed wrappers per endpoint
export function createIndividual(data: CreateIndividualPayload): Promise<ApiIndividual> {
  return apiFetch("/api/individuals", { method: "POST", body: JSON.stringify(data) });
}
```
**Key**: Generic `apiFetch<T>` wrapper · `credentials: "include"` always · auto-redirect on 401 · typed payload/response interfaces · thin one-liner wrappers · FormData detection for uploads.

### Component
```typescript
/**
 * JSDoc block comment describing the component purpose.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  individual: Individual;
  onDataChanged?: () => void;
}

export default function PersonCard({ individual, onDataChanged }: Props) {
  const { t } = useTranslation();
  const { editMode } = useEditMode();
  return ( /* Tailwind-styled JSX */ );
}
```
**Key**: `export default function` · `interface Props` inline · JSDoc at file top · destructured props · `useTranslation()` for all strings · React Context for shared state · `createPortal` for modals.

### Context Provider
```typescript
const MyContext = createContext<MyContextType>({ /* defaults */ });
export function MyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialValue);
  return <MyContext.Provider value={{ state }}>{children}</MyContext.Provider>;
}
export function useMyContext() { return useContext(MyContext); }
```

## Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `PersonCard.tsx`, `SearchPanel.tsx` |
| Lib/util files | kebab-case | `gedcom-parser.ts`, `tree-layout.ts` |
| Context files | PascalCase | `EditModeContext.tsx` |
| Page files | PascalCase | `CustomViewerPage.tsx`, `LoginPage.tsx` |
| Components | PascalCase | `PersonCard`, `TreeNodeView` |
| Functions | camelCase | `parseGedcom`, `fetchAndSetData` |
| Interfaces | PascalCase | `Individual`, `GedcomData`, `Props` |
| Constants | UPPER_SNAKE | `COLORS`, `FONT_SIZE`, `PADDING` |
| API fields (backend) | snake_case | `given_name`, `birth_date`, `photo_url` |

## Code Standards
1. TypeScript strict — full type annotations, typed interfaces for all data
2. Functional components only — no class components
3. Default exports for components/pages, named exports for utilities/types
4. JSDoc block comment at top of every file describing its purpose
5. i18n for all user-facing text — `useTranslation()`, French default, English fallback
6. Static SPA only — no SSR, no server dependencies, deployable as static files
7. Tailwind CSS utility classes — stone color palette, no CSS-in-JS
8. React Context for shared state (e.g. EditMode)
9. `import type` for type-only imports
10. ESLint with React Hooks + React Refresh plugins

## Security Requirements
1. HttpOnly cookie auth — JWT not accessible to JS
2. `credentials: "include"` on all fetch requests
3. Auto-redirect on 401 — unauthorized requests reload the page
4. Environment variable for API URL — `VITE_API_URL`, no hardcoded secrets
5. Typed API payloads — interfaces enforce data shape before sending
6. React auto-escaping — i18n `escapeValue: false` because React handles XSS

## 📂 Codebase References
| Path | Description |
|------|-------------|
| `src/lib/api.ts` | API client, auth, fetch wrapper |
| `src/lib/gedcom-parser.ts` | GEDCOM parsing, Individual/Family types |
| `src/lib/tree-layout.ts` | d3-hierarchy tree layout computation |
| `src/components/` | All UI components (PersonCard, SearchPanel, etc.) |
| `src/pages/` | Page-level components (CustomViewerPage, LoginPage) |
| `src/context/` | React Context providers (EditModeContext) |
| `src/locales/` | i18n translation files (fr.json, en.json) |
| `src/lib/i18n.ts` | i18next configuration |
| `vite.config.ts` | Vite + React + Tailwind config, path aliases |
| `package.json` | Dependencies and scripts |

## Related Files
- AGENTS.md — Project-level agent instructions
