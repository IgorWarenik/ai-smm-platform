title: Auth, projects, and project profile
status: approved
priority: high
last_updated: 2026-04-10

## Scope
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/profile.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/types.ts`
- `packages/db/prisma/schema.prisma`

## Goal
Give every user a secure account, one or more isolated projects, and a compact project profile that agents can use as business context.

## Public Contract
- Auth routes live under `/api/auth`.
- Project routes live under `/api/projects`.
- Project profile routes live under `/api/projects/:projectId/profile`.
- Request validation uses Zod schemas from `packages/shared/src/schemas.ts`.
- Project access must check membership before returning or mutating project-scoped data.
- Project-scoped database work must run with `withProjectContext(projectId, userId, ...)` when RLS-protected tables are touched.

## Acceptance Criteria
- A user can register with `email`, `password`, and optional `name`.
- A user can log in and receive an access token.
- Authenticated users can create and list only their own projects.
- Project profile has the required Tier 1 fields: `companyName`, `description`, `niche`, `geography`.
- Project profile may include products, audience, competitors, TOV, keywords, forbidden topics, references, social links, KPI, and existing content.
- Unauthorized or non-member access returns an auth/permission error and never leaks project data.

## Examples
```json
{
  "register": {
    "email": "owner@example.com",
    "password": "password123",
    "name": "Owner"
  },
  "createProject": {
    "name": "Q2 launch",
    "settings": {
      "language": "ru",
      "defaultScenario": "B"
    }
  },
  "profile": {
    "companyName": "ACME",
    "description": "B2B SaaS for sales analytics",
    "niche": "Sales analytics",
    "geography": "Russia",
    "audience": [
      {
        "segment": "SMB founders",
        "portrait": "Owners of 10-100 employee companies",
        "pain_points": ["manual reporting", "low funnel visibility"]
      }
    ]
  }
}
```

## Context Rules
- For auth/project/profile tasks, include route file being changed plus `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`, and relevant Prisma models.
- Do not include agent workflow implementation unless the task explicitly changes how project profile is passed to agents.

