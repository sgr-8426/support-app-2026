# Deliverable 4 — AI Log: Usage and Collaboration Record

> **Author:** Sagar  
> **Date:** 2026-10-09  
> **Application:** Meridian Helpdesk  
> **Subject:** Disclosure of AI tools used during the assessment  

---

## 1. AI Assistants Used

During this exercise, I used the **Antigravity AI Assistant** (utilising Claude Opus 4.6 and Gemini 3.8 Flash foundation models) integrated into the IDE as a pair-programming partner.

---

## 2. Tasks Entrusted to the AI

I collaborated with the AI assistant on the following phases of the assessment:

1. **Codebase Exploration:** Rapidly cataloging the codebase architecture across `/server`, `/client`, and `/db`.
2. **Security Vulnerability Auditing:** Scanning routes and database services for common vulnerabilities (SQL injection, XSS, broken access control, authentication flaws).
3. **Drafting Initial Findings & Impact Descriptions:** Formulating the preliminary descriptions and concrete impact statements for Part 1 findings.
4. **Brainstorming SLA Specification Gaps:** Identifying ambiguous points in the intentionally incomplete Part 2 SLA brief.
5. **Writing Verification Scripts:** Generating automated test scripts (`scratch/test_sla.js`, `scratch/test_e2e.js`) to verify MySQL queries and API responses deterministically against the seeded data.

---

## 3. Where AI Responses Were Wrong, Incomplete, or Misleading

As noted in the assessment brief, AI outputs frequently contain subtle architectural flaws or policy misalignments that require close human review and correction. Below are specific instances where the AI generated incorrect or suboptimal proposals:

### 3.1 Flawed Proposal: In-Memory JavaScript Filtering for SLA Breaches
* **The AI's suggestion:**  
  When first asked how to implement the `?breached=true` filter, the AI suggested fetching rows normally from the database and using JavaScript's `.filter(row => row.is_breached)` in the service layer before returning the response.
* **The problem:**  
  I caught that doing in-memory filtering on paginated data completely breaks the API contract. Because the database query executes `LIMIT 20 OFFSET ?`, filtering out rows in Node.js would result in page 1 returning fewer than 20 rows (or even 0 rows) even if dozens of breached tickets existed on later pages. Furthermore, the `total` count in the pagination bar would show the total of all tickets rather than the total of breached tickets.
* **Correction:**  
  I directed the AI to implement the entire breach logic directly in the MySQL `WHERE` and `SELECT` clauses so that SQL handles pagination and counts accurately.

---

### 3.2 Violation of Assessment Constraints: Temptation to "Over-Fix" Part 1
* **The AI's suggestion:**  
  While updating `client/src/features/tickets/TicketList.jsx` for the Part 2 SLA filter, the AI proposed adding all filter state variables (`[page, search, status, priority, sortBy, breachedOnly]`) into the `useEffect` dependency array.
* **The problem:**  
  Finding 8 in our Code Review noted that `search`, `status`, and `priority` were not in the dependency array. Finding 8 was explicitly classified as **Documented Only** to obey the brief's strict rule: *"Fix Only Your Top Five Findings... Do not fix more than five Part 1 findings. The limit is intentional and tests prioritisation."* If we had allowed the AI to update all dependencies, it would have quietly fixed a 6th finding, which the brief specifically warns against.
* **Correction:**  
  I instructed the AI to add *only* the new `breachedOnly` filter to the dependency array, preserving the exact state of Finding 8 as documented.

---

### 3.3 Naïve SLA Response Definition
* **The AI's suggestion:**  
  Initially, the AI proposed checking whether `ticket.comment_count > 0` or if any row existed in the `comments` table for that ticket to determine if a ticket had received a response.
* **The problem:**  
  By reading `schema.sql` and `reset-db.js`, I observed that:
  1. The `comments` table contains comments authored by `requesters` (the customer who submitted the ticket). A customer asking for an update on their own ticket does not fulfill the support team's SLA commitment.
  2. The `comments` table contains an `is_internal` flag. An internal note between agents does not notify the customer.
* **Correction:**  
  I refined the rule: a valid SLA response must strictly be a comment where `c.is_internal = 0` AND the author's role is in `('agent', 'admin')`.

---

## 4. Conclusion

The AI assistant served as an efficient accelerator for syntax generation and test boilerplate, but all critical architectural decisions, security prioritization, and adherence to assessment constraints were strictly driven and verified through manual engineering judgment.
