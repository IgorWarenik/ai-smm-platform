---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: medium
---

# Cavekit: Auth

## Scope
User identity and session management for the platform. Covers registration, credentialed login, access/refresh token lifecycle, and the authenticated-user lookup that all other domains rely on. Does not cover third-party identity providers, password reset flows, or email verification.

## Requirements

### R1: User Registration
**Description:** A new user can create an account by supplying an email, a password, and an optional display name. The system must reject weak inputs and prevent duplicate email registration.
**Acceptance Criteria:**
- [ ] Request with valid email, password of at least 8 characters, and optional name returns HTTP 201 with an access token, a refresh token, and a user object containing id, email, and createdAt.
- [ ] Request with an email that already exists returns HTTP 409.
- [ ] Request with missing email, missing password, invalid email format, or password shorter than 8 characters returns HTTP 400.
- [ ] Created user record has a stored password hash (never the plaintext password).
- [ ] [GAP] The user record has an emailVerified flag, but no verification flow sets it to true.
**Dependencies:** none

### R2: Credentialed Login
**Description:** A registered user can exchange email and password for a fresh access/refresh token pair.
**Acceptance Criteria:**
- [ ] Request with a known email and matching password returns HTTP 200 with a new access token, refresh token, and user object.
- [ ] Request with an email not present in the system returns HTTP 401.
- [ ] Request with a correct email but wrong password returns HTTP 401.
- [ ] Error responses for unknown email and wrong password are indistinguishable (same status, same shape).
**Dependencies:** R1

### R3: Refresh Token Exchange
**Description:** A valid refresh token can be exchanged for a new access/refresh token pair, allowing sessions to continue without re-entering credentials.
**Acceptance Criteria:**
- [ ] Request with a valid, unexpired refresh token returns HTTP 200 with a new access token and refresh token.
- [ ] Request carrying an access token in place of a refresh token returns HTTP 401.
- [ ] Request with a malformed or tampered token returns HTTP 401.
- [ ] Request with a refresh token whose user no longer exists returns HTTP 401.
- [ ] [GAP] No token revocation or blacklist exists; a leaked refresh token remains valid until natural expiry.
**Dependencies:** R1, R4

### R4: Access Token Semantics
**Description:** Access tokens authorize API calls, refresh tokens do not. Token type is enforced on every authenticated endpoint.
**Acceptance Criteria:**
- [ ] An access token has a 15-minute time-to-live.
- [ ] A refresh token has a 7-day time-to-live.
- [ ] A protected endpoint called with a refresh token returns HTTP 401.
- [ ] A protected endpoint called with an expired access token returns HTTP 401.
- [ ] A protected endpoint called without any token returns HTTP 401.
- [ ] [GAP] Architecture docs describe RS256 asymmetric signing, but the running implementation uses a symmetric algorithm.
**Dependencies:** none

### R5: Authenticated User Lookup
**Description:** A client can retrieve the profile of the currently authenticated user.
**Acceptance Criteria:**
- [ ] Request with a valid access token returns HTTP 200 with the user object (id, email, name, createdAt, emailVerified).
- [ ] Request without any token returns HTTP 401.
- [ ] Request with a refresh token returns HTTP 401.
- [ ] Request with a valid access token whose user has since been deleted returns HTTP 404.
**Dependencies:** R4

## Out of Scope
- Email verification delivery and confirmation flow
- Password reset or change endpoints
- OAuth or single sign-on
- Token revocation, blacklist, or forced logout
- Rate limiting of login attempts
- Multi-factor authentication

## Source Traceability
- apps/api/src/routes/auth.ts
- apps/api/src/plugins/jwt.ts
- apps/api/tests/unit/auth.test.ts
- apps/api/tests/integration/auth.test.ts

## Cross-References
- See also: cavekit-projects.md (membership checks rely on R5 identity)
- See also: cavekit-tokens.md (separate concept — LLM token budgets, not JWTs)

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
