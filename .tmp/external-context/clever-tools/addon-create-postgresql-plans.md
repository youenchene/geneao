---
source: Clever Cloud official docs + clever-tools GitHub skill
library: clever-tools
package: clever-tools
topic: addon create postgresql plans
fetched: 2026-04-14T12:00:00Z
official_docs: https://www.clever-cloud.com/developers/doc/cli/addons/
---

# `clever addon create` — PostgreSQL Plans

## Command Syntax

```bash
clever addon create <addon-provider> <addon-name> [options]
```

### Options

```
    --addon-version <addon-version>     The version to use for the add-on
-F, --format <format>                   Output format (human, json) (default: human)
-l, --link <alias>                      Link the created add-on to the app with the specified alias
    --option <option>                   Option to enable for the add-on. Multiple --option argument can be passed to enable multiple options
-o, --org, --owner <org-id|org-name>    Organisation to target by its ID (or name, if unambiguous)
-p, --plan <plan>                       Add-on plan, depends on the provider
-r, --region <region>                   Region to provision the add-on in, depends on the provider (default: par)
-y, --yes                               Skip confirmation even if the add-on is not free
```

> **NOTE:** If no plan is set, the cheapest plan is used by default.

## Valid `postgresql-addon` Plans (exhaustive list)

```
dev
xxs_sml, xxs_med, xxs_big
xs_tny, xs_sml, xs_med, xs_big
s_sml, s_med, s_big, s_hug
m_sml, m_med, m_big
l_sml, l_med, l_big, l_gnt
xl_sml, xl_med, xl_big, xl_hug, xl_gnt
xxl_sml, xxl_med, xxl_big, xxl_hug
xxxl_sml, xxxl_med, xxxl_big
3xl_cpu_tit
```

### Available Zones for `postgresql-addon`

`par`, `parhds`, `grahds`, `ldn`, `mtl`, `rbx`, `rbxhds`, `scw`, `sgp`, `syd`, `wsw`

## Plan Naming Convention

Plans follow the pattern `{size}_{storage}`:
- **Size prefix**: `dev`, `xxs`, `xs`, `s`, `m`, `l`, `xl`, `xxl`, `xxxl`, `3xl`
- **Storage suffix**: `tny` (tiny), `sml` (small), `med` (medium), `big`, `hug` (huge), `gnt` (giant)
- `dev` is a special free/development plan with no suffix

## Examples

```bash
# Free development database (smallest)
clever addon create postgresql-addon mydb --plan dev

# Small plan with small storage
clever addon create postgresql-addon mydb --plan s_sml --region par

# Skip confirmation for paid plans
clever addon create postgresql-addon mydb --plan s_sml --yes

# Create and immediately link to an app
clever addon create postgresql-addon mydb --plan dev --link myapp

# Create in a specific org
clever addon create postgresql-addon mydb --plan dev --org my-org
```

## About the "Your user did not satisfy our requirements" Error

The error `"Your user did not satisfy our requirements"` when using a plan like `s_sml` is **NOT a plan name issue** — `s_sml` is a valid plan name. This error typically means:

1. **Account verification required**: Your Clever Cloud account may need payment method verification or identity validation before provisioning paid add-ons.
2. **Organization permissions**: You may not have sufficient permissions in the target organization.
3. **Plan restrictions**: Some plans may require a specific account tier or contract.

**Workaround**: Try `--plan dev` first (free tier). If that works, the issue is account-level, not CLI syntax.
