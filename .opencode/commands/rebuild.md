---
description: Build the Go backend and lint, type-check, and build the static frontend
model: mistral/mistral-large-latest
permission:
  bash: allow
---

Run a full rebuild of the Geneao project — both the Go backend and the static frontend.

Execute the following steps sequentially, stopping immediately if any step fails:

1. **Build Go backend** — `go build ./cmd/server/` (run from the `backend/` directory)
2. **Lint frontend** — `npm run lint`
3. **Type-check & Build frontend** — `npm run build` (this runs `tsc -b && vite build`)

Run them as a single chained shell command:

```
cd backend && go build ./cmd/server/ && cd .. && npm run lint && npm run build
```

After execution, report clearly:

- ✅ Which steps succeeded
- ❌ Which step failed (if any), with the relevant error output
- For the backend: confirm the compiled binary was produced in `backend/`
- For the frontend: the output path of the built assets (typically `dist/`)

If everything succeeds, confirm that both the backend and the static site are ready for deployment.
