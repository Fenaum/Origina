# Origina LOS Web Application — MVP Document

## 1. Purpose of the MVP

The Origina LOS MVP aims to deliver the first web-based, cloud-native loan origination platform purpose-built to modernize and disrupt the Non-QM mortgage sector. Traditional Non-QM lenders rely on outdated desktop LOS systems, manual workflows, and heavy Account Executive (AE) involvement—resulting in slow turn times, inconsistent broker experience, and high operational costs.

This MVP establishes Origina as a **technology-first Non-QM lender**, delivering a streamlined loan cycle, superior user experience, and automated broker engagement through a modern browser interface.

The goal is to validate that a large portion of the Non-QM loan process—submission, communication, document management, and post-processing—can be reliably executed without legacy software or unnecessary human intervention.

## 2. MVP Objectives

### 2.1 Business Objectives

- **Position Origina as the most innovative Non-QM lender** by replacing patches, desktops, and manual processes with a full cloud ecosystem.
- **Increase AE capacity and reduce repetitive work** through in-app guidance and automation, enabling one AE to manage a larger broker portfolio.
- **Enable brokers to submit, track, and manage Non-QM loans** without calling, emailing, or waiting for manual updates.
- **Reduce operational costs** by eliminating physical infrastructure, data centers, and legacy client software.
- **Increase speed-to-close** by improving transparency, real-time communication, and automated reminders.

### 2.2 Technical Objectives

- Deliver a secure, scalable, cloud-native web application available on any browser.
- Create an extensible architecture to integrate future Non-QM automations (pricing engine, risk models, plaid-like financial verification).
- Establish a structured, compliant data model tailored to Non-QM requirements.
- Enable role-based access for brokers, processors, underwriters, and AEs.

## 3. MVP Scope

### 3.1 Key Innovations (Non-QM Focus)

These innovations differentiate Origina from traditional LOS platforms:

#### Automated AE Assistant

- Intelligent tooltips, contextual guidance, and automated notifications that reduce repetitive AE communication.
- In-app steps guiding brokers through Non-QM submission requirements (bank statements, DSCR checks, asset docs).
- Auto-generated updates instead of manual AE follow-ups.

#### Broker Self-Service Portal

- Brokers can submit loans, upload documents, track conditions, message staff, and resolve issues—**no AE needed for routine interactions**.

#### Non-QM–Optimized Loan Intake

- Smart 1003 experience that dynamically adjusts to the loan product (bank statement, DSCR, ITIN, asset qualifier).
- Real-time field validation based on Non-QM guidelines.

#### Cloud-Native Document Handling

- Uploads stored securely in AWS S3.
- Document checklist adapted specifically for Non-QM documentation types.

#### Pipeline Transparency

- Clear statuses, color-coded priority indicators, and real-time updates.
- Consistent user experience that eliminates ambiguity common in Non-QM submissions.

### 3.2 In-Scope Functional Areas

#### 1. User Onboarding & Role Management

- Broker self-registration
- AE dashboard for pipeline oversight
- Processor/underwriter access to submitted files
- MFA-enabled login

#### 2. Loan Application Submission

- Simplified digital 1003 form for Non-QM
- Auto-save and resume
- Validation rules targeting common Non-QM issues
- Loan summary page

#### 3. Document Upload Center

- Drag & drop uploads
- Presigned URL handling via AWS
- Non-QM document checklist populated by product type

#### 4. Communication & Transparency

- Messaging center tied to each loan
- Automated status notifications replacing AE manual outreach
- Broker guidance embedded directly in the UI

#### 5. Pipeline Dashboard

- A streamlined, modern overview of loan status and bottlenecks
- AE view and Broker view
- Filters for product type, duration, status, and urgency

## 4. Out-of-Scope (Future Enhancements)

- Automated underwriting engine for Non-QM
- Real-time Non-QM pricing engine
- VOI/VOE/VOA integrations (Plaid-like functionality)
- eDisclosures and eSign
- Full conditions management workflow
- Secondary market matching
- Fraud detection / income model automation

## 5. Personas

### Broker

Primary user; needs a fast, transparent way to submit and track Non-QM loans without repeatedly contacting AEs.

### Processor / Underwriter

Needs to quickly evaluate submissions, communicate requirements, and manage pipeline.

### Account Executive

Transitioning from "communication-heavy" role to oversight and relationship management, supported by automated tools.

### Origina Admin

Manages user accounts, access, system configuration, and compliance controls.

## 6. Architecture Overview

### Frontend

- **Next.js + React**
- Tailwind + Shadcn/UI for a modern, mobile-responsive Non-QM optimized UI
- Server-side rendering for performance
- Role-based routing

### Backend

- **Python (FastAPI)** or **Node.js (NestJS)**
- Modular API design (loan service, document service, user service)
- Authentication + authorization layer
- Event-driven notifications (SNS or WebSockets later)

