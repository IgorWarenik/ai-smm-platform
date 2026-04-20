# API

Fastify API for auth, projects, profiles, tasks, approvals, feedback, knowledge, callbacks, and metrics.

## Conventions
- Route behavior should trace to `context/kits/`.
- Tests should cover acceptance criteria from the relevant domain kit.
- Preserve project membership isolation semantics: non-members should generally receive 404 for project-scoped resources.
