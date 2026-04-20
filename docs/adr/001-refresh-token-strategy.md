# ADR-001: Refresh Token Strategy

**Date**: 2026-04-19
**Status**: accepted

## Context

`POST /auth/refresh` is required by API spec but not implemented.
Current JWT setup: single secret, `expiresIn: '7d'` for all tokens, no `type` claim.

Access tokens valid 7 days → no way to distinguish access from refresh tokens.

## Decision

Use **JWT type claims** to differentiate access and refresh tokens. No new DB column required.

- `accessToken`: `{ sub, email, type: 'access' }`, expires **15 min**
- `refreshToken`: `{ sub, email, type: 'refresh' }`, expires **7 days**
- Same JWT secret for both (one plugin, one verify path)
- `authenticate` decorator rejects tokens where `type === 'refresh'`
- `POST /auth/refresh` rejects tokens where `type !== 'refresh'`

Rotation: each refresh call issues a new pair (access + refresh).

## Consequences

**Good:**
- No DB migration, no new table
- Stateless — scales horizontally
- Short-lived access tokens reduce blast radius of token leak

**Bad / Trade-offs:**
- No server-side revocation (logout doesn't invalidate existing tokens)
- If refresh token leaked, attacker has 7-day window
- Future revocation requires adding `jti` + blocklist (Redis)

## Alternatives Considered

### Option A: Opaque refresh token stored in DB
Random token hashed with bcrypt, stored in `users.refresh_token_hash`.
**Rejected because**: requires DB migration + lookup by token not possible without secondary index or userId-prefixed token. More complex for initial implementation.

### Option B: Keep `7d` access tokens, skip refresh
**Rejected because**: API spec requires refresh endpoint; long-lived access tokens are a security liability.

### Option C: Separate refresh secret
Use `JWT_REFRESH_SECRET` env var for a different HMAC key.
**Not selected now**: adds config complexity. Can be added when revocation (jti) is implemented.
