-- =========================================================
-- 003_seed.sql — development seed data
-- Safe to re-run: every insert uses NOT EXISTS / ON CONFLICT.
-- =========================================================

-- ── Tenant ───────────────────────────────────────────────
insert into tenants (name)
values ('origina-dev')
on conflict (name) do nothing;

-- ── Roles ────────────────────────────────────────────────
insert into roles (tenant_id, name, description)
select t.id, r.name, r.description
from tenants t
cross join (values
  ('admin',       'Full access'),
  ('underwriter', 'Underwriting role'),
  ('processor',   'Processing role'),
  ('broker',      'Broker role'),
  ('viewer',      'Read-only')
) as r(name, description)
where t.name = 'origina-dev'
on conflict (tenant_id, name) do nothing;

-- ── Users ────────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev')
insert into users (tenant_id, email, full_name, password_hash, is_active)
select t.id, u.email, u.full_name, u.password_hash, true
from tenant t
cross join (values
  ('admin@origina.dev',       'Admin User',        'dev-password-hash'),
  ('underwriter@origina.dev', 'Uma Underwriter',   'dev-password-hash'),
  ('processor@origina.dev',   'Parker Processor',  'dev-password-hash'),
  ('broker@origina.dev',      'Bailey Broker',     'dev-password-hash')
) as u(email, full_name, password_hash)
where not exists (select 1 from users u2 where u2.tenant_id = t.id and u2.email = u.email);

-- ── User roles ───────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
role_map as (select r.id, r.name from roles r join tenant t on r.tenant_id = t.id),
user_map as (select u.id, u.email from users u join tenant t on u.tenant_id = t.id)
insert into user_roles (tenant_id, user_id, role_id)
select t.id, u.id, r.id
from tenant t
join user_map u on u.email in ('admin@origina.dev','underwriter@origina.dev','processor@origina.dev','broker@origina.dev')
join role_map r on (
  (u.email = 'admin@origina.dev'       and r.name = 'admin') or
  (u.email = 'underwriter@origina.dev' and r.name = 'underwriter') or
  (u.email = 'processor@origina.dev'   and r.name = 'processor') or
  (u.email = 'broker@origina.dev'      and r.name = 'broker')
)
where not exists (
  select 1 from user_roles ur where ur.tenant_id = t.id and ur.user_id = u.id and ur.role_id = r.id
);

-- ── Parties ──────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev')
insert into parties (id, tenant_id, party_type, display_name, first_name, last_name, email, phone)
select p.id::uuid, t.id, p.pt::party_type, p.display_name, p.first_name, p.last_name, p.email, p.phone
from tenant t
cross join (values
  ('aaaa1111-1111-1111-1111-111111111111', 'person',  'Jordan Rivera',  'Jordan', 'Rivera', 'jordan.rivera@example.com', '555-0101'),
  ('aaaa2222-2222-2222-2222-222222222222', 'person',  'Taylor Reed',    'Taylor', 'Reed',   'taylor.reed@example.com',   '555-0102'),
  ('aaaa3333-3333-3333-3333-333333333333', 'company', 'Sunrise Realty', null,     null,     'info@sunriserealty.example','555-0103'),
  ('aaaa4444-4444-4444-4444-444444444444', 'company', 'Peak Brokerage', null,     null,     'ops@peakbrokerage.example', '555-0104')
) as p(id, pt, display_name, first_name, last_name, email, phone)
where not exists (
  select 1 from parties p2
  where p2.tenant_id = t.id and p2.display_name = p.display_name and p2.party_type = p.pt::party_type
);

-- ── Loans (header only) ──────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into loans (id, tenant_id, loan_number, status, assigned_to, submitted_at, application_date, purpose, loan_program, loan_product, occupancy_type)
select l.id::uuid, t.id, l.loan_number, l.status::loan_status, a.id,
       l.submitted_at::date, l.application_date::date, l.purpose::loan_purpose,
       l.loan_program, l.loan_product, l.occupancy_type
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('11111111-1111-1111-1111-111111111111', 'LN-10001', 'submitted',         '2024-06-01', '2024-05-20', 'purchase',  'bank_statement', '30yr_fixed', 'owner_occupied'),
  ('22222222-2222-2222-2222-222222222222', 'LN-10002', 'conditions_review', '2024-06-15', '2024-06-05', 'refinance', 'dscr',           '30yr_fixed', 'investment')
) as l(id, loan_number, status, submitted_at, application_date, purpose, loan_program, loan_product, occupancy_type)
where not exists (select 1 from loans l2 where l2.id = l.id::uuid);

