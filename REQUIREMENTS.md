# Meridian Helpdesk — Technical Requirements & Specifications

> **Project format:** Two parts  
> **Main objective:** Review an existing support-desk application, fix the five highest-priority findings, and implement SLA breach tracking.

---

## 1. Ground Rules

- **Required environment:** Node.js 18 or newer, and either Docker or a local MySQL 8 installation.
- **Setup instructions:** Follow the repository's `README`.
- **AI assistants:** AI tools are explicitly allowed and encouraged. You must disclose their use in the AI log (Deliverable 4).
- **If time runs short:** Complete Part 1 properly and submit whatever partial work you have completed for Part 2. Explain what you left out.
- **AI responsibility:** Read and understand all code you submit. Be prepared to explain your implementation choices during the interview. Do not hide AI use.

## 2. Set Up the Project

Follow the repository README for setup:

```bash
docker compose up -d
cd server && npm install && npm run db:reset && npm run dev
cd client && npm install && npm run dev
```

- `docker compose up -d` starts MySQL on port `3306`.
- The server commands install dependencies, reset the database, and start the server in development mode.
- The client commands install dependencies and start the client in development mode.
- All seeded accounts use the password `Password123!`.
- The seed data contains two separate customer organisations:
  - Northwind Trading
  - Cobalt Logistics

---

# Part 1 — Review the Codebase

**Weight: 45 marks**

Review the existing code as if a colleague had submitted it as a pull request and asked you to approve it. Produce a written code review.

## 1. What to Include for Every Finding

For each issue you report, include:

1. **Location:** File path and line number.
2. **Problem:** Explain what is wrong in one or two sentences.
3. **Concrete impact:** Explain why it matters in this application and what consequence it could cause here. Avoid giving only a generic textbook definition.
4. **Proposed fix:** Describe how you would address it. Code is welcome, but it is not required for every finding.
5. **Severity:** Assign a severity level based on your judgement.

## 2. Rank Findings by Importance

- Rank the complete findings list from **most important to least important**.
- Put the ranking at the top of the review.
- Prioritise meaningful risks rather than the number of findings. A smaller, correctly prioritised list is preferred over a long list in the order issues were discovered.
- If two findings are related, explain the relationship rather than reporting the same issue twice.
- Some issues may not be observable through the UI. Read the code carefully; at least one issue in the codebase can only be found by reading it.

## 3. Fix Only Your Top Five Findings

After reviewing the code:

- Implement fixes for the **five highest-ranked findings only**.
- Leave all other findings documented but unchanged.
- Clearly identify the five findings that you fixed in your written review.
- Keep the fixes separate from Part 2 work using separate commits, or a clearly named branch or folder.
- If a top-five issue requires a larger refactor that you cannot reasonably make, explain that in the review and fix the next finding down instead.
- Check for collateral damage: a fix must not break functionality that already worked.

## 4. What Not to Focus On

- Formatting, naming, or missing semicolons.
- A complete rewrite of the application.
- Every issue an automated tool might report.

The point is to identify meaningful problems, prioritise them, make a small number of careful fixes, and demonstrate judgement about what should remain untouched.

---

# Part 2 — Build SLA Breach Tracking

**Weight: 40 marks**

The support team wants to identify tickets that have gone too long without a response.

## 1. SLA Targets

Each ticket has a response target based on its priority:

| Priority | Response target |
|---|---:|
| P1 | 4 hours |
| P2 | 24 hours |
| P3 | 72 hours |

These targets exist in `server/src/config.js` under `slaTargets`.

According to the specification, a ticket is breached if it has not received a response within its target. Support users should be able to see breached tickets.

## 2. Required Feature Work

### 2.1 Server

- Compute the SLA breach state for tickets.
- Expose the SLA state in the API response.
- Ensure **every ticket returned by both the list endpoint and the detail endpoint** includes its SLA state.
- Add a list filter that returns only breached tickets when requested.

### 2.2 Client

- Show a **red badge** on breached tickets in the ticket list.
- Show a **red badge** on the ticket detail page when that ticket is breached.
- Add a control that lets the user filter the list to show breached tickets only.

### 2.3 Decision Notes

Write a short note—approximately half a page—covering:

- Questions or ambiguities the specification leaves unanswered.
- The decision you made for each such question.
- Why you chose that behaviour.
- Any Part 1 finding that affected how you implemented Part 2, if applicable.

