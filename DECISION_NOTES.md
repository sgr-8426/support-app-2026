# Part 2 — SLA Breach Tracking: Decision Notes

> **Author:** Sagar  
> **Date:** 2026-10-09  
> **Application:** Meridian Helpdesk  
> **Topic:** Design and implementation choices for SLA breach tracking  

---

## 1. Overview

The assessment specification requires implementing SLA breach tracking based on priority targets configured in `server/src/config.js` (`P1: 4h`, `P2: 24h`, `P3: 72h`). The brief intentionally leaves key product and technical specifications open to interpretation. 

This document details the ambiguities identified in the brief, the architectural and product decisions made, the operational rationale behind them, and how Part 1 findings influenced the implementation.

---

## 2. Specification Gaps and Decisions

### 2.1 What constitutes a qualifying "response"?

* **Ambiguity:**  
  The draft specification states that a ticket is breached if *"it has not received a response within its target."* It does not define what counts as a "response"—whether any comment suffices, whether requester comments count, or whether internal agent notes count.

* **Decision:**  
  A qualifying response is defined strictly as the **first public comment (`is_internal = 0`) authored by a user with role `agent` or `admin`**. Requester comments and internal notes do not satisfy the SLA.

* **Rationale:**  
  In industry-standard helpdesk workflows (e.g., ITIL Service Management, Zendesk First Reply Time, Jira Service Desk), SLAs represent a contractual responsiveness guarantee made to the customer. 
  1. **Requester comments:** A customer adding further details or asking "Any update?" on their own ticket does not fulfill the support team's duty to respond; treating requester comments as responses would allow tickets to appear compliant when the customer was actually ignored.
  2. **Internal comments (`is_internal = 1`):** Internal notes are private collaboration between agents; the customer never sees them. Therefore, an internal note cannot be considered a customer-facing response. Only a public comment from support staff fulfills the SLA commitment.

---

### 2.2 Breach lifecycle: Do resolved or closed tickets remain breached?

* **Ambiguity:**  
  The specification does not clarify whether a ticket that previously passed its deadline remains permanently "breached" once an agent eventually responds, or after the ticket is resolved or closed.

* **Decision:**  
  Breach status is **active-queue-centric**: only active tickets (`open` or `pending`) that have not yet received a qualifying agent response are evaluated as breached. Once an agent replies or the ticket is resolved/closed, it is no longer marked as breached in the active operational view.

* **Rationale:**  
  The primary operational objective stated by the brief is: *"The support team wants to identify tickets that have gone too long without a response."* Support teams use this view as a triage tool to surface tickets requiring immediate intervention right now. If tickets that were already handled or closed remained flagged as breached in this view, the triage list would become noisy and unusable (alert fatigue).

---

### 2.3 SQL vs. Application-Layer SLA Computation

* **Ambiguity:**  
  The specification does not specify whether breach calculation should happen in the database or in Node.js application memory.

* **Decision:**  
  SLA computation is executed **directly in the SQL query** using dynamic expressions in the `SELECT` and `WHERE` clauses.

* **Rationale:**  
  Meridian Helpdesk uses server-side pagination (`LIMIT 20 OFFSET ?`) and returns a database-level `total` count. If SLA calculations were performed in Node.js memory after fetching 20 rows:
  1. The `?breached=true` filter would filter out non-breached rows *after* the `LIMIT 20`, causing pages to return fewer than 20 items (or even 0 items) despite hundreds of breached tickets existing in the database.
  2. The `total` ticket count displayed in the pagination bar would be completely wrong.
  
  Computing the condition in SQL ensures `total`, pagination, and sorting function correctly.

---

### 2.4 API Response Structure

* **Ambiguity:**  
  The specification requires exposing SLA state in both list and detail endpoints, but leaves the data schema unspecified.

