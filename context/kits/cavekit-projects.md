---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: medium
---

# Cavekit: Projects

## Scope
Tenant boundary of the platform. A project groups the profile, knowledge base, tasks, and executions belonging to a single marketing context. This domain covers project creation, listing, retrieval, update, deletion, and membership management with role-based access.

## Requirements

### R1: Project Creation
**Description:** Any authenticated user can create a project and becomes its owner.
**Acceptance Criteria:**
- [ ] Request with valid name and optional settings returns HTTP 201 with the new project (id, name, settings, ownerId).
- [ ] The creating user is automatically recorded as a member of the new project with the OWNER role.
- [ ] Request from an unauthenticated caller returns HTTP 401.
- [ ] settings payload is accepted with optional language and defaultScenario fields and stored as-is.
**Dependencies:** cavekit-auth R4

### R2: Project Listing
**Description:** A user can list the projects visible to them. Visibility is constrained to projects where the user is a member.
**Acceptance Criteria:**
- [ ] Response contains every project in which the caller has a membership record.
- [ ] Response excludes every project in which the caller has no membership record.
- [ ] Request without authentication returns HTTP 401.
**Dependencies:** R1, cavekit-auth R4

### R3: Project Retrieval
**Description:** A member can fetch a specific project by id. Non-members must not learn of the project's existence.
**Acceptance Criteria:**
- [ ] Member request returns HTTP 200 with the project object.
- [ ] Request for a project id the caller has no membership in returns HTTP 404 (never 403).
- [ ] Request for a project id that does not exist returns HTTP 404.
- [ ] Request without authentication returns HTTP 401.
**Dependencies:** R1

### R4: Project Update
**Description:** Project name and settings can be updated by users with write access.
**Acceptance Criteria:**
- [ ] PATCH from an OWNER or MEMBER updates the supplied fields and returns HTTP 200 with the updated project.
- [ ] PATCH from a non-member returns HTTP 404.
- [ ] PATCH with no authentication returns HTTP 401.
- [ ] [GAP] Behavior for PATCH from a VIEWER role is not specified or tested.
**Dependencies:** R1, R6

### R5: Project Deletion
**Description:** A project can be deleted by its owner.
**Acceptance Criteria:**
- [ ] DELETE from an OWNER removes the project and returns a success status.
- [ ] DELETE from a MEMBER or VIEWER is rejected.
- [ ] DELETE from a non-member returns HTTP 404.
- [ ] [GAP] No tests cover DELETE behavior or cascade effects on related tasks, profiles, and knowledge items.
**Dependencies:** R1, R6

### R6: Role-Based Membership
**Description:** Every user's access to a project is mediated by a membership record with one of three roles: OWNER, MEMBER, VIEWER.
**Acceptance Criteria:**
- [ ] Project creation records the creator with role OWNER.
- [ ] Each role is one of exactly {OWNER, MEMBER, VIEWER}; other values are rejected at write time.
- [ ] A user without a membership record is treated as a non-member for every read and write operation on that project.
- [ ] [GAP] VIEWER write restrictions are enforced at the profile level but not uniformly specified across all project endpoints.
**Dependencies:** R1

### R7: Member Invitation
**Description:** An owner can add another registered user as a member of the project by email and role.
**Acceptance Criteria:**
- [ ] POST members with { email, role } by the OWNER returns a success status and creates a membership record.
- [ ] If no user exists with the supplied email the response is an explicit error, not a silent success.
- [ ] POST members by a MEMBER or VIEWER is rejected.
- [ ] [GAP] No endpoint exists to change an existing member's role or remove a member.
- [ ] [GAP] No tests exercise the add-member endpoint.
**Dependencies:** R6, cavekit-auth R1

## Out of Scope
- Changing an existing member's role
- Removing a member from a project
- Transferring project ownership
- Project archival or soft-delete
- Public or link-shared projects
- Project-level audit log

## Source Traceability
- apps/api/src/routes/projects.ts
- apps/api/prisma/schema.prisma (Project, ProjectMember)

## Cross-References
- See also: cavekit-auth.md
- See also: cavekit-profile.md
- See also: cavekit-knowledge.md
- See also: cavekit-tasks.md

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
