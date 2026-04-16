# AGENTS.md

## Project

Geneao — a web app for browsing and editing genealogy data. React SPA frontend backed by a Go REST API. Supports GEDCOM (.ged) import/export.

## Architecture

- **Frontend**: React 19 SPA + Tailwind CSS 4, bundled with Vite. No SSR.
- **Backend**: Go REST API (separate service in `backend/`). Auth via HttpOnly JWT cookie.
- **Data flow**: Frontend fetches tree data from `/api/tree`, renders as interactive SVG. GEDCOM files can be imported/exported via the API.
- **Tree rendering**: d3-hierarchy computes layout, custom SVG components (`PersonCard`, `TreeNodeView`) render nodes, react-zoom-pan-pinch for navigation.
- **i18n**: i18next with French default, English fallback. All user-facing strings use `useTranslation()`.
- GEDCOM is a line-oriented text format for genealogy (individuals, families, sources, events). The `gedcom` npm package parses it client-side.

## Stack

- **React 19** with **Vite 8** (static SPA bundler)
- **TypeScript 6** (strict mode)
- **Tailwind CSS 4** for styling (stone color palette, utility classes)
- **d3-hierarchy** for tree layout computation
- **react-zoom-pan-pinch** for interactive zoom/pan
- **i18next + react-i18next** for internationalization
- **gedcom** npm package for client-side GEDCOM parsing

## Conventions

- **Component files**: PascalCase (`PersonCard.tsx`, `SearchPanel.tsx`)
- **Lib/util files**: kebab-case (`gedcom-parser.ts`, `tree-layout.ts`)
- **Components**: `export default function`, `interface Props` inline, destructured props
- **Every file**: JSDoc block comment at top describing purpose
- **i18n**: All user-facing text via `useTranslation()` — never hardcode strings
- **API calls**: Use the `apiFetch<T>` wrapper in `src/lib/api.ts` with typed payloads
- **Shared state**: React Context pattern (see `src/context/EditModeContext.tsx`)
- **Type imports**: Use `import type` for type-only imports

## Git Workflow

- **Never commit code changes directly to `main`.** If the current branch is `main`, create a dedicated branch (e.g. `feat/short-description` or `fix/short-description`) before making any changes.
- Open a Pull Request to merge the branch back into `main`.
- Only push after the user has tested the changes locally.
