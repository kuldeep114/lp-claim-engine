# lp-claim-engine

A working build of L'Oréal's "Claims Intelligence Engine" scenario: a Paris
R&I scientist submits a product formula in support of a claim (e.g.
*"Reduces the appearance of wrinkles by 20% in 4 weeks"*), an evaluator
attaches a clinical study, and the system uses an LLM to judge whether the
study actually justifies the claim. The verdict is persisted and returned
to a React UI.

**Stack:** Node.js + Express (backend), PostgreSQL (database), Anthropic
Claude via a pluggable LLM interface, React + Vite (frontend).

This repo contains two things:

1. An actual working build of the scenario (below).
2. A **self-review of this build**, see [§6](#6-self-review-the-actual-task-b-deliverable),
   including a scored assessment, three flagged issues (blocking or
   nice-to-have), a prioritization call, and one direct question.

This was built end-to-end (backend, database, LLM integration, frontend,
and this review) inside a **one-day time box**, at the scope expected of a
Tech Lead-level assessment. That constraint is real and shapes what's
here. [§5](#5-deliberate-scope-cuts) lists exactly what was cut and why.
[§6](#6-self-review-the-actual-task-b-deliverable) flags the two gaps I'd
treat as blocking before this goes anywhere near production (no recovery
path for a failed LLM call, and no authentication) versus what's a
reasonable trade for the time box (no automated test suite). None of these
are things I'd consider acceptable to ship long-term at a senior level.
They're flagged, not hidden, because a one-day exercise should show
judgment about what to cut, not an illusion of completeness.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Manual test walkthrough](#2-manual-test-walkthrough)
3. [Testing against the real Anthropic LLM](#3-testing-against-the-real-anthropic-llm)
4. [Architecture & design decisions](#4-architecture--design-decisions)
5. [Deliberate scope cuts](#5-deliberate-scope-cuts)
6. [Self-review (the actual Task B deliverable)](#6-self-review-the-actual-task-b-deliverable)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Quick start

### Prerequisites

- Node.js 20+
- A running PostgreSQL server (v14+)

### Create the database (one-time)

```
psql -U postgres -c "CREATE ROLE claims_engine LOGIN PASSWORD 'claims_engine_dev_pw';"
psql -U postgres -c "CREATE DATABASE claims_engine OWNER claims_engine;"
```

### Backend

```
cd backend
npm install
cp .env.example .env
```

`backend/.env` should look like:

```
PORT=4000
DATABASE_URL=postgresql://claims_engine:claims_engine_dev_pw@localhost:5432/claims_engine
LLM_PROVIDER=mock
ANTHROPIC_API_KEY=your-key-here
ANTHROPIC_MODEL=claude-sonnet-5
```

- `LLM_PROVIDER=mock`: deterministic heuristic evaluator, no API key
  needed. Safe default for testing.
- `LLM_PROVIDER=anthropic`: real Claude call (see [§3](#3-testing-against-the-real-anthropic-llm)).

Start it:

```
npm run dev
```

Expect:

```
Claims Intelligence Engine API listening on http://localhost:4000
LLM_PROVIDER=mock
```

The server applies the schema (`CREATE TABLE IF NOT EXISTS…`) on every
startup, so it's safe to restart repeatedly. It never wipes data.

Sanity check: `curl http://localhost:4000/health` should return `{"ok":true}`

### Frontend

In a **second terminal**:

```
cd frontend
npm install
cp .env.example .env
```

`frontend/.env`:

```
VITE_API_URL=http://localhost:4000
```

Start it:

```
npm run dev
```

Open the printed URL (normally `http://localhost:5173`).

---

## 2. Manual test walkthrough

Do these in order. Each step depends on the last.

### Step 1: Submit a claim

On the home page ("New claim" panel):

| Field | Value |
|---|---|
| Product name | `HydraGlow Night Serum` |
| Claim | `Reduces the appearance of wrinkles by 20% in 4 weeks` |
| Claim type | `anti-aging` |

Click **Submit claim**. It appears below with a `Proposed` badge.
*(Exercises `POST /api/claims`.)*

### Step 2: Filter it (claim manager step)

Open the claim. Under "Status (claim manager filter)":

- Status: `filtered_in`
- Notes: `Feasible, within regulatory precedent`
- Click **Update**

Refresh the page. Status and notes should persist. If they don't survive a
refresh, the bug is in the PATCH endpoint or the DB write, not the UI.
*(Exercises `PATCH /api/claims/:id/status`.)*

### Step 3: Submit a formulation (scientist step)

| Field | Value |
|---|---|
| Scientist name | `Dr. Amelie Laurent` |
| Formula summary | `2% retinal + 5% niacinamide base, applied nightly` |
| Internal test results | `In-vitro collagen synthesis assay showed 18% increase at 4 weeks` |

Click **Submit formulation**. A formulation card appears, with an "Attach
clinical study" form underneath it.
*(Exercises `POST /api/claims/:id/formulations`.)*

### Step 4: Attach a study (evaluator step), this is the core feature

| Field | Value |
|---|---|
| Evaluator name | `Dr. Marc Dubois` |
| Study summary | `12-week double-blind, placebo-controlled study, 45 female participants aged 35-55` |
| Sample size | `45` |
| Methodology | `double-blind, placebo-controlled, dermatologist-graded wrinkle scoring` |
| Measured outcome | `21% reduction in wrinkle depth at week 4 vs baseline (p<0.01)` |

Click **Submit study & assess**. An evaluation card appears with a verdict
badge (`Justified` / `Not justified` / `Inconclusive`), a confidence
percentage, which provider ran it, and the reasoning text.

*(Exercises the full pipeline: `POST /api/formulations/:id/studies`, then
study insert, then `LlmProvider.assessClaim()`, then evaluation insert,
then combined response and UI render. This is the scenario's central
requirement. If only one part of this app works, it should be this one.)*

### Step 5 (optional): Confirm the verdict actually varies with input

Repeat steps 3 and 4 with a deliberately weak study: sample size `8`,
methodology and outcome left blank. With `LLM_PROVIDER=mock` this should
come back `inconclusive` (the heuristic requires n≥30 plus methodology
plus outcome to say "justified"). With `LLM_PROVIDER=anthropic`, expect a
real, skeptical judgment: an underpowered study should not come back
"justified."

### Verifying from the API directly

```
curl http://localhost:4000/api/claims           # list
curl http://localhost:4000/api/claims/1         # full nested detail
```

If the API returns correct data but the UI shows something else, the bug
is in `frontend/src/`. If the API itself is wrong, it's in
`backend/src/routes/claims.js` or the DB.

### Resetting the database between runs

```
psql -U claims_engine -h localhost -d claims_engine -c "TRUNCATE claims, formulations, studies, evaluations RESTART IDENTITY CASCADE;"
```

---

## 3. Testing against the real Anthropic LLM

1. Stop the backend (`Ctrl+C`).
2. Edit `backend/.env`:
   ```
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Restart: `npm run dev`
4. Repeat step 4 (or 5) above. The evaluation card's "via" label now reads
   `anthropic`, with a real model-generated verdict and reasoning.

No code change is required for this switch. That's the point of the
`LlmProvider` interface (`backend/src/llm/llmProvider.js`).

---

## 4. Architecture & design decisions

### System shape

```
React (Vite)  --HTTP/JSON-->  Express API  --SQL-->  PostgreSQL
                                    |
                                    +--> LlmProvider interface
                                            |
                                            +--> anthropicProvider (Claude, tool-use)
                                            +--> mockProvider (deterministic, offline)
```

Three tiers, no message queue, no separate worker process. That's a
deliberate choice for this scope (see [§4.4](#scaling-what-breaks-first)),
not an oversight.

### Data model

```
claims  --1:N-->  formulations  --1:N-->  studies  --1:N-->  evaluations
```

- **`claims`**: the business team's proposal. `status` implements the
  "claim manager filters for applicability/feasibility" step as a state
  machine (`proposed → filtered_in/filtered_out → approved/rejected`).
- **`formulations`**: a scientist's submission in support of a claim. One
  claim can have multiple formulation attempts, hence a child table.
- **`studies`**: an evaluator's clinical study attached to a formulation.
- **`evaluations`**: the LLM's verdict on a study. **Kept as its own
  table, insert-only, rather than a column on `studies`.** Re-running an
  assessment (different model, prompt fix, appeal) is a new row, not a
  destructive overwrite. `GET /api/claims/:id` returns the latest
  evaluation per study, but the full history is never lost. That matters
  here specifically because these verdicts feed regulatory claim
  substantiation, where "what did the system say, and when" needs to stay
  answerable.

Each table only has a foreign key to its **immediate** parent
(`studies.formulation_id`, not a denormalized `claims.id` copied onto every
descendant table). `claim_id` for a study is always derivable by joining
through `formulations`. This keeps a single source of truth instead of a
copied key that could drift out of sync. See the N+1 trade-off this
creates, below.

Every `raw_response` from the LLM is stored as `JSONB`: an audit trail for
"why did it say that," independent of the `reasoning` text.

### LLM integration

`backend/src/llm/llmProvider.js` defines one method every provider
implements: `assessClaim(input) -> { verdict, confidence, reasoning, raw }`.
Routes only ever call `getLlmProvider().assessClaim(...)`. Swapping
providers, or A/B testing two of them, is a config change
(`LLM_PROVIDER=anthropic|mock`), not a routes/schema change.

Two decisions worth calling out:

- **Structured output via tool-use, not free-text parsing.** The Anthropic
  call forces the model through a `record_claim_assessment` tool with a
  JSON schema (`verdict` enum, `confidence` number, `reasoning` string). The
  response is guaranteed to parse. No regex-scraping a paragraph hoping it
  contains the word "justified."
- **The prompt explicitly asks the model to be skeptical.** A study only
  justifies a claim if sample size, methodology, and measured outcome
  actually match the claim's specific wording, with "inconclusive" as the
  honest answer for weak studies. Left unconstrained, an LLM asked "does
  this support this claim" tends toward agreeable answers. For a
  claims-substantiation tool, a false "justified" is worse than a false
  "inconclusive."

The mock provider implements the identical interface with a simple
heuristic (sample size of 30 or more, plus methodology, plus outcome
present, equals justified), so the whole system is demoable and testable
at zero API cost, exercising the exact same code path (routes, provider,
DB) that runs in production.

### Why PostgreSQL

The build started against SQLite to prove the API shape end-to-end before
any DB server setup. That prototype was never the deliverable. The switch
to Postgres touched only the schema dialect (`GENERATED ALWAYS AS
IDENTITY`, `TIMESTAMPTZ`, `JSONB`), the connection layer (`pg.Pool`
instead of `better-sqlite3`), and query placeholders (`$1, $2` plus
`RETURNING *`). The routes' logic didn't change, which is the payoff of
keeping DB access thin. Postgres was chosen over SQLite for the real
deliverable because this data (regulatory claim evidence) is exactly the
kind that eventually needs concurrent writers and real backup/replication
tooling.

### Frontend

Two views (`ClaimsList`, `ClaimDetail`), switched via local `useState` in
`App.jsx`. No `react-router`. For a 2-screen app, a router is a dependency
that would need justifying in an interview for no functional gain. Plain
state is the honest answer.

### Scaling: what breaks first

- **The synchronous LLM call is the first thing to fall over.** `POST
  /formulations/:id/studies` blocks on the Anthropic call before
  responding. That's fine for one evaluator submitting one study at a
  time, wrong under real concurrent load. Fix: return `pending`
  immediately, push the assessment onto a queue, have the UI poll or
  subscribe for the result. The insert-only `evaluations` table already
  supports this without a schema change.
- **No retry or backoff on the Anthropic call.** A transient 429 or
  timeout returns a 502 today with the study already saved but no
  evaluation attached (see [§6](#6-self-review-the-actual-task-b-deliverable),
  issue #1, the top-flagged gap in the self-review).
- **N+1 query pattern** in `GET /api/claims/:id` (a query per formulation,
  then per study, then per evaluation). Fine at demo scale; at real scale
  this wants a single `JOIN` with `DISTINCT ON`, or a denormalized
  `claim_id` as discussed above.
- **No connection pool tuning, no read replica.** `pg.Pool()` defaults are
  fine for a demo's single evaluator, not for production concurrency.

### One repo, one service: for now

Backend, frontend, and the LLM integration live in a single repo, and the
LLM call runs in-process inside the API, not as a separate service. That's
the right call at this scale: three tables and one LLM call don't justify
the coordination overhead of separate repos or a network hop between
services.

This is worth revisiting at exactly one point: once the async-queue rework
above happens, the worker that runs the LLM assessment becomes a
legitimate candidate for its own service. It has different scaling needs
than the CRUD API (I/O-bound, rate-limited by Anthropic, wants its own
retry/backoff and observability), and pulling it out at that point is a
reasonable evolution. Doing it today, while the call is still a
synchronous in-process function, would be splitting something that isn't
under any real strain yet.

---

## 5. Deliberate scope cuts

Said out loud, not hidden. Each is the first thing to raise as a gap before
this goes near production:

1. **No authentication or roles.** Every actor (business team, scientist,
   evaluator, claim manager) is a free-text name field, not a login.
2. **No claim-manager review queue UI.** The filtering *step* exists in
   the schema and API, but there's no dedicated screen to triage a backlog
   of proposed claims by ID.
3. **Synchronous LLM call on the request path** rather than an async
   queue (see above).
4. **No automated test suite.** Verified by hand instead: curl scripts
   against every endpoint, then a full click-through of the real flow in
   an actual browser (Chrome, via automation), confirming persistence via
   the API directly (not just local UI state) at each step. No regression
   suite, though. That's a trade that only holds for a 1-day build.

---

## 6. Self-review (the actual Task B deliverable)

Task B asks for a review of a Senior Engineer's submission: scored,
critiqued, and prioritized. With no submission to review, this section
applies Task B's own instructions to this build instead. A tech lead's
review of my own work, written the way I'd write it about anyone else's.

### Score: 4/5

**Stand-out, liked:**

- **The LLM provider is a real interface, not a wrapper around one API
  call.** Swapping Anthropic for OpenAI, or A/B testing two models, is a
  config change. Cheap to build on day one, expensive to retrofit later. I'd
  expect to see this in any submission I was reviewing, not treat it as
  bonus credit.
- **Structured output via tool-use instead of parsing free text.** A
  submission that regex'd "justified" out of a paragraph would fail this
  review outright. That failure mode is silent and shows up as a
  production incident, not a code review comment.

**Stand-out, disliked:**

- **The LLM call is synchronous on the request path, and failure leaves
  orphaned data with no recovery path** (`backend/src/routes/claims.js`,
  around lines 180-187). If the Anthropic call throws, the response is a
  502, but the `study` row is already committed with no evaluation
  attached and no endpoint to retry just the assessment. This is the
  single biggest gap in the submission. See issue #1 below.

### Top 3 issues, as PR review comments

**1. [BLOCKING] No recovery path when the LLM call fails**
(`backend/src/routes/claims.js:180-187`)

> This catches the provider error and returns a 502, but the study insert
> above already committed. Right now the evaluator's only option on
> failure is to resubmit the whole study, creating a duplicate `studies`
> row for the same evidence with no relationship back to the failed
> attempt. For a system whose output is "does this evidence justify this
> regulatory claim," an unrecoverable half-state is worse than slow. I'd
> block merge until there's at least a `POST /studies/:id/retry-assessment`
> endpoint, even before the bigger async-queue rework noted in §4 lands.

**2. [BLOCKING] No authentication or identity verification on any
endpoint**

> `evaluator_name`, `scientist_name`, etc. are free-text fields on every
> write. Nothing stops one person submitting a study "as" someone else, or
> a claim manager's filter decision being attributed to the wrong name.
> Fine for the demo we scoped, but flagged blocking-before-production
> because the artifact this system produces (a stored verdict on whether a
> study justifies a regulatory claim) is exactly the kind of record where
> "who submitted this" needs to be a verified fact, not a text field.

**3. [NICE-TO-HAVE] No automated test suite**

> Verified by hand instead, the right trade-off for a 1-day build where
> "does the happy path work" was the open question, but not a trade I'd
> want standing much longer. The `LlmProvider` interface in particular is
> exactly the kind of seam that's cheap to unit test (assert the mock
> heuristic, assert the Anthropic provider's tool-use parsing against a
> canned response) and expensive to leave untested once a second person
> touches this code.

### With +1 engineer and more days: what I'd prioritize first, and why

**Issue #1 (the LLM failure/recovery path), before #2 (auth).**

Not because auth matters less. It doesn't. But #1 is actively producing
bad data *right now*: every failed assessment leaves a study with no
evaluation and no clean way to fix it. Auth is a well-understood problem
with a well-understood fix (a session or JWT layer bolted onto existing
routes) that doesn't get harder by waiting a sprint. The async/retry
rework for #1 changes the API contract itself (`POST /studies` stops
returning the evaluation inline; the UI needs to poll or subscribe for
it), so the longer more code gets written against today's synchronous
assumption, the more that migration costs later. Fix the thing that
compounds first.

### One question I'd ask the engineer before making a final call

> "When the LLM call fails after the study's already saved, what did you
> intend the evaluator to actually do next? If the answer is 'resubmit,'
> how do we stop that from leaving duplicate, unlinked study rows for the
> same piece of evidence?"

This is the question because the answer tells me whether the gap in issue
#1 was a known, accepted trade-off under time pressure (a fine answer for
a 1-day scope) or a case that was never considered.

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend won't start, `ECONNREFUSED` | Postgres isn't running. |
| Backend won't start, password authentication failed | `DATABASE_URL` in `backend/.env` doesn't match the role's actual password. |
| Claims list never populates, console shows a fetch error | Backend isn't running, or `VITE_API_URL` in `frontend/.env` doesn't match the backend's actual port. |
| Study submission fails after a long wait | If `LLM_PROVIDER=anthropic`: check the API key is valid and has quota. The study is still saved (check via `curl .../api/claims/:id`) but has no evaluation. This is the known gap in §6, issue #1. |
| Port 4000 or 5173 already in use | Something from a previous run is still listening. Stop it, or change `PORT` / pass `--port` to Vite. |
