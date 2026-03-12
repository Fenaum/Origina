INSERT INTO tenants (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Tenant')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (
  id,
  tenant_id,
  email,
  full_name,
  password_hash
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'underwriter@demo.com',
  'Demo Underwriter',
  'fake_hash_for_now'
)
ON CONFLICT (tenant_id, email) DO NOTHING;


INSERT INTO loans (
  tenant_id,
  loan_number,
  product_type,
  purpose,
  status,
  assigned_to,
  loan_amount,
  purchase_price,
  appraised_value,
  product_data
)
VALUES
(
  '11111111-1111-1111-1111-111111111111', -- tenant_id
  'DSCR-0001',
  'DSCR',
  'purchase',
  'underwriting',
  '22222222-2222-2222-2222-222222222222', -- assigned_to (underwriter)
  637500.00,
  850000.00,
  875000.00,
  jsonb_build_object(
    'dscr', 1.32,
    'monthly_rent', 5200,
    'monthly_piti', 3930,
    'occupancy', 'investment',
    'property_type', 'SFR'
  )
),
(
  '11111111-1111-1111-1111-111111111111',
  'DSCR-0002',
  'DSCR',
  'refi',
  'submitted',
  NULL,
  840000.00,
  NULL,
  1200000.00,
  jsonb_build_object(
    'dscr', 1.18,
    'monthly_rent', 6100,
    'monthly_piti', 5170,
    'property_type', '2-4 Unit'
  )
),
(
  '11111111-1111-1111-1111-111111111111',
  'BS-0003',
  'BankStatement',
  'purchase',
  'new',
  NULL,
  487500.00,
  650000.00,
  660000.00,
  jsonb_build_object(
    'income_avg_12mo', 18500,
    'expense_ratio', 0.35,
    'qualifying_income', 12025,
    'borrower_type', 'self_employed'
  )
);


