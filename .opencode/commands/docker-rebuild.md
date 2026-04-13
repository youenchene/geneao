---
description: Run /rebuild then full Docker Compose rebuild cycle (down → build → up)
model: mistral/mistral-large-latest
permission:
  bash: allow
---

Run the `/rebuild` command first to build the Go backend and lint, type-check, and build the static frontend. If `/rebuild` fails, stop immediately and do not proceed to the Docker Compose steps.

Once `/rebuild` succeeds, run a full Docker Compose rebuild cycle in the project's working directory. Execute these three commands sequentially, stopping if any step fails:

1. `docker compose down` — tear down all running containers and networks
2. `docker compose build` — rebuild all images from scratch
3. `docker compose up` — start all services

Run all three as a single chained shell command:

```
docker compose down && docker compose build && docker compose up -d
```

Show the output of each step. If any step fails, report the error clearly and do not proceed to the next step.
