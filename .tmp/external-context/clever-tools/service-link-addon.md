---
source: Clever Cloud official docs + clever-tools GitHub skill
library: clever-tools
package: clever-tools
topic: service link-addon command
fetched: 2026-04-14T12:00:00Z
official_docs: https://www.clever-cloud.com/developers/doc/cli/services-depedencies/
---

# `clever service link-addon` — Link Add-on to Application

## Command Syntax

```bash
clever service link-addon <addon-id|addon-name> [options]
```

### Options

```
-a, --alias <alias>            Short name for the application
    --app <app-id|app-name>    Application to manage by its ID (or name, if unambiguous)
```

## Does It Require the App to Be Linked First?

**Yes.** The `clever service link-addon` command operates on the **currently linked application** (from `.clever.json` in the current directory). It needs to know which application to link the add-on to.

You have two ways to specify the target application:

### Option 1: Link the app to the current directory first

```bash
# First, link the app to the current directory
clever link app_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Then link the add-on to it
clever service link-addon mydb
```

### Option 2: Use `--app` flag (no local link needed)

```bash
# Directly specify the app — no .clever.json needed
clever service link-addon mydb --app app_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
clever service link-addon mydb --app my-app-name
```

## What Does Linking Do?

When you link an add-on to an application, the add-on's environment variables (credentials, connection strings, etc.) are automatically injected into the application's environment. For example, linking a PostgreSQL add-on provides:

- `POSTGRESQL_ADDON_HOST`
- `POSTGRESQL_ADDON_PORT`
- `POSTGRESQL_ADDON_DB`
- `POSTGRESQL_ADDON_USER`
- `POSTGRESQL_ADDON_PASSWORD`
- `POSTGRESQL_ADDON_URI`

## Shortcut: Link at Creation Time

You can skip the separate `service link-addon` step by using `--link` when creating the add-on:

```bash
# Create add-on AND link it to the app in one command
clever addon create postgresql-addon mydb --plan dev --link myapp
```

The `--link` option takes the app alias (as defined in `.clever.json`).

## Related Commands

```bash
# List all service dependencies for the current app
clever service
clever service --format json

# Filter to only add-on dependencies
clever service --only-addons

# Unlink an add-on from the app
clever service unlink-addon <addon-id|addon-name>

# Link another app as a dependency
clever service link-app <app-id|app-name>
```
