# Zendesk AI Reply Copilot — Product Specification

## Overview
AI Reply Copilot is an intelligent assistant for Zendesk Support agents that accelerates ticket resolution, improves response consistency, and elevates customer satisfaction by generating context-aware reply drafts, analyzing existing drafts, and recommending optimized communication styles using OpenAI.

## Key Features

### 1. Automatic Ticket Analysis
Extracts sentiment, intent, urgency, and conversation tone from customer messages.
- Customer sentiment: positive | neutral | negative | frustrated | angry
- Intent: question | bug_report | feature_request | billing | cancellation | praise | general
- Urgency: low | medium | high | urgent
- Tone recommendations: professional, empathetic, direct, warm, concise

### 2. Best Reply Generation
Generates a complete, context-aware reply adhering to company brand voice and tone guidelines.

### 3. Draft Quality Analysis
Scores agent drafts on professionalism, friendliness, empathy, clarity, grammar, and conciseness (0-100 score). Identifies issues such as unaddressed customer questions, defensive language, unsupported promises, and policy violations.

### 4. Combinable Tone Recommendation
Recommends combinable tone tags (e.g. empathetic_professional_reassuring, direct_efficient_concise) based on customer emotional state and ticket urgency.

### 5. Parameterized Rewrite Engine
Supports 10 rewrite actions:
1. improveTone
2. makeMoreProfessional
3. makeMoreFriendly
4. makeMoreEmpathetic
5. makeMoreConcise
6. makeMoreClear
7. makeLessRobotic
8. makeMoreConfident
9. deEscalate
10. rewriteCompletely

### 6. Hallucination Prevention & Strict Separation
- Never invent refund promises, financial credits, discount percentages, or unverified feature timelines.
- Strict isolation of internal notes (isPublic: false) from customer-facing context.

### 7. Learning & Personalization
- Adaptive agent preferences computed from feedback events.
- Company-wide style profiles (tone, formality, verbosity, emoji usage, greetings).

### 8. High Performance Caching
- SHA-256 conversation hashing for intelligent response caching with configurable TTL.