### Data Layer

- **AWS RDS (PostgreSQL)** for structured loan data
- **AWS S3** for all documents
- Redis caching (optional)
- Encrypted at rest + IAM-bound access

## 7. Success Metrics

### Adoption Metrics

- 80% of test brokers complete a full Non-QM submission without AE help.
- 40% reduction in AE-broker phone calls within 30 days.

### Operational Metrics

- Loan submission time reduced by at least 25%.
- Document ingestion accuracy increased through clearer checklists.
- 99.5% platform uptime.

### Experience Metrics

- Broker satisfaction score ≥ 8/10.
- AE time spent on routine communications reduced by 50%.

## 8. Risks & Assumptions

### Risks

- Brokers may initially resist self-service behavior.
- Complex Non-QM guidelines may require additional rules earlier than expected.
- Legacy desktop LOS may not integrate seamlessly.

### Assumptions

- Compliance team will validate form fields and guidelines early.
- Only key Non-QM products are supported in MVP.
- AE automation will gradually replace manual tasks, not immediately remove them.

## 9. Roadmap

### MVP (3–4 Months)

- Frontend framework + UI library
- User onboarding
- Non-QM digital 1003
- Document center
- Messaging + notifications
- Pipeline dashboards
- AE automation basics

### Phase 1

- Conditions engine
- Pricing + manual rate sheet automation
- Enhanced AE performance analytics
- Broker review system

### Phase 2

- Automated underwriting + decisioning
- Plaid-style asset validation
- eSign + disclosures
- AI/smart loan insights
- End-to-end AE automation

---

## Appendix: Original Core MVP Notes

Goal: a fully functional, compliant Non-QM LOS web app that can be demoed and security-reviewed by your company. Keep integrations minimal; focus on controls, auditability, and the Non-QM-specific underwriting engines.

Core MVP features

- Loan intake (1003-lite) + borrower/co-borrower profiles (PII encrypted).
- Document upload portal (borrower + broker) with versioning and audit trail.
- Bank-statement upload + bank-statement income calculator (configurable 12/24/36mo).
- DSCR calculator and P&L/1099/P&L inputs.
- Rule-based underwriting engine (configurable rulesets / overlays per program).
- Conditions & task management (auto-generate conditions based on rules).
- Pricing grid import (Excel → JSON) and simple pricing engine.
- User roles & RBAC: Admin, Underwriter, Processor, Broker, Auditor.
- Full audit logging (who/what/when) and immutable event log.
- Export capability for HMDA fields and MERS/MIN placeholders (no live MERS).
- Basic borrower/broker notifications (email).
- Admin UI to edit underwriting rules (no code).

Minimum compliance & security controls (MVP-ready)

- Field-level encryption for SSN/DOB (client-side where possible).
- TLS everywhere + HTTP security headers.
- MFA for admin/underwriter accounts.
- Access logs, CloudTrail-style event capture.
- Retention policy + S3 lifecycle for docs.
- Permission-scoped document access (least privilege).
- Data export for auditors (human-readable and machine export).

What you can postpone (non-MVP)

- Full MERS integration / eNote / eVault.
- DU/LP integrations.
- SOC2 audit.
- Full TRID automation (you can implement fields/timestamps but legal signoff required before automation).
  Goal: a fully functional, compliant Non-QM LOS web app that can be demoed and security-reviewed by your company. Keep integrations minimal; focus on controls, auditability, and the Non-QM-specific underwriting engines.

Core MVP features
• Loan intake (1003-lite) + borrower/co-borrower profiles (PII encrypted).
• Document upload portal (borrower + broker) with versioning and audit trail.
• Bank-statement upload + bank-statement income calculator (configurable 12/24/36mo).
• DSCR calculator and P&L/1099/P&L inputs.
• Rule-based underwriting engine (configurable rulesets / overlays per program).
• Conditions & task management (auto-generate conditions based on rules).
• Pricing grid import (Excel → JSON) and simple pricing engine.
• User roles & RBAC: Admin, Underwriter, Processor, Broker, Auditor.
• Full audit logging (who/what/when) and immutable event log.
• Export capability for HMDA fields and MERS/MIN placeholders (no live MERS).
• Basic borrower/broker notifications (email).
• Admin UI to edit underwriting rules (no code).

Minimum compliance & security controls (MVP-ready)
• Field-level encryption for SSN/DOB (client-side where possible).
• TLS everywhere + HTTP security headers.
• MFA for admin/underwriter accounts.
• Access logs, CloudTrail-style event capture.
• Retention policy + S3 lifecycle for docs.
• Permission-scoped document access (least privilege).
• Data export for auditors (human-readable and machine export).

What you can postpone (non-MVP)
• Full MERS integration / eNote / eVault.
• DU/LP integrations.
• SOC2 audit.
• Full TRID automation (you can implement fields/timestamps but legal signoff required before automation).