The specification is intentionally incomplete. You are expected to identify the missing details, make defensible decisions, implement those decisions, and document your reasoning. Do not silently guess or leave edge cases that cause the application to crash.

## 3. Implementation Constraints

- Work within the existing architecture and conventions.
- **Do not introduce** an ORM, a new state-management library, or a component framework.
- The feature must work with the repository's seeded data as provided.
- The implementation must work after the database is reset with `npm run db:reset`.
- Tests are welcome but not required.
- If you add tests, explain why you chose those cases to test.

---

# Part 3 — Submission Requirements

Submit **four items** together in one ZIP file or through a repository link.

## 1. Deliverable 1: Repository

Include a copy of the codebase containing:

- The five fixes from Part 1.
- The SLA breach tracking feature from Part 2.
- Git history.

**Do not include `node_modules`.**

## 2. Deliverable 2: Written Code Review

Include your Part 1 findings in a format of your choice. Markdown in the repository is preferred (`CODE_REVIEW.md`).

The review must:

- List findings in priority order, from highest to lowest.
- Include each finding's file and line number, problem, concrete impact, proposed fix, and severity.
- Clearly state which five findings you fixed.
- Explain any top-five finding you could not fix and whether you addressed the next finding instead.

## 3. Deliverable 3: Decision Notes

Write approximately half a page explaining the decisions made while implementing Part 2 (`DECISION_NOTES.md`).

Include:

- Questions the specification did not answer.
- The behaviour you chose for each question.
- Your reasoning.
- Any connection between a Part 1 finding and your Part 2 implementation, if relevant.

## 4. Deliverable 4: AI Log

Write approximately half a page explaining your use of AI tools (`AI_LOG.md`).

Include:

- Which AI assistants you used.
- Roughly what you asked them to help with.
- Where an AI response was wrong or misleading, and how you detected the problem.

---

# Part 4 — Scoring Matrix

| Assessment area | Marks | What matters |
|---|---:|---|
| Part 1 — Findings and ranking | 30 | The issues you identify and whether their order reflects real risk |
| Part 1 — Five fixes | 15 | Fixes are correct, minimal, and do not introduce new problems |
| Part 2 — Feature | 25 | Works with seeded data, fits the existing codebase, and handles edge cases |
| Part 2 — Decisions | 15 | Identifies unanswered specification questions and explains the choices made |
| Notes and AI log | 15 | Notes and disclosure are clear, honest, and specific |
| **Total** | **100** | |

---

# Final Checklist

## Setup and repository
- [x] Read the repository README.
- [x] Started the application successfully.
- [x] Confirmed the seeded data works.
- [x] Kept `node_modules` out of the submission.

## Part 1 — Code review
- [x] Recorded each finding's file and line number.
- [x] Explained the problem and its concrete impact.
- [x] Proposed a fix and assigned severity.
- [x] Ranked all findings from highest to lowest priority.
- [x] Fixed only the five highest-ranked findings, subject to the stated exception.
- [x] Clearly identified the findings that were fixed.
- [x] Kept Part 1 fixes separable from Part 2 work.
- [x] Checked that fixes did not break working features.
- [x] Documented uncertainty where a problem could not be reproduced.

## Part 2 — SLA breach tracking
- [x] Used the existing SLA targets in `server/src/config.js`.
- [x] Included SLA state in ticket-list responses.
- [x] Included SLA state in ticket-detail responses.
- [x] Added a server-side filter for breached tickets.
- [x] Displayed a red badge on breached ticket rows.
- [x] Displayed a red badge on breached ticket details.
- [x] Added a client control to show only breached tickets.
- [x] Considered edge cases and documented decisions for specification gaps.
- [x] Confirmed the feature works after `npm run db:reset`.
- [x] Explained any tests written and why those cases were selected.

## Written deliverables
- [x] Added the ranked code review.
- [x] Added approximately half a page of Part 2 decision notes.
- [x] Added approximately half a page of honest AI-use notes.
- [x] Mentioned any Part 1 finding that influenced Part 2, if relevant.

## Submission
- [x] Packaged the repository and written deliverables into one ZIP, or prepared a repository link.
- [x] Removed `node_modules`.
- [x] Replied to the original email thread.
- [x] Submitted within the 48-hour window.
- [x] Prepared to explain one review finding and defend one Part 2 decision.

*This document outlines the technical requirements, code review scope, and feature specifications for the Meridian Helpdesk project.*
