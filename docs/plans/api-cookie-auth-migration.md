# API: Migrate auth from Bearer token to HttpOnly cookie

## Context

The Jninty frontend has been updated to use HttpOnly cookies for authentication instead of localStorage + Authorization headers. The frontend now:

- Sends `credentials: "include"` on all fetch requests (including PouchDB CouchDB replication)
- Expects the server to set auth cookies via `Set-Cookie` headers on login/activate
- Calls `POST /auth/logout` to clear cookies on sign-out
- Reads a non-HttpOnly `jninty_logged_in` companion cookie to detect login state client-side
- Falls back to `Authorization: Bearer <token>` from localStorage during the migration period (~7 days), then removes it

The API needs to be updated to match.

---

## 1. Cookie helper

Create a reusable helper for setting/clearing the two auth cookies. Every endpoint that issues or revokes a session must use this helper.

### Set cookies (on login/activate/refresh)

```
Set-Cookie: jninty_auth_token=<jwt>;
  Domain=.jninty.com;
  Path=/;
  Secure;
  HttpOnly;
  SameSite=Lax;
  Max-Age=604800

Set-Cookie: jninty_logged_in=true;
  Domain=.jninty.com;
  Path=/;
  Secure;
  SameSite=Lax;
  Max-Age=604800
```

Notes:
- `jninty_auth_token` is HttpOnly — JS cannot read it, only the browser sends it
- `jninty_logged_in` is NOT HttpOnly — the frontend reads it via `document.cookie` to know whether to call `/auth/me` on page load
- Both share the same `Max-Age` (7 days) and `Domain=.jninty.com` so they're available on `app.jninty.com` and `jninty.com`
- In local development (localhost), omit `Domain` and `Secure` flags, or use `SameSite=Lax; Secure` with HTTPS via a local cert

### Clear cookies (on logout)

```
Set-Cookie: jninty_auth_token=; Domain=.jninty.com; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0
Set-Cookie: jninty_logged_in=; Domain=.jninty.com; Path=/; Secure; SameSite=Lax; Max-Age=0
```

---

## 2. Endpoints to update

### `POST /auth/login`

**Current behavior:** Returns `{ token, user }` in the response body.

**New behavior:**
- Set both cookies (see helper above)
- Response body: `{ user }` — the token no longer needs to be in the body
- You MAY still include `token` in the body during migration for backward compatibility with older frontend versions, but it is not required

### `POST /auth/activate?session_id=<id>`

**Current behavior:** Returns `{ token, user }` after Stripe checkout verification.

**New behavior:**
- Set both cookies
- Response body: `{ user }`
- Same migration note as login

### `POST /auth/logout` (NEW endpoint)

**Create this endpoint.** The frontend calls it on sign-out.

- Read `jninty_auth_token` from the request cookie
- Optionally invalidate the token server-side (e.g., add to a blocklist or delete the session)
- Clear both cookies (Max-Age=0)
- Response: `204 No Content` or `{ ok: true }`
- If no cookie is present, still return 204 (idempotent)

### `GET /auth/me`

**Current behavior:** Reads token from `Authorization: Bearer <token>` header.

**New behavior:**
- Primary: read token from `req.cookies.jninty_auth_token`
- Fallback: read from `Authorization: Bearer <token>` header (migration support)
- If the token came from the Authorization header and is valid, set both cookies in the response so the client transitions to cookie-based auth seamlessly
- Response body unchanged: `{ id, email, plan, subscriptionStatus, subscriptionEndsAt }` (or wrapped in `{ user: ... }`)

### Token refresh (if applicable)

If you have a token refresh endpoint or middleware that issues new tokens:
- Set both cookies with the new token
- Same `Max-Age=604800`

---

## 3. Auth middleware update

Update the middleware that extracts and validates the JWT to check both sources:

```
function extractToken(req):
  1. cookie = req.cookies["jninty_auth_token"]
     if cookie exists and is valid → return cookie
  2. header = req.headers["authorization"]
     if header starts with "Bearer " → return header.slice(7)
  3. return null (401)
```