-- ── Loan financials ──────────────────────────────────────
insert into loan_financials (tenant_id, loan_id, loan_amount, purchase_price, appraised_value, down_payment, ltv, cltv, fico_score, debt_to_income)
select l.tenant_id, l.id, lf.loan_amount, lf.purchase_price, lf.appraised_value, lf.down_payment, lf.ltv, lf.cltv, lf.fico_score, lf.dti
from loans l
join (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 350000.00::numeric, 380000.00::numeric, 390000.00::numeric, 30000.00::numeric, 89.74::numeric, 89.74::numeric, 742::int, 31.50::numeric),
  ('22222222-2222-2222-2222-222222222222'::uuid, 525000.00::numeric, 600000.00::numeric, 605000.00::numeric, 75000.00::numeric, 86.78::numeric, 86.78::numeric, 703::int, 36.20::numeric)
) as lf(loan_id, loan_amount, purchase_price, appraised_value, down_payment, ltv, cltv, fico_score, dti) on l.id = lf.loan_id
where not exists (select 1 from loan_financials lf2 where lf2.loan_id = l.id);

-- ── Loan terms ───────────────────────────────────────────
insert into loan_terms (tenant_id, loan_id, interest_rate, initial_rate, term_months, amortization_type, rate_type, payment_type)
select l.tenant_id, l.id, lt.interest_rate, lt.initial_rate, lt.term_months, lt.amortization_type, lt.rate_type, lt.payment_type
from loans l
join (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 7.125::numeric, 7.125::numeric, 360::int, 'fixed', 'fixed', 'principal_and_interest'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 7.500::numeric, 7.500::numeric, 360::int, 'fixed', 'fixed', 'principal_and_interest')
) as lt(loan_id, interest_rate, initial_rate, term_months, amortization_type, rate_type, payment_type) on l.id = lt.loan_id
where not exists (select 1 from loan_terms lt2 where lt2.loan_id = l.id);

-- ── Loan parties ─────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
party_map as (select id, display_name from parties where display_name in ('Jordan Rivera','Taylor Reed','Sunrise Realty','Peak Brokerage')),
lp_data as (
  select display_name, role, is_primary, loan_id::uuid as loan_id from (values
    ('Jordan Rivera',  'borrower',    true,  '11111111-1111-1111-1111-111111111111'),
    ('Taylor Reed',    'co_borrower', false, '11111111-1111-1111-1111-111111111111'),
    ('Peak Brokerage', 'broker',      false, '11111111-1111-1111-1111-111111111111'),
    ('Sunrise Realty', 'seller',      false, '22222222-2222-2222-2222-222222222222')
  ) as v(display_name, role, is_primary, loan_id)
)
insert into loan_parties (tenant_id, loan_id, party_id, role, is_primary)
select t.id, lp.loan_id, p.id, lp.role::loan_party_role, lp.is_primary
from tenant t
join lp_data lp on true
join party_map p on p.display_name = lp.display_name
where not exists (
  select 1 from loan_parties lp2
  where lp2.tenant_id = t.id and lp2.loan_id = lp.loan_id and lp2.party_id = p.id and lp2.role = lp.role::loan_party_role
);

-- ── Properties ───────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev')
insert into properties (id, tenant_id, loan_id, is_subject, address1, city, state, postal_code, property_type, occupancy)
select p.id::uuid, t.id, p.loan_id::uuid, true, p.address1, p.city, p.state, p.postal_code, p.property_type, p.occupancy
from tenant t
cross join (values
  ('bbbb1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '123 Alder St', 'Seattle',  'WA', '98101', 'single_family', 'owner_occupied'),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '987 Pine Ave', 'Portland', 'OR', '97205', 'condo',         'investment')
) as p(id, loan_id, address1, city, state, postal_code, property_type, occupancy)
where not exists (select 1 from properties p2 where p2.id = p.id::uuid);

-- ── Conditions ───────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev')
insert into conditions (id, tenant_id, loan_id, name, description, condition_number, status)
select c.id::uuid, t.id, c.loan_id::uuid, c.name, c.description, c.condition_number, c.status::condition_status
from tenant t
cross join (values
  ('cccc1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Proof of Income',  'Provide most recent pay stubs.',         1, 'open'),
  ('cccc2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Bank Statements',  'Most recent 2 months of statements.',    2, 'submitted'),
  ('cccc3333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Title Report',     'Order updated title report.',            1, 'open')
) as c(id, loan_id, name, description, condition_number, status)
where not exists (select 1 from conditions c2 where c2.id = c.id::uuid);

-- ── Exceptions ───────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
admin_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'admin@origina.dev')
insert into exceptions (id, tenant_id, loan_id, exception_type, title, description, status, severity, requested_by, decided_by, decided_at)
select e.id::uuid, t.id, e.loan_id::uuid, e.exception_type, e.title, e.description, e.status::exception_status, e.severity::exception_severity, a.id, a.id, e.decided_at::timestamptz
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('eeee1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ltv', 'High LTV Exception', 'Request to approve 89.74 LTV.', 'approved', 'medium', '2024-06-10 10:00:00+00')
) as e(id, loan_id, exception_type, title, description, status, severity, decided_at)
where not exists (select 1 from exceptions e2 where e2.id = e.id::uuid);

