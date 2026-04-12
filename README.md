# Geneao

**Genealogy software so simple, you don't need a PhD to use it!**

Geneao is a brilliantly simple, static-only web app that lets you browse your family history directly from `.ged` (GEDCOM) files. We stripped away the complicated backend servers and clunky interfaces to give you a smooth, modern experience that works right out of the box.

## ✨ Features

- **Blazing Fast & Serverless**: React + Tailwind CSS + SVG rendering. No backend databases, no server-side headaches.
- **Interactive Tree Viewer**: Seamlessly pan, zoom, expand/collapse branches, and search for ancestors with a beautifully intuitive interface.
- **Instant GEDCOM Parsing**: Your `.ged` files are parsed entirely client-side. Your data stays exactly where you put it.
- **Deploy Anywhere**: Host it on GitHub Pages, Netlify, Vercel, or even run it locally via `file://`. It's that flexible!

## 🚀 Quick start

Get your family tree up and running in seconds:

```bash
npm install
npm run dev    # Dev server at http://localhost:5173
npm run build  # Static build → dist/
```

## 🌳 Managing Your Data

Adding your family history is as easy as moving a file:
- Place your `.ged` files directly into the `tree/` directory.
- Geneao automatically loads `tree/*.ged` files when the app runs.
- We've included an example to get you started: `tree/famillechene_61739.ged`.

## 🛠 Architecture

Built with modern tools for maximum performance and simplicity:
- **React** + **Vite** for lightning-fast static bundling.
- **Tailwind CSS** for sleek, responsive styling.
- **d3-hierarchy** for smart, organized tree layouts.
- **react-zoom-pan-pinch** for smooth map-like navigation.
- **Custom SVG rendering** for crisp person cards and family connections.

## 📄 License

MIT. See [LICENSE](LICENSE).