* **Decision:**  
  Every ticket returned by `GET /api/tickets` (list), `GET /api/tickets/:id` (detail), `POST /api/tickets` (create), and `PATCH /api/tickets/:id/assign` (assign) includes a top-level boolean field:
  ```json
  "is_breached": true
  ```
  The list endpoint also accepts an optional query filter: `GET /api/tickets?breached=true`.

* **Rationale:**  
  A clean boolean attribute seamlessly extends the existing ticket schema without introducing nested complexity or breaking existing frontend contracts.

---

### 2.5 Client-Side Filter Control and UI Presentation

* **Ambiguity:**  
  The brief requires adding a control to filter breached tickets and displaying a red badge, without prescribing the UI layout.

* **Decision:**  
  1. **Control:** Added a dedicated `[x] Breached only` checkbox in the `.filters` bar of `TicketList.jsx`. Toggling it triggers an API request with `breached=true` and resets the page to 1.
  2. **Badges:** Added a distinct red badge (`.badge-breached`) displaying `Breached` beside the ticket title on table rows, and `SLA Breached` in the `<h1>` header on the detail page.

* **Rationale:**  
  A dedicated checkbox allows users to combine filters (e.g. search for specific subjects, filter by priority, while filtering for breached tickets).

---

## 3. Relationship to Part 1 Findings

1. **Finding 8 (Client-side filters do not trigger re-fetch):**  
   In Part 1, Finding 8 documented that `TicketList.jsx` only tracked `[page]` in its `useEffect` dependency array, meaning changes to existing filters (`search`, `status`, `priority`) did not trigger an automatic re-fetch until pagination changed. To strictly obey the constraint to **fix only the top 5 findings**, we did not modify the existing filters. However, for our newly introduced `breachedOnly` filter, we ensured it includes its state in the `useEffect` dependencies (`[page, breachedOnly]`) and resets `page` to 1 upon toggle.

2. **Finding 1 (SQL Injection):**  
   When adding the `breached=true` filter to `ticketService.js`, we avoided dynamic string concatenation. The breach condition uses parameterized/whitelisted logic and strictly validates the incoming query parameter (`breached === 'true'`).

3. **Finding 4 (Tenant Isolation / Org-Scoping):**  
   The SQL breach calculation condition was designed to nest cleanly inside the existing `where.push('t.org_id = ?')` clause, ensuring cross-tenant boundaries are strictly maintained when filtering or viewing breached tickets.

---

## 4. Test Suite and Rationale for Selected Cases

To verify correctness and prevent regressions without introducing external testing dependencies (adhering to the zero-dependency constraint), we added an automated test script (`server/scripts/test-sla.js`, executable via `npm test` in `/server`):

1. **SLA Configuration Binding (`config.slaTargets`):**  
   *Why tested:* Ensures that SLA deadlines are dynamically driven by `server/src/config.js` (`P1: 4`, `P2: 24`, `P3: 72`) rather than hardcoded magic numbers.
2. **SQL Injection Resilience (Part 1 Regression):**  
   *Why tested:* Passes a SQL injection payload into `listTickets({ sortBy: 'id; DROP TABLE dummy --' })` to verify that our Part 1 whitelist falls back safely to `created_at` without executing arbitrary SQL.
3. **API Schema Contract (`is_breached: boolean` on all rows):**  
   *Why tested:* Asserts that every single ticket returned by the list endpoint carries a strictly typed boolean `is_breached` property.
4. **Breached Filter Integrity (`?breached=true`):**  
   *Why tested:* Validates that `breached=true` returns only breached tickets, that every returned row has `status IN ('open', 'pending')`, and that pagination totals reflect the filtered subset accurately.
5. **Ticket Detail Parity (`getTicketById`):**  
   *Why tested:* Confirms that the detail endpoint carries the exact same SLA evaluation as the list endpoint.
6. **Agent Response Edge Case (Ticket #9):**  
   *Why tested:* Ticket #9 in the seeded database has a public comment from an agent. This test confirms that our subquery recognizes qualifying responses and marks the ticket as not breached, validating that requesters and internal notes do not introduce false positives.
