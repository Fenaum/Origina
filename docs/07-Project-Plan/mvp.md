Goal: a fully functional, compliant Non-QM LOS web app that can be demoed and security-reviewed by your company. Keep integrations minimal; focus on controls, auditability, and the Non-QM-specific underwriting engines.

Core MVP features
	•	Loan intake (1003-lite) + borrower/co-borrower profiles (PII encrypted).
	•	Document upload portal (borrower + broker) with versioning and audit trail.
	•	Bank-statement upload + bank-statement income calculator (configurable 12/24/36mo).
	•	DSCR calculator and P&L/1099/P&L inputs.
	•	Rule-based underwriting engine (configurable rulesets / overlays per program).
	•	Conditions & task management (auto-generate conditions based on rules).
	•	Pricing grid import (Excel → JSON) and simple pricing engine.
	•	User roles & RBAC: Admin, Underwriter, Processor, Broker, Auditor.
	•	Full audit logging (who/what/when) and immutable event log.
	•	Export capability for HMDA fields and MERS/MIN placeholders (no live MERS).
	•	Basic borrower/broker notifications (email).
	•	Admin UI to edit underwriting rules (no code).

Minimum compliance & security controls (MVP-ready)
	•	Field-level encryption for SSN/DOB (client-side where possible).
	•	TLS everywhere + HTTP security headers.
	•	MFA for admin/underwriter accounts.
	•	Access logs, CloudTrail-style event capture.
	•	Retention policy + S3 lifecycle for docs.
	•	Permission-scoped document access (least privilege).
	•	Data export for auditors (human-readable and machine export).

What you can postpone (non-MVP)
	•	Full MERS integration / eNote / eVault.
	•	DU/LP integrations.
	•	SOC2 audit.
	•	Full TRID automation (you can implement fields/timestamps but legal signoff required before automation).