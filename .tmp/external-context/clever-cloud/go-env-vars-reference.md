---
source: Context7 API + Official Docs
library: Clever Cloud
package: clever-cloud
topic: Go environment variables reference
fetched: 2026-04-15T00:00:00Z
official_docs: https://www.clever-cloud.com/developers/doc/reference/reference-environment-variables/
---

# Clever Cloud Go Environment Variables Reference

## Go-Specific Variables

| Name | Description | Default |
|------|-------------|---------|
| `CC_GO_BUILD_TOOL` | Build method: `gomod`, `gobuild`, `makefile`. `goget` exists but is deprecated. | Auto-detected |
| `CC_GO_PKG` | Package path passed to `go install`. Overrides auto-detection from `go.mod`. | `main.go` (no go.mod) |
| `CC_GO_BINARY` | Path to built binary. **Required** with `makefile` build tool. | — |
| `CC_GO_RUNDIR` | Run dir relative to `$GOPATH/src/`. **Deprecated.** | — |

## General Variables Relevant to Go Deployments

| Name | Description | Default |
|------|-------------|---------|
| `APP_FOLDER` | Application root directory within the git repo (for monorepos/subdirectories). | `""` (repo root) |
| `CC_RUN_COMMAND` | Custom command to run instead of the built binary. | — |
| `CC_TROUBLESHOOT` | Enable verbose build (`-x`) and race detector (`-race`). | `false` |
| `CC_CACHE_DEPENDENCIES` | Cache build dependencies for faster subsequent builds. | `false` |
| `CC_PRE_BUILD_HOOK` | Command to run before dependencies are fetched. | — |
| `CC_POST_BUILD_HOOK` | Command to run after project is built. | — |
| `CC_PRE_RUN_HOOK` | Command to run before application starts. | — |

## Important Notes

- **No `CC_GO_BUILD_DIR`**: This variable does not exist. Use `APP_FOLDER` for subdirectory support.
- **No `CC_GO_PKG` for directory**: `CC_GO_PKG` specifies the package path for `go install`, not a file path. Use `./cmd/server` syntax.
- Default `GOPATH`: `${HOME}/go_home`
- Build command: `go install <package>` for all non-Makefile methods
- Binary output: `$GOPATH/bin/<basename>` (e.g., `./cmd/server` → `server`)
- Port: Application **must** listen on port `8080`
- Host: Application **must** listen on `0.0.0.0`
