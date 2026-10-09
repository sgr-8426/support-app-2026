# Code Review — Meridian Helpdesk

> **Reviewer:** Sagar  
> **Date:** 2026-10-09  
> **Scope:** Full codebase review of the Meridian Helpdesk starter application  

---

## Priority Ranking (Highest → Lowest)

| Rank | Finding | Fixed? |
|------|---------|--------|
| 1 | SQL Injection via unsanitised `sortBy` / `order` in ticket list query | ✅ Fixed |
| 2 | Stored XSS via `dangerouslySetInnerHTML` on comment bodies | ✅ Fixed |
| 3 | Invite endpoint stores plaintext password (no bcrypt hashing) | ✅ Fixed |
| 4 | Missing organisation-scoping on ticket detail, delete, and assign endpoints | ✅ Fixed |
| 5 | Missing `requireRole('admin')` guard on the DELETE ticket route | ✅ Fixed |
| 6 | Off-by-one error in pagination offset calculation | Documented only |
| 7 | N+1 query problem when fetching comment counts for the ticket list | Documented only |
| 8 | Client-side filters do not trigger data re-fetch | Documented only |
| 9 | Database credentials committed to version control | Documented only |

---

## Finding 1 — SQL Injection via `sortBy` and `order` ✅ FIXED

**Location:** `server/src/services/ticketService.js`, line 38  
**Severity:** Critical

**Problem:**  
The `sortBy` and `order` parameters from the HTTP query string are interpolated directly into the SQL query using a JavaScript template literal:
```js
ORDER BY t.${sortBy} ${order}
```
These values are never validated. An attacker can pass arbitrary SQL fragments through the `sortBy` or `order` query parameters (e.g. `sortBy=id;DROP TABLE tickets--`), which will be executed by the database.

**Concrete impact:**  
A logged-in user of *any* role can extract, modify, or destroy data from any table in the database — including data belonging to other organisations — by crafting a malicious `sortBy` or `order` value in the ticket list request.

**Proposed fix:**  
Whitelist the allowed column names and sort directions. Reject any value that is not in the whitelist:
```js
const ALLOWED_SORT = ['created_at', 'updated_at', 'priority', 'status'];
const ALLOWED_ORDER = ['asc', 'desc'];
const safeSortBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
const safeOrder = ALLOWED_ORDER.includes(order) ? order : 'desc';
```

---

## Finding 2 — Stored XSS via `dangerouslySetInnerHTML` ✅ FIXED

**Location:** `client/src/features/tickets/TicketDetail.jsx`, line 65  
**Severity:** Critical

**Problem:**  
Comment bodies are rendered using React's `dangerouslySetInnerHTML`:
```jsx
<div dangerouslySetInnerHTML={{ __html: c.body }} />
```
The comment body is user-supplied plain text that is never sanitised. Any user can submit a comment containing `<script>` tags or event handlers (e.g. `<img onerror="...">`) that will execute in every other user's browser when they view the ticket.

**Concrete impact:**  
An attacker (even a `requester` with no special privileges) can steal session tokens from agents and admins who view the ticket, hijack their sessions, or perform actions on their behalf. Because the JWT is stored in `localStorage` (see `store.js` line 12), it is accessible to injected scripts. This is a stored/persistent XSS — the payload executes every time any user views the ticket detail page.

**Proposed fix:**  
Remove `dangerouslySetInnerHTML` and render the body as plain text. Comment bodies in this application are plain text, not rich HTML:
```jsx
<div>{c.body}</div>
```

---

## Finding 3 — Invite Endpoint Stores Plaintext Password ✅ FIXED

**Location:** `server/src/routes/auth.js`, line 49  
**Severity:** Critical

**Problem:**  
The `/api/auth/invite/accept` endpoint stores the raw password string directly into the `password_hash` column without hashing it:
```js
await query('UPDATE users SET password_hash = ? WHERE id = ?', [password, userId]);
```
The login endpoint (`/api/auth/login`, line 20) uses `bcrypt.compare`, which will fail against a plaintext string, so any user who accepts an invitation will be permanently locked out.

**Concrete impact:**  
1. Any user who accepts an invitation through the invite flow will have their raw password stored in the database, creating a data breach if the database is ever compromised.  
2. The user will be unable to log in afterwards because `bcrypt.compare(password, plaintextStoredValue)` always returns `false`.  
3. This bug can only be found by reading the code — it is not observable through the normal UI because the invite flow is not exposed in the existing client.

**Proposed fix:**  
Hash the password with bcrypt before storing it:
```js
const hash = await bcrypt.hash(password, 10);
await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
```

---

## Finding 4 — Missing Organisation-Scoping on Ticket Detail, Delete, and Assign ✅ FIXED

**Location:**  
- `server/src/routes/tickets.js`, lines 31–41 (GET /:id)  
- `server/src/routes/tickets.js`, lines 62–72 (PATCH /:id/assign)  
- `server/src/routes/tickets.js`, lines 75–83 (DELETE /:id)  
- `server/src/services/ticketService.js`, lines 57–67 (`getTicketById` — no org filter)

**Severity:** High

**Problem:**  
The `getTicketById` function fetches a ticket by its primary key without checking the requesting user's `orgId`. The ticket detail, assign, and delete routes all use this function, so any authenticated user can:
- Read any ticket from any organisation by guessing or enumerating ticket IDs.
- Assign themselves to another organisation's ticket.
- Delete another organisation's ticket (if the admin guard were present, which it is not — see Finding 5).

