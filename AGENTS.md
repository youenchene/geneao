# AGENTS.md

## Project

Geneao — a static-only web app for browsing genealogy data. No backend server; all data comes from `.ged` (GEDCOM) files stored in the repository.

## Architecture

- **Static frontend**: React + Tailwind CSS + shadcn/ui. No server-side rendering, no API.
- **Data source**: GEDCOM `.ged` files in the folder tree, parsed client-side.
- GEDCOM is a line-oriented text format for genealogy (individuals, families, sources, events). Parsers must handle the `0`/`1`/`2`… level numbering and tag grammar.

## Stack

- **React** (with Vite or similar static bundler)
- **Tailwind CSS** for styling
- **shadcn/ui** for components — these are copied into the project (not imported as a package). Use the `npx shadcn@latest add <component>` CLI to add new components.
- UI components live in `components/ui/`; do not hand-edit shadcn-generated files — re-add or override via Tailwind instead.

## Conventions

- Keep the app deployable as static files (any static host, `file://`, GitHub Pages).
- Do not introduce build steps, bundlers, or server dependencies unless explicitly requested.