-- ── Tasks ────────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
processor_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'processor@origina.dev')
insert into tasks (id, tenant_id, loan_id, title, description, status, priority, assigned_to, due_at, created_by)
select tk.id::uuid, t.id, tk.loan_id::uuid, tk.title, tk.description, tk.status::task_status, tk.priority::task_priority, p.id, tk.due_at::timestamptz, p.id
from tenant t
join processor_user p on p.tenant_id = t.id
cross join (values
  ('dade0001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Verify Employment', 'Confirm employment status with employer.', 'in_progress', 'high',   '2024-06-18 17:00:00+00'),
  ('dade0002-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Order Appraisal',  'Request appraisal through AMC.',           'todo',        'normal',  '2024-06-20 17:00:00+00')
) as tk(id, loan_id, title, description, status, priority, due_at)
where not exists (select 1 from tasks t2 where t2.id = tk.id::uuid);

-- ── Notes ────────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
admin_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'admin@origina.dev')
insert into notes (id, tenant_id, loan_id, body, created_by)
select n.id::uuid, t.id, n.loan_id::uuid, n.body, a.id
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('deed0001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Borrower submitted updated pay stubs.'),
  ('deed0002-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Title report ordered with local vendor.')
) as n(id, loan_id, body)
where not exists (select 1 from notes n2 where n2.id = n.id::uuid);

