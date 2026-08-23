# Revive AI — Project Instructions

## 1. Project Mission

Revive AI is a fintech revenue-recovery web application built for the Razorpay AI Revenue Recovery track.

The product should demonstrate an AI-assisted system that:

1. Detects revenue at risk.
2. Diagnoses the likely cause.
3. Determines an appropriate recovery intervention.
4. Applies deterministic policy and safety guardrails.
5. Executes only bounded/simulated recovery actions.
6. Measures actual recovery outcomes.
7. Escalates uncertain or restricted cases.
8. Maintains a complete audit trail.

The project must prioritize reliability, explainability, measurable outcomes, and a strong demo experience.

---

## 2. Technology Stack

Frontend:

- Next.js 14.2.35
- React
- TypeScript
- Tailwind CSS
- App Router

Backend:

- Node.js
- Express
- TypeScript

Database:

- MongoDB

AI:

- LLM API with structured outputs/tool calling
- AI should be used primarily for diagnosis and contextual decision-making.

Testing:

- Use automated tests for critical business logic, policies, and recovery calculations.

Deployment:

- Frontend: Vercel-compatible
- Backend: Node-compatible hosting
- Database: MongoDB Atlas

---

## 3. Architecture Principles

Follow a clear separation of responsibilities:

Frontend

→ Backend API

→ Revenue/Event Engine

→ AI Reasoning

→ Policy/Guardrail Engine

→ Action Executor

→ Evaluation

→ Audit Trail

Do not place important business logic directly inside UI components.

Do not allow the LLM to directly authorize financial actions.

The architecture should follow:

AI recommends.

Deterministic policy authorizes.

Controlled tools execute.

Audit logs record.

---

## 4. Financial Safety Rules

All financial actions must pass through deterministic policy checks.

Never allow an LLM response alone to execute a financial action.

Examples of policy constraints include:

- Maximum retry attempts.
- Duplicate-action prevention.
- Confidence thresholds.
- Transaction amount thresholds.
- Permanent failure restrictions.
- Human escalation.
- Merchant-configurable limits.

If a policy blocks an AI recommendation, the system must record the blocked decision and explain why.

---

## 5. AI Behavior

AI outputs must be structured and validated.

Prefer JSON/schema-based responses rather than free-form text when AI decisions affect application logic.

AI decisions should contain information such as:

- diagnosis
- confidence
- recommended action
- reasoning
- relevant evidence
- risk level

Never trust arbitrary model-generated values without validation.

The AI must not invent transaction data, payment results, recovery amounts, or API responses.

---

## 6. Revenue Recovery Simulator

The initial MVP should use a deterministic payment/revenue simulator.

The simulator must provide known ground truth so that Revive AI can be evaluated objectively.

Synthetic transactions should contain realistic attributes such as:

- transaction amount
- payment status
- failure reason
- retry count
- customer history
- payment method
- timestamps
- recoverability
- expected/best action
- simulated outcome

The simulator must produce reproducible results when possible.

---

## 7. Evaluation

Do not claim AI performance without measured evaluation.

The system should eventually compare:

- baseline recovery strategy
- Revive AI strategy

Metrics may include:

- revenue at risk
- revenue recovered
- incremental revenue recovered
- recovery rate
- successful interventions
- false interventions
- escalation rate
- automation rate
- blocked actions
- duplicate actions
- average recovery value

A single successful transaction is not sufficient evidence of system performance.

---

## 8. Auditability

Every important AI and financial decision must be traceable.

Audit records should capture:

- event
- timestamp
- transaction
- AI diagnosis
- AI recommendation
- confidence
- policy decision
- executed action
- execution result
- recovery amount
- escalation
- failure reason

The UI should eventually provide an understandable audit timeline.

---

## 9. Code Quality

Write production-quality TypeScript.

Prefer:

- small reusable functions
- clear types/interfaces
- meaningful variable names
- modular services
- explicit error handling
- validation at API boundaries
- reusable components

Avoid:

- unnecessary abstraction
- duplicated logic
- giant files
- hardcoded business logic in UI
- `any` unless genuinely necessary
- dead code
- placeholder implementations presented as complete functionality

---

## 10. Dependencies

Do not install new packages without first explaining:

1. Why the package is needed.
2. What problem it solves.
3. Whether the existing stack can solve the problem without it.

Avoid unnecessary frameworks and libraries.

Do not replace the existing stack without approval.

---

## 11. Secrets and Environment Variables

Never hardcode:

- API keys
- database credentials
- JWT secrets
- tokens
- passwords

Use environment variables.

Never commit `.env` files containing secrets.

Maintain a `.env.example` with safe placeholder names.

---

## 12. Git Discipline

Make changes in small, understandable increments.

Before major architectural changes:

- explain the change
- identify affected files
- identify risks

Do not delete or rewrite large portions of the project without approval.

Do not overwrite working functionality unnecessarily.

---

## 13. UI/UX

The product should feel like a serious fintech operations platform, not a generic AI chatbot.

Prioritize:

- clarity
- data density where useful
- readable financial metrics
- obvious agent status
- explainable decisions
- recovery outcomes
- auditability
- responsive design

Avoid unnecessary animations and decorative AI gimmicks.

The main demo should quickly communicate:

Revenue at Risk

→ Agent Investigation

→ Recommended Recovery

→ Policy Decision

→ Action

→ Money Recovered

→ Audit Trail

---

## 14. Development Workflow

Before implementing a significant feature:

1. Understand the existing architecture.
2. Explain the proposed implementation.
3. Identify files that will change.
4. Implement the smallest useful version.
5. Run lint/type checks/tests.
6. Fix errors.
7. Verify the feature.
8. Summarize what changed.

Do not blindly generate the entire application from one prompt.

---

## 15. Current Development Strategy

Build incrementally in this order:

Phase 1:

Project foundation and backend setup.

Phase 2:

Revenue event and transaction simulator.

Phase 3:

Revenue-at-risk detection.

Phase 4:

AI diagnosis.

Phase 5:

Recovery planning.

Phase 6:

Deterministic policy/guardrail engine.

Phase 7:

Bounded action execution.

Phase 8:

Evaluation and baseline comparison.

Phase 9:

Audit trail.

Phase 10:

Merchant dashboard and polished demo UX.

Phase 11:

Testing, security review, performance review, and final demo preparation.

---

## 16. Important Instruction

Do not invent Razorpay APIs, capabilities, integrations, or production behavior.

If a Razorpay integration is required, clearly distinguish between:

- documented/test-mode integration
- simulated behavior
- project-specific implementation

The competition demo must remain functional even if external payment APIs are unavailable.

---

## 17. Engineering Philosophy

Prefer a smaller system that is:

- reliable
- measurable
- explainable
- testable
- demoable

over a larger system with impressive-sounding but unreliable features.

The goal is not to maximize the number of AI agents.

The goal is to demonstrate a credible AI-powered revenue recovery system with measurable business value and strong financial guardrails.