The ticket *list* endpoint correctly filters by `org_id`, so this is a targeted gap in the detail/mutation routes. The comments route (`comments.js` line 16) correctly checks `ticket.org_id !== req.user.orgId`, proving this was an oversight elsewhere.

**Concrete impact:**  
Northwind Trading users can view, claim, and delete Cobalt Logistics tickets (and vice versa). This is a direct violation of the multi-tenant data isolation that the application is designed to provide, as described in the README: "They are separate customers and must not be able to see each other's tickets."

**Proposed fix:**  
Add `req.user.orgId` checks in each affected route handler after fetching the ticket:
```js
if (ticket.org_id !== req.user.orgId) {
  return res.status(404).json({ error: 'Not found' });
}
```
This mirrors the pattern already used in the comments route.

**Relationship to other findings:** Finding 5 (missing admin guard on DELETE) is a separate but related issue. Even after adding the admin guard, the org-scoping fix is still required to prevent cross-tenant deletion by admins of other organisations.

---

## Finding 5 — Missing `requireRole('admin')` Guard on DELETE Route ✅ FIXED

**Location:** `server/src/routes/tickets.js`, line 75  
**Severity:** High

**Problem:**  
The DELETE ticket route only uses `requireAuth` but not `requireRole('admin')`:
```js
router.delete('/:id', requireAuth, async (req, res, next) => { ... });
```
The README specifies that only admins can delete tickets. The route's own JSDoc comment on the `requireRole` function (in `middleware/auth.js` line 20) even shows the DELETE route as an example usage, but the actual route does not apply it.

**Concrete impact:**  
Any logged-in user — including `requester` accounts — can delete any ticket (subject to the org-scoping issue in Finding 4, they can delete tickets across organisations too). This breaks the role-based access control described in the README.

**Proposed fix:**  
Add the `requireRole('admin')` middleware to the delete route:
```js
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => { ... });
```

---

## Finding 6 — Off-by-One Error in Pagination Offset (Documented Only)

**Location:** `server/src/services/ticketService.js`, line 29  
**Severity:** Medium

**Problem:**  
The offset is calculated as `page * PAGE_SIZE` instead of `(page - 1) * PAGE_SIZE`. Since `page` starts at 1, the first page skips the first 20 results entirely.

**Concrete impact:**  
The first 20 tickets in each organisation are never shown in the ticket list. Users see page 1 starting from ticket 21. The total count is correct, but the actual rows are offset by one page.

**Proposed fix:**  
```js
const offset = (page - 1) * PAGE_SIZE;
```

---

## Finding 7 — N+1 Query for Comment Counts (Documented Only)

**Location:** `server/src/services/ticketService.js`, lines 44–47  
**Severity:** Medium

**Problem:**  
After fetching the ticket list, the code loops through each row and runs a separate `SELECT COUNT(*)` query to get the comment count:
```js
for (const row of rows) {
  const [{ c }] = await query('SELECT COUNT(*) AS c FROM comments WHERE ticket_id = ?', [row.id]);
  row.comment_count = c;
}
```
With 20 tickets per page, this creates 20 additional database round-trips per page load.

**Concrete impact:**  
Each ticket list request triggers 22 queries (1 for tickets, 20 for comment counts, 1 for total). As data grows, this becomes a significant performance bottleneck and adds latency to every page load.

**Proposed fix:**  
Use a subquery or `LEFT JOIN` with `GROUP BY` to fetch comment counts in a single query:
```sql
SELECT t.*, COUNT(c.id) AS comment_count
FROM tickets t LEFT JOIN comments c ON c.ticket_id = t.id
GROUP BY t.id
```

---

## Finding 8 — Client-Side Filters Do Not Trigger Re-Fetch (Documented Only)

**Location:** `client/src/features/tickets/TicketList.jsx`, line 31  
**Severity:** Medium

**Problem:**  
The `useEffect` that fetches ticket data only depends on `[page]`:
```js
useEffect(() => { ... }, [page]);
```
Changing the search input, status filter, priority filter, or sort dropdown updates the component state but does not trigger a new API request. The filters only take effect when the user changes pages.

**Concrete impact:**  
Users type a search term or select a filter, and nothing happens until they click a pagination button. This makes the filter controls appear broken.

**Proposed fix:**  
Add the filter state variables to the dependency array:
```js
useEffect(() => { ... }, [page, search, status, priority, sortBy]);
```
Optionally debounce the search input to avoid excessive requests while typing.

---

## Finding 9 — Database Credentials Committed to Version Control (Documented Only)

**Location:**  
- `server/.env`, line 5 (`DB_PASSWORD=Hd_pr0d_2026_Wq8x`)  
- `server/.env`, line 7 (`JWT_SECRET=8f2c1a94e77b4d51a6e0c3b9f4d2178a`)  
- `docker-compose.yml`, line 13 (`MYSQL_PASSWORD: Hd_pr0d_2026_Wq8x`)

**Severity:** Medium

**Problem:**  
The `.env` file containing the database password and JWT secret is tracked in version control. The `.gitignore` file only contains `node_modules` and does not exclude `.env`. The `docker-compose.yml` also hardcodes the same database password. The password format (`Hd_pr0d_2026_Wq8x`) suggests it may be a production credential.

**Concrete impact:**  
Anyone with access to the repository can see the database password and JWT secret. If these credentials are reused in staging or production, this is a security exposure. The JWT secret specifically enables forging authentication tokens.

**Proposed fix:**  
Add `.env` to `.gitignore`. Use the `.env.example` file (which already has blank values) as the template. Store actual credentials outside of version control.

---

*End of code review.*