-- ── Loan status events ───────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
underwriter_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'underwriter@origina.dev')
insert into loan_status_events (id, tenant_id, loan_id, from_status, to_status, reason, actor_user_id, occurred_at)
select e.id::uuid, t.id, e.loan_id::uuid, e.from_status::loan_status, e.to_status::loan_status, e.reason, u.id, e.occurred_at::timestamptz
from tenant t
join underwriter_user u on u.tenant_id = t.id
cross join (values
  ('beef0001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'new_draft', 'submitted',         'Initial submission',       '2024-06-01 09:00:00+00'),
  ('beef0002-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'submitted', 'conditions_review', 'Conditions review started', '2024-06-12 09:00:00+00')
) as e(id, loan_id, from_status, to_status, reason, occurred_at)
where not exists (select 1 from loan_status_events e2 where e2.id = e.id::uuid);

-- ── Documents ────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
admin_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'admin@origina.dev')
insert into documents (id, tenant_id, loan_id, doc_type, file_name, mime_type, file_size_bytes, storage_key, sha256, uploaded_by, uploaded_at, tags)
select d.id::uuid, t.id, d.loan_id::uuid, d.doc_type, d.file_name, d.mime_type, d.file_size_bytes::bigint, d.storage_key, d.sha256, a.id, d.uploaded_at::timestamptz, d.tags::jsonb
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('dddd1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'paystub', 'paystub_jun.pdf',    'application/pdf', '128432', 'loans/11111111/paystub_jun.pdf', 'hash-paystub-jun', '2024-06-02 12:00:00+00', '{"category":"income"}'),
  ('dddd2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'id',      'driver_license.png', 'image/png',        '56321',  'loans/22222222/license.png',     'hash-license',     '2024-06-06 15:30:00+00', '{"category":"identity"}')
) as d(id, loan_id, doc_type, file_name, mime_type, file_size_bytes, storage_key, sha256, uploaded_at, tags)
where not exists (select 1 from documents d2 where d2.id = d.id::uuid);

-- ── Pricing runs ─────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
underwriter_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'underwriter@origina.dev')
insert into pricing_runs (id, tenant_id, loan_id, run_at, run_by, input_hash, input_payload, output_payload)
select pr.id::uuid, t.id, pr.loan_id::uuid, pr.run_at::timestamptz, u.id, pr.input_hash, pr.input_payload::jsonb, pr.output_payload::jsonb
from tenant t
join underwriter_user u on u.tenant_id = t.id
cross join (values
  ('cafe0001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', '2024-06-03 10:00:00+00', 'pricing-input-111', '{"loan_amount":350000,"fico":742}', '{"rate":6.25,"points":0.5}')
) as pr(id, loan_id, run_at, input_hash, input_payload, output_payload)
where not exists (select 1 from pricing_runs pr2 where pr2.id = pr.id::uuid);

-- ── Eligibility runs ─────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev'),
underwriter_user as (select u.id, u.tenant_id from users u join tenant t on u.tenant_id = t.id where u.email = 'underwriter@origina.dev')
insert into eligibility_runs (id, tenant_id, loan_id, run_at, run_by, input_hash, input_payload, output_payload)
select er.id::uuid, t.id, er.loan_id::uuid, er.run_at::timestamptz, u.id, er.input_hash, er.input_payload::jsonb, er.output_payload::jsonb
from tenant t
join underwriter_user u on u.tenant_id = t.id
cross join (values
  ('fade0001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', '2024-06-03 10:05:00+00', 'eligibility-input-111', '{"ltv":89.74,"dti":31.5}', '{"eligible":true}')
) as er(id, loan_id, run_at, input_hash, input_payload, output_payload)
where not exists (select 1 from eligibility_runs er2 where er2.id = er.id::uuid);

-- ── Addresses ────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev')
insert into addresses (id, tenant_id, street1, city, state, postal_code, country)
select a.id::uuid, t.id, a.street1, a.city, a.state, a.postal_code, a.country
from tenant t
cross join (values
  ('add00001-0000-0000-0000-000000000001', '123 Alder St', 'Seattle', 'WA', '98101', 'US'),
  ('add00002-0000-0000-0000-000000000002', '456 Maple Rd',  'Seattle', 'WA', '98109', 'US')
) as a(id, street1, city, state, postal_code, country)
where not exists (select 1 from addresses a2 where a2.id = a.id::uuid);

-- ── Borrowers ────────────────────────────────────────────
with tenant as (select id from tenants where name = 'origina-dev')
insert into borrowers (
  id, tenant_id, loan_id, type, first_name, last_name, ssn_last4, dob, phone, email,
  current_address_id, mailing_address_id, borrower_relationship, income_type, income_amount,
  ethnicity, race, gender, marital_status, dependents,
  employment_status, employer_name, job_title, years_on_job, years_in_profession, work_phone, work_email
)
select
  b.id::uuid, t.id, b.loan_id::uuid, b.btype::borrower_type,
  b.first_name, b.last_name, b.ssn_last4, b.dob::date, b.phone, b.email,
  b.current_address_id::uuid, b.mailing_address_id::uuid,
  b.borrower_relationship::borrower_relationship, b.income_type::borrower_income_type, b.income_amount::numeric,
  b.ethnicity, b.race, b.gender, b.marital_status, b.dependents::int,
  b.employment_status, b.employer_name, b.job_title, b.years_on_job::int, b.years_in_profession::int,
  b.work_phone, b.work_email
from tenant t
cross join (values
  ('bbbb9999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111',
   'primary_borrower', 'Jordan', 'Rivera', '1234', '1985-07-12', '555-0101', 'jordan.rivera@example.com',
   'add00001-0000-0000-0000-000000000001', 'add00001-0000-0000-0000-000000000001',
   'spouse', 'salary', '9200.00', 'not_hispanic', 'white', 'male', 'married', '2',
   'employed', 'Evergreen Tech', 'Senior Engineer', '5', '10', '555-0105', 'jordan.rivera@work.example'),
  ('bbbb8888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111',
   'co_borrower', 'Taylor', 'Reed', '5678', '1987-03-09', '555-0102', 'taylor.reed@example.com',
   'add00002-0000-0000-0000-000000000002', 'add00002-0000-0000-0000-000000000002',
   'spouse', 'salary', '7600.00', 'not_hispanic', 'asian', 'female', 'married', '1',
   'employed', 'Cascade Health', 'Analyst', '4', '8', '555-0106', 'taylor.reed@work.example')
) as b(
  id, loan_id, btype, first_name, last_name, ssn_last4, dob, phone, email,
  current_address_id, mailing_address_id, borrower_relationship, income_type, income_amount,
  ethnicity, race, gender, marital_status, dependents,
  employment_status, employer_name, job_title, years_on_job, years_in_profession, work_phone, work_email
)
where not exists (select 1 from borrowers b2 where b2.id = b.id::uuid);
