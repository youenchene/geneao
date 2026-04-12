# Geneao

A static-only web app for browsing genealogy data from `.ged` (GEDCOM) files.

## Features

- **Static frontend**: React + Tailwind CSS + SVG rendering. No backend, no build step beyond `npm run build`.
- **Interactive tree viewer**: pan, zoom, expand/collapse branches, search for people.
- **GEDCOM parsing**: client-side parsing of `.ged` files stored in the repository.
- **Deploy anywhere**: works from `file://`, GitHub Pages, Netlify, Vercel, or any static host.

## Quick start

```bash
npm install
npm run dev    # Dev server at http://localhost:5173
npm run build  # Static build → dist/
```

## Data

- Place `.ged` files in the `tree/` directory.
- The app loads `tree/*.ged` at runtime.
- Example: `tree/famillechene_61739.ged` (included).

## Architecture

- **React** + **Vite** for static bundling.
- **Tailwind CSS** for styling.
- **d3-hierarchy** for tree layout.
- **react-zoom-pan-pinch** for pan/zoom interaction.
- **Custom SVG rendering** for person cards and family connections.

## License

MIT. See [LICENSE](LICENSE).
