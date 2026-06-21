-- ============================================================
-- 124_controlled_values.sql
-- Add controlled_value_sets + controlled_values tables.
--
-- PURPOSE:
--   All hard-coded taxonomy values (exception categories, reason
--   codes, factor codes, document types, loan programs, etc.) move
--   here. System-level rows (tenant_id IS NULL) are the canonical
--   set. Tenant-level rows extend or override without a deployment.
--
-- DESIGN:
--   controlled_value_sets  — one row per namespace (e.g. "exception_category")
--   controlled_values       — the individual codes within that namespace
--
--   tenant_id IS NULL  → system / global default
--   tenant_id = X     → tenant-specific override or extension
--
--   The API layer merges system rows with tenant rows at query time:
--   tenant rows with the same code shadow system rows, allowing label
--   customization without data migration.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS controlled_value_sets (
  code        TEXT PRIMARY KEY,
  scope       TEXT NOT NULL DEFAULT 'global'
                CHECK (scope IN ('global', 'tenant', 'product')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlled_values (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_code    TEXT        NOT NULL REFERENCES controlled_value_sets(code) ON DELETE CASCADE,
  tenant_id   UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  description TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique per (set, tenant-or-null, code)
  CONSTRAINT uq_controlled_value UNIQUE NULLS NOT DISTINCT (set_code, tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cv_set_tenant ON controlled_values (set_code, tenant_id NULLS FIRST, sort_order);
CREATE INDEX IF NOT EXISTS idx_cv_tenant ON controlled_values (tenant_id) WHERE tenant_id IS NOT NULL;

-- ── Value sets ────────────────────────────────────────────────
INSERT INTO controlled_value_sets (code, scope, description) VALUES
  ('exception_primary_category', 'global', 'Top-level exception category for reporting and routing'),
  ('exception_type',             'global', 'Specific type of guideline exception being requested'),
  ('exception_reason_code',      'global', 'Business rationale code for the exception request'),
  ('exception_metric_type',      'global', 'The underwriting metric being measured'),
  ('exception_metric_unit',      'global', 'Unit of measurement for exception variance'),
  ('compensating_factor',        'global', 'Positive risk offsets cited in an exception request'),
  ('risk_factor',                'global', 'Risk elements flagged in an exception request'),
  ('exception_condition_category','global','Category of an imposed exception condition'),
  ('loan_program',               'global', 'Non-QM loan program classification'),
  ('loan_purpose',               'global', 'Canonical loan purpose codes used in DB and API'),
  ('loan_purpose_label',         'global', 'Display labels for loan purpose (may differ by lender)'),
  ('occupancy_type',             'global', 'Property occupancy classification'),
  ('property_type',              'global', 'Property structure type'),
  ('document_type',              'global', 'Document classification for the document checklist'),
  ('condition_stage',            'global', 'Workflow milestone stage for loan conditions'),
  ('borrower_relationship',      'global', 'Relationship of co-borrower to primary borrower'),
  ('borrower_income_type',       'global', 'Income documentation type for the borrower'),
  ('cashout_type',               'global', 'Nature of cash-out refinance proceeds')
ON CONFLICT (code) DO NOTHING;

-- ── exception_primary_category ────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('exception_primary_category', 'credit',            'Credit',                1),
  ('exception_primary_category', 'collateral',        'Collateral',            2),
  ('exception_primary_category', 'income',            'Income',                3),
  ('exception_primary_category', 'assets_reserves',   'Assets / Reserves',     4),
  ('exception_primary_category', 'pricing',           'Pricing',               5),
  ('exception_primary_category', 'product_guideline', 'Product / Guideline',   6),
  ('exception_primary_category', 'broker_account',    'Broker / Account',      7),
  ('exception_primary_category', 'documentation',     'Documentation',         8),
  ('exception_primary_category', 'compliance',        'Compliance',            9),
  ('exception_primary_category', 'other',             'Other',                99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── exception_type ────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('exception_type', 'ltv',             'LTV Exception',            1),
  ('exception_type', 'cltv',            'CLTV Exception',           2),
  ('exception_type', 'credit_score',    'Credit Score Exception',   3),
  ('exception_type', 'dscr',            'DSCR Exception',           4),
  ('exception_type', 'dti',             'DTI Exception',            5),
  ('exception_type', 'reserves',        'Reserve Exception',        6),
  ('exception_type', 'price_match',     'Price Match Exception',    7),
  ('exception_type', 'rate',            'Rate Exception',           8),
  ('exception_type', 'fee',             'Fee Exception',            9),
  ('exception_type', 'loan_amount',     'Loan Amount Exception',   10),
  ('exception_type', 'occupancy',       'Occupancy Exception',     11),
  ('exception_type', 'property_type',   'Property Type Exception', 12),
  ('exception_type', 'seasoning',       'Seasoning Exception',     13),
  ('exception_type', 'documentation',   'Documentation Exception', 14),
  ('exception_type', 'broker_approval', 'Broker Approval Exception',15),
  ('exception_type', 'income_type',     'Income Type Exception',   16),
  ('exception_type', 'employment',      'Employment Exception',    17),
  ('exception_type', 'other',           'Other',                   99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── exception_reason_code ─────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('exception_reason_code', 'strong_borrower_profile',       'Strong Borrower Profile',           1),
  ('exception_reason_code', 'minor_guideline_variance',      'Minor Guideline Variance',          2),
  ('exception_reason_code', 'competitive_price_match',       'Competitive Price Match',           3),
  ('exception_reason_code', 'investor_relationship',         'Investor Relationship',             4),
  ('exception_reason_code', 'strategic_broker_relationship', 'Strategic Broker Relationship',     5),
  ('exception_reason_code', 'operational_exception',         'Operational Exception',             6),
  ('exception_reason_code', 'prior_approval_precedent',      'Prior Approval Precedent',          7),
  ('exception_reason_code', 'compensating_risk_profile',     'Compensating Risk Profile',         8),
  ('exception_reason_code', 'other',                         'Other',                            99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── exception_metric_type ─────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('exception_metric_type', 'ltv',         'LTV (%)',         1),
  ('exception_metric_type', 'cltv',        'CLTV (%)',        2),
  ('exception_metric_type', 'fico',        'FICO Score',      3),
  ('exception_metric_type', 'dti',         'DTI (%)',         4),
  ('exception_metric_type', 'dscr',        'DSCR',            5),
  ('exception_metric_type', 'rate',        'Rate (%)',        6),
  ('exception_metric_type', 'months',      'Months',          7),
  ('exception_metric_type', 'loan_amount', 'Loan Amount ($)', 8),
  ('exception_metric_type', 'other',       'Other',          99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── exception_metric_unit ─────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('exception_metric_unit', 'pct',     '%',      1),
  ('exception_metric_unit', 'bps',     'bps',    2),
  ('exception_metric_unit', 'months',  'months', 3),
  ('exception_metric_unit', 'dollars', '$',      4),
  ('exception_metric_unit', 'points',  'points', 5)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── compensating_factor ───────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('compensating_factor', 'high_fico',              'High FICO',              1),
  ('compensating_factor', 'strong_reserves',        'Strong Reserves',        2),
  ('compensating_factor', 'low_ltv',                'Low LTV',                3),
  ('compensating_factor', 'low_dti',                'Low DTI',                4),
  ('compensating_factor', 'strong_dscr',            'Strong DSCR',            5),
  ('compensating_factor', 'stable_employment',      'Stable Employment',      6),
  ('compensating_factor', 'strong_payment_history', 'Strong Payment History', 7),
  ('compensating_factor', 'significant_liquidity',  'Significant Liquidity',  8),
  ('compensating_factor', 'strong_property_value',  'Strong Property Value',  9),
  ('compensating_factor', 'borrower_experience',    'Borrower Experience',   10),
  ('compensating_factor', 'low_layered_risk',       'Low Layered Risk',      11),
  ('compensating_factor', 'other',                  'Other',                 99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── risk_factor ───────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('risk_factor', 'high_ltv',                 'High LTV',                  1),
  ('risk_factor', 'low_fico',                 'Low FICO',                  2),
  ('risk_factor', 'high_dti',                 'High DTI',                  3),
  ('risk_factor', 'low_dscr',                 'Low DSCR',                  4),
  ('risk_factor', 'cash_out',                 'Cash-Out',                  5),
  ('risk_factor', 'investment_property',      'Investment Property',        6),
  ('risk_factor', 'limited_reserves',         'Limited Reserves',           7),
  ('risk_factor', 'recent_credit_event',      'Recent Credit Event',        8),
  ('risk_factor', 'thin_credit_profile',      'Thin Credit Profile',        9),
  ('risk_factor', 'concentration_risk',       'Concentration Risk',        10),
  ('risk_factor', 'incomplete_documentation', 'Incomplete Documentation',  11),
  ('risk_factor', 'pricing_concession',       'Pricing Concession',        12),
  ('risk_factor', 'other',                    'Other',                     99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── exception_condition_category ──────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('exception_condition_category', 'pricing',       'Pricing',       1),
  ('exception_condition_category', 'escrow',        'Escrow',        2),
  ('exception_condition_category', 'collateral',    'Collateral',    3),
  ('exception_condition_category', 'credit',        'Credit',        4),
  ('exception_condition_category', 'documentation', 'Documentation', 5),
  ('exception_condition_category', 'funding',       'Funding',       6),
  ('exception_condition_category', 'compliance',    'Compliance',    7),
  ('exception_condition_category', 'other',         'Other',        99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── loan_program ──────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('loan_program', 'dscr',           'DSCR',           1),
  ('loan_program', 'bank_statement',  'Bank Statement', 2),
  ('loan_program', 'asset_depletion', 'Asset Depletion',3),
  ('loan_program', 'interest_only',   'Interest Only',  4),
  ('loan_program', 'jumbo_non_qm',    'Jumbo Non-QM',   5),
  ('loan_program', 'conventional',    'Conventional',   6),
  ('loan_program', 'other',           'Other',         99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── loan_purpose ─────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('loan_purpose', 'purchase',  'Purchase',  1),
  ('loan_purpose', 'refinance', 'Refinance', 2),
  ('loan_purpose', 'cash_out',  'Cash-Out',  3),
  ('loan_purpose', 'other',     'Other',    99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── occupancy_type ────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('occupancy_type', 'owner_occupied', 'Owner Occupied', 1),
  ('occupancy_type', 'second_home',    'Second Home',    2),
  ('occupancy_type', 'investment',     'Investment',     3)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── property_type ─────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('property_type', 'single_family', 'Single Family', 1),
  ('property_type', 'condo',         'Condo',         2),
  ('property_type', 'townhouse',     'Townhouse',     3),
  ('property_type', 'multi_family',  'Multi-Family',  4),
  ('property_type', 'commercial',    'Commercial',    5)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── document_type ─────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order, metadata) VALUES
  ('document_type', 'bank_statement',      'Bank Statement',       1,  '{"category":"income","retention_years":7}'),
  ('document_type', 'tax_return',          'Tax Return',           2,  '{"category":"income","retention_years":7}'),
  ('document_type', 'pay_stub',            'Pay Stub',             3,  '{"category":"income","retention_years":3}'),
  ('document_type', 'w2',                  'W-2',                  4,  '{"category":"income","retention_years":7}'),
  ('document_type', '1099',                '1099',                 5,  '{"category":"income","retention_years":7}'),
  ('document_type', 'profit_loss',         'Profit & Loss',        6,  '{"category":"income","retention_years":3}'),
  ('document_type', 'appraisal',           'Appraisal',            10, '{"category":"collateral","retention_years":7}'),
  ('document_type', 'purchase_contract',   'Purchase Contract',    11, '{"category":"transaction","retention_years":7}'),
  ('document_type', 'title_commitment',    'Title Commitment',     12, '{"category":"title","retention_years":7}'),
  ('document_type', 'hoi',                 'Homeowners Insurance', 13, '{"category":"insurance","retention_years":1}'),
  ('document_type', 'flood_cert',          'Flood Certificate',    14, '{"category":"insurance","retention_years":7}'),
  ('document_type', 'lease_agreement',     'Lease Agreement',      15, '{"category":"income","retention_years":3}'),
  ('document_type', 'credit_auth',         'Credit Authorization', 20, '{"category":"credit","retention_years":3}'),
  ('document_type', 'id_document',         'Government ID',        21, '{"category":"identity","retention_years":7}'),
  ('document_type', 'voe',                 'Verification of Employment',22,'{"category":"income","retention_years":3}'),
  ('document_type', 'gift_letter',         'Gift Letter',          23, '{"category":"assets","retention_years":3}'),
  ('document_type', 'asset_statement',     'Asset Statement',      24, '{"category":"assets","retention_years":3}'),
  ('document_type', 'dscr_analysis',       'DSCR Analysis',        30, '{"category":"underwriting","retention_years":7}'),
  ('document_type', 'mismo_file',          'MISMO 3.4 File',       40, '{"category":"system","retention_years":7}'),
  ('document_type', 'other',               'Other',                99, '{"category":"other","retention_years":3}')
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── condition_stage ───────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('condition_stage', 'prior_to_docs',     'Prior to Docs',     1),
  ('condition_stage', 'prior_to_approval', 'Prior to Approval', 2),
  ('condition_stage', 'prior_to_funding',  'Prior to Funding',  3)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── borrower_relationship ─────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('borrower_relationship', 'spouse',           'Spouse',           1),
  ('borrower_relationship', 'domestic_partner', 'Domestic Partner', 2),
  ('borrower_relationship', 'parent',           'Parent',           3),
  ('borrower_relationship', 'child',            'Child',            4),
  ('borrower_relationship', 'sibling',          'Sibling',          5),
  ('borrower_relationship', 'business_partner', 'Business Partner', 6),
  ('borrower_relationship', 'other',            'Other',           99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── borrower_income_type ──────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('borrower_income_type', 'w2',             'W-2 Employment',      1),
  ('borrower_income_type', 'self_employed',  'Self-Employed',       2),
  ('borrower_income_type', 'rental',         'Rental Income',       3),
  ('borrower_income_type', 'investment',     'Investment Income',   4),
  ('borrower_income_type', 'retirement',     'Retirement / SS',     5),
  ('borrower_income_type', 'other',          'Other',              99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

-- ── cashout_type ──────────────────────────────────────────────
INSERT INTO controlled_values (set_code, code, label, sort_order) VALUES
  ('cashout_type', 'home_improvement', 'Home Improvement', 1),
  ('cashout_type', 'debt_consolidation','Debt Consolidation',2),
  ('cashout_type', 'investment',       'Investment',        3),
  ('cashout_type', 'business',         'Business Use',      4),
  ('cashout_type', 'other',            'Other',            99)
ON CONFLICT ON CONSTRAINT uq_controlled_value DO NOTHING;

COMMIT;
