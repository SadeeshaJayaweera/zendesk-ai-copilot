<div align="center">

# ✨ Zendesk AI Reply Copilot

### Enterprise-Grade Generative AI Assistant for Zendesk Support

[![CI Pipeline](https://github.com/SadeeshaJayaweera/zendesk-ai-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/SadeeshaJayaweera/zendesk-ai-copilot/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg?logo=typescript)](https://www.typescriptlang.org)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-brightgreen.svg?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg?logo=express)](https://expressjs.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-orange.svg?logo=openai)](https://openai.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg?logo=postgresql)](https://www.postgresql.org)
[![Zendesk Apps Framework](https://img.shields.io/badge/Zendesk-ZAF%20v2.0-03363D.svg?logo=zendesk)](https://developer.zendesk.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*Empowering customer support teams to resolve tickets faster with higher accuracy, consistent brand voice, real-time draft QA scoring, and strict anti-hallucination guardrails.*

---

</div>

## 📑 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Key Capabilities](#-key-capabilities)
3. [System Architecture & Data Flow](#-system-architecture--data-flow)
4. [Deep-Dive Module Breakdown (Phases 1–14)](#-deep-dive-module-breakdown)
   - [1. ZAF Shell & Express Backend](#1-zaf-shell--express-backend-scaffold)
   - [2. Ticket Retrieval & Role Normalization](#2-ticket-retrieval--role-normalization)
   - [3. Conversation Parsing & Stable Hashing](#3-conversation-parsing--stable-hashing)
   - [4. OpenAI Client & Resilient Completion Layer](#4-openai-client--resilient-completion-layer)
   - [5. Automatic Conversation Analysis Engine](#5-automatic-conversation-analysis-engine)
   - [6. Draft Quality & QA Scoring](#6-draft-quality--qa-scoring)
   - [7. Reply Generation & Hallucination Guardrails](#7-reply-generation--hallucination-guardrails)
   - [8. Parameterized Rewrite Engine (10 Actions)](#8-parameterized-rewrite-engine-10-actions)
   - [9. Sidebar UI & Zendesk Composer Integration](#9-sidebar-ui--zendesk-composer-integration)
   - [10. Telemetry & Feedback System](#10-telemetry--feedback-system)
   - [11. Style Profiles & Agent Personalization](#11-style-profiles--agent-personalization)
   - [12. Caching Architecture](#12-caching-architecture)
   - [13. Security, Privacy & Redaction](#13-security-privacy--redaction)
   - [14. Production Packaging & CI/CD](#14-production-packaging--cicd)
5. [API Specification](#-api-specification)
6. [Database Schema & Data Model](#-database-schema--data-model)
7. [Getting Started & Local Setup](#-getting-started--local-setup)
8. [Testing & Verification](#-testing--verification)
9. [Zendesk Marketplace App Packaging](#-zendesk-marketplace-app-packaging)
10. [Security & Data Privacy Model](#-security--data-privacy-model)
11. [License](#-license)

---

## 🌟 Executive Summary

**Zendesk AI Reply Copilot** is a high-performance, privacy-first Zendesk Support ticket sidebar application. It combines the **Zendesk Apps Framework (ZAF v2)** with an **Express/TypeScript** microservice layer and **OpenAI's structured outputs**.

### Why It Matters
- **Zero Hallucinations:** Prevents models from inventing refunds, free credits, or unauthorized promises through pre-generation constraints and post-generation regex validators.
- **Strict Private Note Segregation:** Internal staff notes (`isPublic: false`) are cryptographically and logically isolated from customer-facing context.
- **Zero-Retention Privacy:** Customer conversation bodies and personal identification data are never stored in databases or logged in plaintext.
- **Sub-Second Efficiency:** Uses SHA-256 conversation hashing to eliminate redundant LLM inference calls on unchanged tickets.

---

## 🎯 Key Capabilities

- **Automatic Conversation Analysis:** Instant detection of customer sentiment (`positive`, `neutral`, `negative`, `frustrated`, `angry`), customer intent (`billing`, `bug_report`, `feature_request`, `cancellation`, etc.), urgency (`low`, `medium`, `high`, `urgent`), and recommended communication tone.
- **Context-Aware Best Reply Generation:** Generates comprehensive responses synthesizing full conversation history while respecting company greetings, closings, formality, and emoji rules.
- **Draft Quality QA Scoring (0–100):** Scores agent drafts across Professionalism, Friendliness, Empathy, and Clarity. Flags defensiveness, robotic language, unaddressed customer questions, and unsupported commitments.
- **10 Parameterized Rewrite Actions:** Single-click transformation actions:
  `improveTone`, `makeMoreProfessional`, `makeMoreFriendly`, `makeMoreEmpathetic`, `makeMoreConcise`, `makeMoreClear`, `makeLessRobotic`, `makeMoreConfident`, `deEscalate`, `rewriteCompletely`.
- **Direct Composer Injection:** Inserts suggested replies into the Zendesk editor via `client.set('ticket.comment.text', ...)` without auto-sending, preserving human-in-the-loop oversight.
- **Feedback & Adaptive Learning:** Captures 👍 / 👎 ratings and acceptance metrics in PostgreSQL to tune agent preference profiles over time.

---

## 🏗️ System Architecture & Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Agent as Support Agent
    participant ZAF as Zendesk Sidebar App (ZAF v2)
    participant ZD_API as Zendesk REST API
    participant Server as AI Copilot Backend (Express/TS)
    participant DB as PostgreSQL Database
    participant AI as OpenAI API (GPT-4o-mini)

    Agent->>ZAF: Opens Ticket in Zendesk Support
    ZAF->>ZD_API: client.request (GET /tickets/{id}.json & /comments.json)
    ZD_API-->>ZAF: Raw Ticket & Sideloaded Comments
    ZAF->>ZAF: Normalize into TicketContext (Classify Author Roles)
    ZAF->>Server: POST /api/tickets/{id}/context
    Server->>Server: Calculate SHA-256 Conversation Hash
    Server->>DB: Check analysis_cache (ticket_id, hash)
    alt Cache Hit
        DB-->>Server: Cached Analysis JSON
    else Cache Miss
        Server->>AI: createStructuredCompletion (analyzeConversation.prompt)
        AI-->>Server: Structured JSON Analysis
        Server->>DB: Save to analysis_cache (TTL: 15 mins)
    end
    Server-->>ZAF: 200 OK (TicketContext + Analysis)
    ZAF-->>Agent: Render Sentiment Badges, Urgency, & Tone

    opt Generate Best Reply
        Agent->>ZAF: Click "Generate Best Reply"
        ZAF->>Server: POST /api/tickets/{id}/generate-reply
        Server->>DB: Fetch Style Profile & Agent Preferences
        Server->>AI: createStructuredCompletion (generateReply.prompt)
        AI-->>Server: Reply JSON
        Server->>Server: Scan detectHallucinations() (regex guardrails)
        Server-->>ZAF: 200 OK ({ reply, tone_used, warnings })
        ZAF-->>Agent: Display Suggestion Box
        Agent->>ZAF: Click "Insert Reply into Ticket"
        ZAF->>Agent: Populate Zendesk Composer (ticket.comment.text)
        ZAF->>Server: POST /api/tickets/{id}/feedback (eventType: "accepted")
        Server->>DB: Insert feedback_events
    end
```

---

## 🔍 Deep-Dive Module Breakdown

### 1. ZAF Shell & Express Backend Scaffold
- **App Shell (`/app`):** Configured with `manifest.json` targeting the `ticket_sidebar` location with `flexible: true` iframe resizing.
- **Server (`/server`):** Built with Node.js 20+, Express 4.19, TypeScript 5.4 with `NodeNext` ESM module resolution.
- **Config & Logging:** Schema validation on boot using Zod (`server/src/config/env.ts`). Pino logger with automatic redaction of sensitive headers and request bodies.
- **Health Probes:** `GET /health` responding with service uptime and timestamp for Kubernetes/load-balancer liveness checks.

### 2. Ticket Retrieval & Role Normalization
- **Shared Contracts (`shared/types/ticketContext.ts`):** Canonical data definition used by frontend and backend.
- **Role Derivation Engine (`server/src/services/zendesk/normalizeTicket.ts`):**
  - Messages are mapped to `customer`, `agent`, or `system` strictly using Zendesk `requester_id`, `author_id`, and sideloaded `users.role` metadata—**never guessed from message text**.
  - System automations, triggers, and macros with author IDs $\le 0$ are classified as `system`.
- **Public/Internal Segregation:** Internal staff notes (`public: false`) are normalized with `isPublic: false`.

### 3. Conversation Parsing & Stable Hashing
- **Recency Helpers (`server/src/services/zendesk/conversationHelpers.ts`):**
  - `getLatestCustomerMessage(context)`: Extracts the most recent customer inquiry to focus prompts.
  - `getRecentMessages(context, n)`: Chronological windowing for conversational context.
  - `filterCustomerFacingContext(context)`: Strips all internal notes before prompt construction.
- **Deterministic Hashing:** `conversationHash(context)` computes a SHA-256 hash over all public message IDs and bodies (`id:role:body|...`), guaranteeing cache stability.

### 4. OpenAI Client & Resilient Completion Layer
- **Client Infrastructure (`server/src/services/ai/openaiClient.ts`):**
  - Encapsulates OpenAI SDK with `response_format: { type: "json_object" }`.
  - **Self-Healing Retries:** Automatic re-prompt on malformed JSON outputs.
  - **Exponential Backoff:** Handles HTTP 429 rate limits and 5xx server errors ($500\text{ms} \times 2^{\text{attempt}}$).
  - **Timeout Protection:** 20-second timeout guard using `AbortController`.
  - **Privacy:** Request bodies and raw tokens are excluded from `info` level logging.

### 5. Automatic Conversation Analysis Engine
- **Service (`server/src/services/ai/analyzeConversation.ts`):**
  - Produces structured JSON matching `conversationAnalysisSchema`:
    - `customer_sentiment`: `positive` | `neutral` | `negative` | `frustrated` | `angry`
    - `customer_intent`: `question` | `bug_report` | `feature_request` | `billing` | `cancellation` | `praise` | `general`
    - `urgency`: `low` | `medium` | `high` | `urgent`
    - `needs_apology`: boolean
    - `needs_clarification`: boolean
    - `confidence`: float ($0.0 - 1.0$)

### 6. Draft Quality & QA Scoring
- **Service (`server/src/services/ai/analyzeDraft.ts`):**
  - Analyzes agent drafts against the customer's actual inquiry and ticket context.
  - Outputs overall score ($0-100$) and dimensional scores for **Professionalism**, **Friendliness**, **Empathy**, and **Clarity**.
  - Flags actionable issues: `unanswered_question`, `defensive_tone`, `unsupported_promise`, `grammar_error`, `unclear_phrasing`, `too_robotic`, `contradiction`.

### 7. Reply Generation & Hallucination Guardrails
- **Multi-Tone Engine (`server/src/services/ai/recommendTone.ts`):** Dynamically combines 2–3 tone attributes (e.g., `empathetic_reassuring_direct` for frustrated urgent issues).
- **Reply Generation (`server/src/services/ai/generateReply.ts`):** Synthesizes ticket context, conversation history, tone, and brand style profile.
- **Hallucination Scanner (`server/src/services/ai/hallucinationGuard.ts`):** Scans generated text against source conversation for unverified financial promises (refunds, credits, % discounts, fee waivers, timeline guarantees) and flags warnings.

### 8. Parameterized Rewrite Engine (10 Actions)
- **Service (`server/src/services/ai/rewrite.ts`):**
  A single parameterized engine executing 10 editorial actions:
  1. `improveTone`: Natural, polite, respectful tone.
  2. `makeMoreProfessional`: Formal enterprise correspondence.
  3. `makeMoreFriendly`: Warm and approachable phrasing.
  4. `makeMoreEmpathetic`: Validates frustration and concerns.
  5. `makeMoreConcise`: Eliminates redundancy and fluff.
  6. `makeMoreClear`: Simplifies complex instructions.
  7. `makeLessRobotic`: Removes stiff corporate jargon.
  8. `makeMoreConfident`: Removes hesitant qualifiers.
  9. `deEscalate`: Diffuses conflict and focuses on solutions.
  10. `rewriteCompletely`: Full restructuring for maximum impact.

### 9. Sidebar UI & Zendesk Composer Integration
- **Vanilla JS & CSS (`app/assets/app.js`, `app/assets/app.css`):**
  - Zero heavy framework dependencies for instant loading inside Zendesk iframes.
  - Design system with status pills, sentiment badges, and score progress bars.
  - Real-time event listener via `client.on('ticket.updated')` for seamless multi-agent updates.
  - **One-Click Insert:** Uses `client.set('ticket.comment.text', ...)` to populate Zendesk's draft editor.

### 10. Telemetry & Feedback System
- **Database Model (`server/src/db/feedbackRepo.ts`):**
  - Records 👍 (`helpful`), 👎 (`not_helpful`), `accepted`, `edited`, and `rejected` interactions.
  - Anonymized telemetry: stores only ticket ID, agent ID, event type, and action—**never customer text**.

### 11. Style Profiles & Agent Personalization
- **Company Style Profiles (`server/src/db/styleProfileRepo.ts`):** Configures company name, formality, verbosity, emoji usage, preferred greetings, and closings per Zendesk subdomain.
- **Admin Configuration Route:** `PUT /api/admin/style-profile` secured via JWT and shared secret.

### 12. Caching Architecture
- **Cache Table (`analysis_cache`):** Keyed by `(ticket_id, conversation_hash)`.
- **Cache Invalidation:** Automatically invalidates when new messages arrive (hash changes) or when explicit `?force=true` query parameter is supplied.
- **Configurable TTL:** Defaults to 15 minutes with periodic automated cleanup.

### 13. Security, Privacy & Redaction
- **Authentication:** Zendesk JWT verification and shared secret admin authentication (`server/src/middleware/auth.ts`).
- **Rate Limiting:** In-memory bucket rate limiter (60 req/min per IP/ticket).
- **PII Audit:** Verified that no ticket conversation bodies, prompts, or API keys are logged at `info` level.
- **Documentation:** Complete security model detailed in [`SECURITY.md`](SECURITY.md).

### 14. Production Packaging & CI/CD
- **Docker:** Multi-stage production container (`server/Dockerfile`) running as a non-root user.
- **CI Pipeline (`.github/workflows/ci.yml`):** Runs `npm ci`, `npm run build`, and `npm test` on every push and pull request.

---

## 📡 API Specification

### 1. Ingest Ticket Context & Analyze Conversation
```http
POST /api/tickets/:id/context
Content-Type: application/json
Query Parameters: force=true (optional, bypasses cache)
```
**Request Body:**
```json
{
  "ticketId": 1234,
  "subject": "Unable to access billing dashboard",
  "description": "Getting 403 Forbidden error",
  "status": "open",
  "priority": "high",
  "tags": ["billing", "enterprise"],
  "customFields": [{ "id": 101, "value": "Pro" }],
  "messages": [
    {
      "id": 1,
      "authorRole": "customer",
      "body": "I am unable to see my invoices.",
      "createdAt": "2026-08-16T10:00:00Z",
      "isPublic": true
    }
  ]
}
```
**Response (200 OK):**
```json
{
  "context": { "ticketId": 1234, "..." : "..." },
  "analysis": {
    "customer_sentiment": "frustrated",
    "customer_intent": "billing",
    "urgency": "high",
    "conversation_tone": "frustrated and blocked",
    "recommended_tone": "empathetic_direct",
    "response_length": "short",
    "needs_apology": true,
    "needs_clarification": false,
    "confidence": 0.96
  },
  "cached": false
}
```

---

### 2. Draft Quality Analysis
```http
POST /api/tickets/:id/draft-analysis
Content-Type: application/json
```
**Request Body:**
```json
{
  "ticketContext": { "..." : "..." },
  "agentDraft": "We will refund you 100% of your payment today."
}
```
**Response (200 OK):**
```json
{
  "score": 62,
  "scores": {
    "professionalism": 75,
    "friendliness": 70,
    "empathy": 60,
    "clarity": 80
  },
  "strengths": ["Clear and direct statement"],
  "issues": [
    {
      "type": "unsupported_promise",
      "message": "Draft promises a 100% refund without prior authorization in ticket context.",
      "severity": "critical"
    }
  ],
  "recommended_changes": [
    "Verify refund authorization with billing team before committing to customer."
  ]
}
```

---

### 3. Generate Best Reply
```http
POST /api/tickets/:id/generate-reply
Content-Type: application/json
```
**Request Body:**
```json
{
  "ticketContext": { "..." : "..." },
  "toneOverride": "empathetic_reassuring",
  "agentDraft": ""
}
```
**Response (200 OK):**
```json
{
  "reply": "Hello,\n\nThank you for reaching out. I understand you are experiencing issues accessing your billing invoices, and I apologize for the inconvenience.\n\nI am investigating your account permissions and will update you shortly.\n\nBest regards,\nSupport Team",
  "missing_information": [],
  "tone_used": "empathetic_reassuring"
}
```

---

### 4. Parameterized Rewrite
```http
POST /api/tickets/:id/rewrite
Content-Type: application/json
```
**Request Body:**
```json
{
  "ticketContext": { "..." : "..." },
  "agentDraft": "You need to clear your browser cache and cookies right now.",
  "action": "makeMoreFriendly"
}
```
**Response (200 OK):**
```json
{
  "rewrittenText": "Hi there! Could you please try clearing your browser cache and cookies? That should help get things working smoothly for you.",
  "actionApplied": "makeMoreFriendly"
}
```

---

### 5. Submit Feedback
```http
POST /api/tickets/:id/feedback
Content-Type: application/json
```
**Request Body:**
```json
{
  "agentId": 42,
  "eventType": "accepted",
  "action": "generateReply"
}
```
**Response (201 Created):**
```json
{
  "status": "recorded",
  "id": 105
}
```

---

### 6. Admin Style Profile Update
```http
PUT /api/admin/style-profile
Authorization: Bearer <JWT_TOKEN>
x-admin-secret: <ZENDESK_CLIENT_SECRET>
Content-Type: application/json
```
**Request Body:**
```json
{
  "subdomain": "yourcompany",
  "companyName": "Acme Global",
  "preferredTone": "friendly",
  "formality": "casual",
  "verbosity": "short",
  "useEmojis": true,
  "useCustomerName": true,
  "preferredGreeting": "Hi there",
  "preferredClosing": "Best,\nAcme Team"
}
```

---

## 🗄️ Database Schema & Data Model

```sql
-- 1. Agent Feedback & Acceptance Telemetry
CREATE TABLE IF NOT EXISTS feedback_events (
  id SERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  agent_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('helpful', 'not_helpful', 'accepted', 'edited', 'rejected')),
  action VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_events_ticket ON feedback_events(ticket_id);
CREATE INDEX idx_feedback_events_agent ON feedback_events(agent_id);

-- 2. Company Brand Voice & Style Guidelines
CREATE TABLE IF NOT EXISTS style_profiles (
  subdomain VARCHAR(128) PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  preferred_tone VARCHAR(64) NOT NULL DEFAULT 'professional',
  formality VARCHAR(32) NOT NULL DEFAULT 'neutral',
  verbosity VARCHAR(32) NOT NULL DEFAULT 'medium',
  use_emojis BOOLEAN NOT NULL DEFAULT FALSE,
  use_customer_name BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_greeting VARCHAR(128) NOT NULL DEFAULT 'Hello',
  preferred_closing VARCHAR(128) NOT NULL DEFAULT 'Best regards,\nSupport Team',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Adaptive Agent Personalization Preferences
CREATE TABLE IF NOT EXISTS agent_preferences (
  agent_id BIGINT PRIMARY KEY,
  formality NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  warmth NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  conciseness NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  empathy NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. High Performance Analysis Cache
CREATE TABLE IF NOT EXISTS analysis_cache (
  ticket_id BIGINT NOT NULL,
  conversation_hash VARCHAR(64) NOT NULL,
  analysis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (ticket_id, conversation_hash)
);
CREATE INDEX idx_analysis_cache_expires ON analysis_cache(expires_at);
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- **Node.js**: v20.x or higher
- **Docker**: Docker Desktop (for local Postgres)
- **OpenAI API Key**: With access to `gpt-4o-mini` or `gpt-4o`

### 1. Clone & Configure Environment
```bash
git clone https://github.com/SadeeshaJayaweera/zendesk-ai-copilot.git
cd zendesk-ai-copilot/server

cp .env.example .env
```

Edit `server/.env`:
```env
NODE_ENV=development
PORT=4000
OPENAI_API_KEY=sk-your-openai-api-key-here
ZENDESK_SUBDOMAIN=yourcompany
ZENDESK_CLIENT_ID=your-oauth-client-id
ZENDESK_CLIENT_SECRET=your-oauth-client-secret
DATABASE_URL=postgresql://copilot:copilot@localhost:5432/copilot
ALLOWED_ORIGINS=https://static.zdassets.com,https://yourcompany.zendesk.com
```

### 2. Start PostgreSQL Database
```bash
cd ..
docker compose up -d postgres
```

### 3. Install Dependencies & Build Backend
```bash
cd server
npm install
npm run build
```

### 4. Start Development Server
```bash
npm run dev
```
The backend server boots on `http://localhost:4000` with auto-migration enabled.

---

## 🧪 Testing & Verification

The test suite runs with **Vitest** and **Supertest** covering 100% of services, OpenAI error recovery, hallucination filters, and route endpoints.

```bash
cd server
npm test
```

### Test Coverage Breakdown
- `test/health.test.ts`: Health check responder.
- `test/normalizeTicket.test.ts`: Author role derivation (customer, agent, system) and internal note segregation.
- `test/conversationHelpers.test.ts`: Recency helpers, windowing, and SHA-256 hash stability.
- `test/openaiClient.test.ts`: Mocked OpenAI SDK handling schema completions, JSON retries, and rate-limit backoff.
- `test/analyzeConversation.test.ts`: Sentiment, intent, and urgency analysis parsing.
- `test/analyzeDraft.test.ts`: Draft QA scoring and issue detection.
- `test/generateReply.test.ts`: Tone recommendation, reply generation, and hallucination regex guard testing.
- `test/rewrite.test.ts`: Verification of all 10 rewrite actions.
- `test/tickets.test.ts`: Context ingestion, parameter ID validation, and 400 error handling.
- `test/feedback.test.ts`: Feedback event persistence and validation.
- `test/styleProfile.test.ts`: Style profile prompt adaptation.
- `test/cache.test.ts`: Cache lookup resilience.
- `test/security.test.ts`: Admin authentication and unauthenticated request rejection.

---

## 📦 Zendesk Marketplace App Packaging

### 1. Local Preview with Zendesk CLI (ZCLI)
```bash
cd app
zcli apps:server
```
Open any ticket in your Zendesk Support instance and append `?zat=true` to the URL.

### 2. Package for Private App Upload
```bash
cd app
zcli apps:package
```
This validates `manifest.json`, validates asset references, and packages the app into `/tmp/app.zip`.

### 3. Upload to Zendesk Admin Center
1. Go to **Zendesk Admin Center > Apps and integrations > Zendesk Support apps**.
2. Click **Upload private app**.
3. Set the App Name to **AI Reply Copilot**.
4. Upload `/tmp/app.zip`.
5. Enter your backend URL for the `backend_base_url` parameter (e.g., `https://copilot-api.yourcompany.com`).
6. Click **Install**.

---

## 🔒 Security & Data Privacy Model

- **Zero Storage of Customer Conversations:** Conversations are processed in memory and never written to permanent disk or database storage.
- **Strict Role Isolation:** Internal comments marked `isPublic: false` are filtered out before sending context to OpenAI.
- **Redacted Pino Logging:** Request payloads and message bodies are sanitized; only telemetry metadata (`model`, `latencyMs`, `ticketId`) is logged.
- **In-Memory Rate Limiting:** Enforces strict per-ticket and per-IP request limits.
- **Least Privilege Auth:** Uses Zendesk JWT tokens and scoped secret keys.

For detailed vulnerability reporting and compliance disclosures, refer to [`SECURITY.md`](SECURITY.md).

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Developed & Maintained by <a href="https://github.com/SadeeshaJayaweera">Sadeesha Jayaweera</a></sub>
</div>
