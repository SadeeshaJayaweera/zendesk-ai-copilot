# Security Policy & Privacy Architecture

## Overview
The Zendesk AI Reply Copilot is built with privacy-first and least-privilege principles.

## Data Retention & Storage Policy
- **Customer Conversations:** We DO NOT store customer conversation text, message transcripts, or personal customer data in our database. All inference happens ephemerally.
- **Feedback & Metrics:** The `feedback_events` table logs only anonymized action identifiers, ticket IDs, agent IDs, and categorical event types.
- **Analysis Cache:** Cached analysis results are stored as hashed records with strict TTLs (default 15 minutes) and are automatically purged by scheduled cleanup jobs.
- **PII Redaction in Logs:** All logging pipelines via Pino are strictly audited to ensure no sensitive request payloads, message bodies, or OpenAI tokens are logged at INFO level.

## Authentication & Authorization
- **ZAF Client Requests:** Client requests are proxied via Zendesk Apps Framework using the authenticated agent's session.
- **Admin Endpoints:** Protected by Zendesk JWT verification and shared secret authentication headers.
- **Rate Limiting:** Enforced on all AI-generating routes to prevent abuse.
