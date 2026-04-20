---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: medium
---

# Cavekit: Project Profile

## Scope
Structured description of a project's brand, audience, product, and content constraints. The profile is the canonical input that agent executions consume when producing marketing outputs. This domain covers reading, fully replacing, and partially updating the profile of a project.

## Requirements

### R1: Profile Retrieval
**Description:** A project member can read the current profile for a project.
**Acceptance Criteria:**
- [ ] Member request returns HTTP 200 with the stored profile when a profile exists.
- [ ] Member request returns HTTP 404 with a distinguishable error code when no profile has been created for the project.
- [ ] Non-member request returns HTTP 404 without revealing whether a profile exists.
- [ ] Unauthenticated request returns HTTP 401.
**Dependencies:** cavekit-projects R6

### R2: Tier 1 Required Fields
**Description:** A profile cannot be created without the core fields that identify the business and its market.
**Acceptance Criteria:**
- [ ] Full replacement (PUT) fails with HTTP 400 if any of companyName, description, niche, or geography are missing.
- [ ] companyName accepts up to 200 characters and rejects longer input.
- [ ] description requires at least 10 characters and rejects input longer than 2000 characters.
- [ ] niche accepts up to 200 characters.
- [ ] geography accepts up to 200 characters and defaults to "Russia" when not supplied.
**Dependencies:** R1

### R3: Tier 2 Recommended Fields
**Description:** Optional structured fields describe the product, audience, competitors, tone, and reference material used by agents.
**Acceptance Criteria:**
- [ ] products, audience (with segment, portrait, pain_points), usp, competitors (each with name, optional url, positioning), tov (ToneOfVoice enum), keywords, forbidden, and references (each with url and description) are all accepted on write.
- [ ] tov only accepts values from the defined ToneOfVoice enum; other values return HTTP 400.
- [ ] competitors entries without a name are rejected.
- [ ] references entries without both url and description are rejected.
**Dependencies:** R2

### R4: Tier 3 Optional Fields
**Description:** Channel-level and performance-level context may optionally be attached.
**Acceptance Criteria:**
- [ ] websiteUrl, socialLinks (with optional instagram, telegram, vk, youtube), kpi (with optional cac, ltv, conversion_rate, avg_check), and existingContent are accepted when supplied.
- [ ] existingContent rejects input longer than 5000 characters.
- [ ] Omitting all Tier 3 fields is permitted on both full replacement and partial update.
**Dependencies:** R2

### R5: Full Replacement
**Description:** PUT replaces the full profile atomically.
**Acceptance Criteria:**
- [ ] PUT from an OWNER or MEMBER with valid Tier 1 fields returns HTTP 200 with the stored profile.
- [ ] PUT from a VIEWER is rejected.
- [ ] PUT from a non-member returns HTTP 404.
- [ ] PUT with Tier 1 violations returns HTTP 400 before any data is written.
**Dependencies:** R2, R3, R4

### R6: Partial Update
**Description:** PATCH updates only the fields supplied in the request and preserves all other fields.
**Acceptance Criteria:**
- [ ] PATCH with a subset of fields returns HTTP 200 and leaves unsupplied fields unchanged.
- [ ] PATCH from a VIEWER is rejected.
- [ ] PATCH with a value that violates field-level constraints (length, enum) returns HTTP 400.
- [ ] [GAP] The PATCH endpoint exists in the implementation but is not documented in the external API specification.
**Dependencies:** R3, R4

### R7: Profile Prerequisite for Execution
**Description:** Agent executions cannot start without a populated profile.
**Acceptance Criteria:**
- [ ] Attempting to execute a task when no profile exists returns an error response whose error code is PROFILE_MISSING.
- [ ] The check applies even if the task itself has already been created and scored.
**Dependencies:** cavekit-tasks R5

## Out of Scope
- Versioning or history of profile changes
- Validation of URL reachability or social link ownership
- Machine translation or localization of profile content
- Bulk import/export of profiles

## Source Traceability
- apps/api/src/routes/profile.ts
- apps/api/prisma/schema.prisma (ProjectProfile)

## Cross-References
- See also: cavekit-projects.md
- See also: cavekit-tasks.md
- See also: cavekit-orchestration.md

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