Order matters: prefer the cookie (it's the new primary). The Authorization header is only for migration.

**After ~7 days post-deploy**, you can remove the Authorization header fallback from the middleware.

---

## 4. CORS configuration

The frontend sends `credentials: "include"`, which requires specific CORS headers:

```
Access-Control-Allow-Origin: https://app.jninty.com   (NOT "*")
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

Key rules:
- `Access-Control-Allow-Origin` MUST be an explicit origin, not `*`, when credentials are included
- If multiple origins need access (e.g., `https://app.jninty.com` and `https://jninty.com`), dynamically set the header based on the request's `Origin` header against an allowlist
- The CouchDB proxy endpoint (`/couchdb/:userId`) must also return these CORS headers since PouchDB replication uses `credentials: "include"`

---

## 5. CouchDB proxy / replication endpoint

`GET/POST /couchdb/:userId` — The PouchDB client now authenticates via cookie instead of Bearer header.

- The proxy must read the token from `req.cookies.jninty_auth_token` (same middleware as above)
- Ensure the CORS headers above are set on all CouchDB proxy responses, including `OPTIONS` preflight

---

## 6. Cookie parsing middleware

If not already installed, add cookie parsing middleware:

- **Express:** `app.use(require('cookie-parser')())` — gives you `req.cookies`
- **Hono:** Built-in `c.req.cookie('jninty_auth_token')`
- **Cloudflare Workers:** Parse from `request.headers.get('Cookie')` manually or use a helper

---

## 7. Login redirect from jninty.com

**Current behavior:** `jninty.com/login` redirects to `app.jninty.com?token=<value>` after login.

**New behavior:** Just redirect to `https://app.jninty.com` with no query parameter. The `Set-Cookie` header from the login API response (with `Domain=.jninty.com`) makes the cookie available on `app.jninty.com` automatically.

---

## 8. Security considerations

- **CSRF:** `SameSite=Lax` protects against CSRF for state-changing requests from third-party sites. For additional protection on sensitive mutations, consider adding a CSRF token (double-submit cookie pattern or synchronizer token).
- **Token in response body:** Stop including the JWT in response bodies once migration is complete. During migration, including it is acceptable.
- **Token in URLs:** Never put tokens in URLs or query parameters. The Stripe `session_id` is not a token — that's fine.
- **Logging:** Ensure the `jninty_auth_token` cookie value is not logged in access logs or error reporting.

---

## 9. Migration timeline

| Phase | Duration | What happens |
|-------|----------|-------------|
| Deploy API changes | Day 0 | API sets cookies on login/activate AND still accepts Bearer header |
| Deploy frontend changes | Day 0–1 | Frontend uses cookies primary, localStorage fallback |
| Migration period | Days 1–7 | Users with old sessions hit `/auth/me` with Bearer header, API responds with Set-Cookie to migrate them |
| Remove fallbacks | Day 7+ | Remove `Authorization` header fallback from API middleware. Frontend removes localStorage fallback code. |

---

## 10. Testing checklist

- [ ] `POST /auth/login` → response includes `Set-Cookie` for both `jninty_auth_token` (HttpOnly) and `jninty_logged_in` (not HttpOnly)
- [ ] `POST /auth/activate?session_id=...` → same cookie behavior
- [ ] `POST /auth/logout` → both cookies cleared (Max-Age=0), returns 204
- [ ] `GET /auth/me` with cookie → returns user, 200
- [ ] `GET /auth/me` with Bearer header (no cookie) → returns user + sets cookies (migration)
- [ ] `GET /auth/me` with no auth → 401
- [ ] CORS preflight (`OPTIONS`) returns `Access-Control-Allow-Credentials: true` with explicit origin
- [ ] CouchDB proxy works with cookie auth
- [ ] Cookies are scoped to `Domain=.jninty.com` (visible on both `app.jninty.com` and `jninty.com`)
- [ ] `jninty_auth_token` is not readable by `document.cookie` (HttpOnly flag works)
- [ ] `jninty_logged_in` IS readable by `document.cookie`
- [ ] Logout from `app.jninty.com` clears cookies on `jninty.com` too
