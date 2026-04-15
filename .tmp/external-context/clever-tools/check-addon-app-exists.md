---
source: Clever Cloud official docs + clever-tools GitHub skill
library: clever-tools
package: clever-tools
topic: check if addon or application already exists
fetched: 2026-04-14T12:00:00Z
official_docs: https://www.clever-cloud.com/developers/doc/cli/addons/
---

# Check If an Add-on Already Exists

There is **no dedicated `clever addon exists` command**. Use `clever addon list` with JSON output and filter:

## List All Add-ons

```bash
# Human-readable list
clever addon
clever addon list

# JSON output (for scripting)
clever addon list --format json

# Scoped to an organization
clever addon list --org my-org --format json
```

## Scripting Pattern: Check Before Creating

```bash
# Check if addon named "mydb" already exists
if clever addon list --format json | jq -e '.[] | select(.name == "mydb")' > /dev/null 2>&1; then
  echo "Add-on 'mydb' already exists"
else
  clever addon create postgresql-addon mydb --plan dev --yes
fi
```

```bash
# Alternative: grep approach
if clever addon list --format json | grep -q '"name":"mydb"'; then
  echo "Add-on 'mydb' already exists"
else
  clever addon create postgresql-addon mydb --plan dev --yes
fi
```

---

# Check If an Application Already Exists

There is **no dedicated `clever app exists` command**. Use `clever applications list` with JSON output:

## List All Applications

```bash
# List all apps across all orgs
clever applications list
clever applications list --format json

# Scoped to an organization
clever applications list --org my-org --format json

# List apps linked to current directory
clever applications
clever applications --json
```

## Scripting Pattern: Check Before Creating

```bash
# Check if app named "myapp" already exists in the org
if clever applications list --format json --org my-org | jq -e '.[] | select(.name == "myapp")' > /dev/null 2>&1; then
  echo "Application 'myapp' already exists"
else
  clever create --type node myapp --org my-org
fi
```

## Key Differences

| Command | Scope | Notes |
|---------|-------|-------|
| `clever addon list` | All add-ons in user/org | Use `--org` to scope |
| `clever applications list` | All apps in user/org | Use `--org` to scope |
| `clever applications` | Only apps linked to current directory | Reads `.clever.json` |

## Important Notes

- `clever addon list` and `clever applications list` both support `--format json` for machine-readable output
- Add-on names are **not guaranteed unique** across organizations — always scope with `--org` in scripts
- Application names are also **not guaranteed unique** — use app IDs for reliable identification
- The `--format json` flag is essential for reliable scripting (don't parse human output)
