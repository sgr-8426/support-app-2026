# Meridian Helpdesk — Assessment Submission Guide

> **Candidate:** Sagar  
> **Submission Date:** October 2026  
> **Exercise:** Bilions Full Stack Developer Internship Practical Exercise  
> **Application:** Meridian Helpdesk  

Welcome! This document provides an all-in-one guide to this submission. It explains the project architecture, git branch structure, atomic commits, verification commands, and full rationale for all engineering choices made across Part 1 and Part 2.

This file is intentionally committed across all git branches (`master`, `part1-fixes`, `part2-sla`) so that you can reference it immediately regardless of which branch you check out.

---

## 1. Quick Navigation & Deliverables Index

All four deliverables required by the assessment brief are included in this repository:

| Deliverable | Description | Location |
|---|---|---|
| **Deliverable 1** | **Repository & Git History** | Full codebase with separable branches (`master`, `part1-fixes`, `part2-sla`) |
| **Deliverable 2** | **Written Code Review** | [`CODE_REVIEW.md`](./CODE_REVIEW.md) (on `part1-fixes` and `part2-sla`) |
| **Deliverable 3** | **Part 2 Decision Notes** | [`DECISION_NOTES.md`](./DECISION_NOTES.md) (on `part2-sla`) |
| **Deliverable 4** | **AI Usage & Disclosure Log** | [`AI_LOG.md`](./AI_LOG.md) (on `part2-sla`) |

---

## 2. Git Branch Structure & Separability

The assessment brief explicitly instructs:
> *"Commit the fixes so they are separable from your Part 2 work — separate commits, or a clearly named branch or folder."*

To make inspecting each part of the assessment completely seamless, the git history is structured into three branches:

```
* 6521525 (part2-sla) Tests: Add automated test suite for SLA verification and update decision notes
* e7b883a Part-2: Implement SLA breach tracking with Decision Notes and AI Log
* 14144e0 (part1-fixes) Fix #5: Enforce admin role requirement on DELETE /tickets/:id
* 57879f4 Fix #4: Enforce organization tenant isolation on ticket detail, assign, and delete
* 31a3bdd Fix #3: Hash password with bcrypt in /invite/accept endpoint
* 5a0ff57 Fix #2: Prevent Stored XSS by rendering comment bodies as plain text
* d972fc7 Fix #1: Prevent SQL injection in sortBy/order via whitelist validation
* 1c13cde Part-1: Code Review Markdown Added
* c10c293 (master) Initial given codebase
```

### How to Inspect Each Component Individually

1. **To view ONLY the Part 1 Code Review & 5 Fixes:**
   ```bash
   git checkout part1-fixes
   # Or view the isolated diff against the starter code:
   git diff master..part1-fixes
   ```
   *Note: Each of the 5 fixes has its own atomic commit explaining the problem and fix.*

2. **To view ONLY the Part 2 SLA Feature Work:**
   ```bash
   git diff part1-fixes..part2-sla
   ```

3. **To run and test the complete application (Part 1 fixes + Part 2 feature):**
   ```bash
   git checkout part2-sla
   ```

---

## 3. How to Run and Test

### 3.1 Start Database & Seed Deterministic Data
```bash
docker compose up -d
cd server && npm install && npm run db:reset
```
*Note: `npm run db:reset` seeds 2 organisations (Northwind Trading & Cobalt Logistics), 30 users, 240 tickets, and 551 comments. All accounts use password `Password123!`.*

### 3.2 Run the Automated Verification Test Suite
We built a deterministic verification test suite in `server/scripts/test-sla.js` using Node’s built-in `node:assert/strict` (zero external dependencies):
```bash
cd server
npm test
```
**What the test suite verifies:**
1. Dynamic binding to `slaTargets` in `server/src/config.js` (`P1: 4h`, `P2: 24h`, `P3: 72h`).
2. SQL injection regression test: ensures malicious `sortBy` payloads are safely neutralized.
3. API contract verification: asserts `is_breached: boolean` is present on every returned ticket row.
4. Breached filter verification: confirms `?breached=true` returns only active, breached tickets and accurate counts (38 breached tickets for Org 1).
5. Parity between list and detail endpoints (`getTicketById`).
6. Edge-case verification: confirms Ticket #9 (which has a public agent response) is marked `is_breached: false`.

### 3.3 Start the Dev Servers
```bash
# Terminal 1: Backend API on port 4000
cd server && npm run dev

# Terminal 2: React Vite Client on port 5173
cd client && npm run dev
```

### 3.4 Visual UI Verification
1. Navigate to `http://localhost:5173/` and sign in as `agent1@northwind.test` (password: `Password123!`).
2. **Ticket List:** Breached tickets prominently display a red **`Breached`** badge.
3. **Filter Control:** Toggle the **`[x] Breached only`** checkbox in the filters toolbar to filter down to breached tickets in real-time.
4. **Ticket Detail:** Click any breached ticket to view the red **`SLA Breached`** badge in the detail page header.

---

## 4. Part 1 — Code Review Summary & The Five Fixes

We identified 9 distinct issues, ranked strictly by business risk and security severity:

