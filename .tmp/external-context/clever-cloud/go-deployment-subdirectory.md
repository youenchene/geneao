---
source: Context7 API + Official Docs
library: Clever Cloud
package: clever-cloud
topic: Go deployment with subdirectory module
fetched: 2026-04-15T00:00:00Z
official_docs: https://www.clever-cloud.com/developers/doc/applications/golang/
---

# Deploying a Go Application on Clever Cloud (Subdirectory Module)

## Key Environment Variables for Go

| Name | Description | Default |
|------|-------------|---------|
| `CC_GO_BUILD_TOOL` | Build method: `gomod`, `gobuild`, or `makefile`. (`goget` is deprecated) | Auto-detected |
| `CC_GO_PKG` | Package path passed to `go install`. Overrides auto-detection from `go.mod`. | `main.go` (when no `go.mod`) |
| `CC_GO_BINARY` | Path to the built binary. **Required** when using `makefile` build tool. | — |
| `CC_GO_RUNDIR` | Run directory relative to `$GOPATH/src/`. **Deprecated.** | — |
| `APP_FOLDER` | Root directory of the application within the repo. Use for monorepos/subdirectories. | `""` (repo root) |

> **Note:** There is **no** `CC_GO_BUILD_DIR` environment variable in Clever Cloud's documentation. The correct variable for subdirectory support is `APP_FOLDER`.

## APP_FOLDER — Subdirectory / Monorepo Support

`APP_FOLDER` specifies the root directory of the application within the git repository. When your Go module lives in a subdirectory (not the repo root), set this variable.

**Example for a Go module at `backend/`:**
```
APP_FOLDER=backend
```

This tells Clever Cloud to treat `backend/` as the application root. The build process (`go install`, `go.mod` detection, etc.) runs from this directory.

## CC_GO_PKG — Specifying the Main Package

`CC_GO_PKG` tells the build tool which package contains the `main()` function. The build command executed is:

```
go install $CC_GO_PKG
```

For the `gomod` build method, the module name is read from `go.mod` and passed to `go install`. If you need to build a **different package** within the module, set `CC_GO_PKG` to override it.

**Example for main at `./cmd/server`:**
```
CC_GO_PKG=./cmd/server
```

The resulting binary is placed at `$GOPATH/bin/<name>`, where `<name>` is the basename of the package path. So `CC_GO_PKG=./cmd/server` produces a binary named `server`.

> **Note:** There is no `CC_GO_BUILD_DIR` variable. Use `APP_FOLDER` for subdirectory and `CC_GO_PKG` for main package path.

## Build Methods

### gomod (recommended for modules)

Builds a Go module. Requires a `go.mod` file at the root of your application (or at `APP_FOLDER` root). The module name is read from `go.mod` and passed to `go install`.

- If Go version in `go.mod` is newer than installed, the toolchain downloads it automatically.
- Vendored dependencies (`vendor/` folder) are supported.
- Set `CC_GO_PKG` to override which package to build.

### gobuild (for packages)

Builds a Go package using `go install`. Set `CC_GO_PKG` to define the package path (default `main.go`). The application is moved to `$GOPATH/src/` before building.

### makefile (custom build)

Builds with a `Makefile`. Set `CC_GO_BINARY` with the path to the built binary. Auto-selected when:
- `CC_GO_BINARY` is set
- A `Makefile` exists
- No `go.mod` file is present

Example Makefile (use with `CC_GO_BINARY=bin/myApp`):

```makefile
BINARY=bin/myApp

build:
	@echo "Build the application as ./${BINARY}"
	go build -o ${BINARY} ./cmd/server
```

## clevercloud/go.json (DEPRECATED)

> ⚠️ **WARNING**: Using `clevercloud/go.json` to define Makefile and binary paths is a **deprecated method** and should no longer be used. Use environment variables instead.

The legacy format was:

```json
{
  "deploy": {
    "makefile": "Makefile",
    "main": "../go_home/bin/myapp"
  }
}
```

Where:
- `makefile`: Path to the Makefile
- `main`: Path to the built binary executable

**Do not use this for new deployments.** Use `CC_GO_BUILD_TOOL=makefile` + `CC_GO_BINARY` instead.

## Mandatory Configuration

Your Go application must:
1. Listen on `0.0.0.0` (not `localhost` or `127.0.0.1`)
2. Listen on port `8080`
3. Contain a valid build configuration

## Configuration for `backend/cmd/server/main.go`

For a repo structure like:
```
repo-root/
  backend/
    go.mod
    go.sum
    cmd/
      server/
        main.go
    internal/
      ...
```

Set these environment variables:

```bash
APP_FOLDER=backend
CC_GO_BUILD_TOOL=gomod
CC_GO_PKG=./cmd/server
```

This will:
1. Use `backend/` as the application root (finds `go.mod` there)
2. Use `gomod` build method
3. Build the `./cmd/server` package (relative to `backend/`)
4. Produce a binary named `server` at `$GOPATH/bin/server`

## Troubleshooting

Set `CC_TROUBLESHOOT=true` to enable verbose build output (`-x` flag) and the race detector (`-race` flag) during compilation. Applies to `gomod` and `gobuild` methods.

## Custom Run Command

Set `CC_RUN_COMMAND` to override the default binary execution. When defined, the binary is still built but `CC_RUN_COMMAND` is executed at start instead.

## Default GOPATH

The default `GOPATH` is `${HOME}/go_home`.
