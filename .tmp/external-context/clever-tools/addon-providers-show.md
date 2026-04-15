---
source: Clever Cloud official docs + clever-tools GitHub skill
library: clever-tools
package: clever-tools
topic: addon providers show - list available plans
fetched: 2026-04-14T12:00:00Z
official_docs: https://www.clever-cloud.com/developers/doc/cli/addons/
---

# `clever addon providers` — List Available Plans

## List All Providers

```bash
clever addon providers
clever addon providers --format json
```

## Show Plans for a Specific Provider

```bash
clever addon providers show <addon-provider>
clever addon providers show <addon-provider> --format json
```

### Examples

```bash
# Show PostgreSQL plans, regions, versions
clever addon providers show postgresql-addon

# JSON output for scripting
clever addon providers show postgresql-addon --format json

# Show Redis plans
clever addon providers show redis-addon

# Show all available providers
clever addon providers
```

### Command Reference

```
clever addon providers show <addon-provider> [options]

Arguments:
  addon-provider           Add-on provider name

Options:
  -F, --format <format>    Output format (human, json) (default: human)
```

The `human` output shows plans with their names, descriptions, pricing info, and available regions. The `json` output is useful for scripting to extract plan names programmatically.

## All Available Add-on Providers

| Provider | Plans |
|----------|-------|
| `addon-matomo` | `beta` |
| `addon-pulsar` | `beta` |
| `azimutt` | `free`, `solo`, `team`, `team-2`..`team-5`, `enterprise` |
| `cellar-addon` | `S` |
| `config-provider` | `std` |
| `es-addon` | `xs`, `s`, `m`, `l`, `xl`, `xxl`, `xxxl`, `4xl`, `5xl` |
| `fs-bucket` | `s` |
| `jenkins` | `XS`, `S`, `M`, `L`, `XL` |
| `keycloak` | `base` |
| `kv` | `base` |
| `mailpace` | `clever_solo`, `clever_scaling_10`..`clever_scaling_100` |
| `metabase` | `base` |
| `mongodb-addon` | `xs_sml`..`xxl_big` |
| `mysql-addon` | `dev`, `xxs_sml`..`xxl_hug` |
| `otoroshi` | `base` |
| `postgresql-addon` | `dev`, `xxs_sml`..`3xl_cpu_tit` |
| `redis-addon` | `s_mono`..`7xl_mono` |