| Rank | Finding | File & Line | Severity | Action Taken |
|:---:|---|---|:---:|:---:|
| **1** | **SQL Injection via `sortBy` / `order`** | `server/src/services/ticketService.js:45` | Critical | **Fixed** (`d972fc7`) |
| **2** | **Stored XSS in Comment Bodies** | `client/src/features/tickets/TicketDetail.jsx:65` | Critical | **Fixed** (`5a0ff57`) |
| **3** | **Plaintext Passwords in `/invite/accept`** | `server/src/routes/auth.js:49` | Critical | **Fixed** (`31a3bdd`) |
| **4** | **Missing Tenant Isolation (Org-Scoping)** | `server/src/routes/tickets.js:31-84` | High | **Fixed** (`57879f4`) |
| **5** | **Missing `requireRole('admin')` on DELETE** | `server/src/routes/tickets.js:76` | High | **Fixed** (`14144e0`) |
| 6 | Pagination offset off-by-one (`page * 20`) | `server/src/services/ticketService.js:36` | Medium | Documented only |
| 7 | N+1 queries when fetching comment counts | `server/src/services/ticketService.js:51-54` | Medium | Documented only |
| 8 | Client filters do not trigger re-fetch | `client/src/features/tickets/TicketList.jsx:31` | Medium | Documented only |
| 9 | Database credentials committed in repo | `server/.env:5`, `docker-compose.yml:13` | Medium | Documented only |

### Why Findings 6–9 Were Left Documented But Untouched
The brief explicitly tests prioritization:
> *"Do not fix everything. Five. We are testing prioritisation, and a candidate who quietly fixes fifteen has told us they cannot be trusted with a deadline."*

We fixed the 3 critical vulnerabilities and the 2 access control/tenant isolation flaws. Findings 6 through 9 are thoroughly documented in [`CODE_REVIEW.md`](./CODE_REVIEW.md) with reproduction steps and proposed solutions.

---

## 5. Part 2 — SLA Breach Tracking Decisions & Architecture

The draft specification was intentionally incomplete. Here are the product decisions made, their rationale, and architectural implementation:

### 5.1 What constitutes a qualifying "response"?
* **Decision:** Defined as the first **public comment (`is_internal = 0`)** authored by an **`agent` or `admin`**.
* **Rationale:** Follows ITIL and industry helpdesk standards (Zendesk, Jira). Requesters adding comments or asking "Any updates?" cannot satisfy the support team's SLA commitment. Similarly, internal staff notes (`is_internal = 1`) are private and invisible to the customer, so they do not constitute a customer response.

### 5.2 Active-Queue Lifecycle
* **Decision:** Only active tickets (`open` or `pending`) without an agent response are considered breached. Once answered or resolved/closed, the ticket leaves the active breach queue.
* **Rationale:** The business goal stated by the PM is: *"Support wants to know which tickets have gone unanswered too long... support needs to see it."* This is an operational triage tool. Keeping resolved/answered tickets in the breach filter causes alert fatigue and clutters urgent triage queues.

### 5.3 SQL-Layer vs. In-Memory Calculation
* **Decision:** Evaluated directly in MySQL using `WHERE` and `SELECT` clauses with subqueries.
* **Rationale:** The application uses server-side pagination (`LIMIT 20 OFFSET ?`) and returns a database `total` count. Evaluating breaches in JavaScript after fetching 20 rows would result in pages returning fewer than 20 rows and corrupt the total count in the pagination bar. Evaluating in SQL ensures pagination and sorting are 100% accurate.

### 5.4 API Schema & UI Integration
* **API:** Returns `is_breached: boolean` on all ticket endpoints (`GET /tickets`, `GET /tickets/:id`, `POST /tickets`, `PATCH /tickets/:id/assign`). Supports `?breached=true` filter on the list endpoint.
* **UI:** Added an accessible `[x] Breached only` checkbox control in `TicketList.jsx` and red `.badge-breached` badges in list and detail views.
* **Connection to Finding 8:** Finding 8 documented that `TicketList.jsx` only watched `[page]` in its `useEffect`. While we left existing filters untouched to respect the 5-fix ceiling, we ensured our new `breachedOnly` filter includes itself in the dependency array (`[page, breachedOnly]`) and resets `page` to 1 upon toggle.

---

## 6. AI Tool Usage Disclosure Summary (Deliverable 4)

We used the **Antigravity AI Assistant** (Claude Opus 4.6 & Gemini 3.8 Flash) for codebase navigation, scanning for vulnerability patterns, and generating test boilerplate.

In accordance with the brief's requirement to detail where AI was wrong or misleading, three specific errors were detected and corrected:
1. **Flawed in-memory filtering:** The AI initially proposed filtering breached tickets in Node.js memory. We rejected this because it breaks database pagination (`LIMIT 20`) and total counts.
2. **Attempting to over-fix Part 1:** The AI tried to add all filter state variables into `useEffect`, which would have silently fixed Finding 8 and violated the strict 5-fix limit. We instructed it to keep Finding 8 untouched.
3. **Naïve SLA response definition:** The AI initially considered any row in `comments` as an SLA response, missing requester comments and internal notes. We corrected this to require `u.role IN ('agent', 'admin') AND c.is_internal = 0`.
Full details are documented in [`AI_LOG.md`](./AI_LOG.md).
