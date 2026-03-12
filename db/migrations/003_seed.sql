-- Create a default tenant (org/account scope for all data).
insert into tenants (name)
values ('origina-dev')
on conflict (name) do nothing;

-- Create basic roles for access control.
insert into roles (tenant_id, name, description)
select t.id, r.name, r.description
from tenants t
cross join (values
  ('admin','Full access'),
  ('underwriter','Underwriting role'),
  ('processor','Processing role'),
  ('broker','Broker role'),
  ('viewer','Read-only')
) as r(name, description)
where t.name = 'origina-dev'
on conflict (tenant_id, name) do nothing;

-- Create users for the default tenant.
with tenant as (
  select id from tenants where name = 'origina-dev'
)
insert into users (tenant_id, email, full_name, password_hash, is_active)
select t.id, u.email, u.full_name, u.password_hash, true
from tenant t
cross join (values
  ('admin@origina.dev', 'Admin User', 'dev-password-hash'),
  ('underwriter@origina.dev', 'Uma Underwriter', 'dev-password-hash'),
  ('processor@origina.dev', 'Parker Processor', 'dev-password-hash'),
  ('broker@origina.dev', 'Bailey Broker', 'dev-password-hash')
) as u(email, full_name, password_hash)
where not exists (
  select 1 from users u2 where u2.tenant_id = t.id and u2.email = u.email
);

-- Assign each user exactly one role (by email).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
role_map as (
  select r.id, r.name
  from roles r
  join tenant t on r.tenant_id = t.id
),
user_map as (
  select u.id, u.email
  from users u
  join tenant t on u.tenant_id = t.id
)
insert into user_roles (tenant_id, user_id, role_id)
select t.id, u.id, r.id
from tenant t
join user_map u on u.email in ('admin@origina.dev', 'underwriter@origina.dev', 'processor@origina.dev', 'broker@origina.dev')
join role_map r on (
  (u.email = 'admin@origina.dev' and r.name = 'admin') or
  (u.email = 'underwriter@origina.dev' and r.name = 'underwriter') or
  (u.email = 'processor@origina.dev' and r.name = 'processor') or
  (u.email = 'broker@origina.dev' and r.name = 'broker')
)
where not exists (
  select 1
  from user_roles ur
  where ur.tenant_id = t.id and ur.user_id = u.id and ur.role_id = r.id
);

-- Seed parties (people/companies tied to loans).
with tenant as (
  select id from tenants where name = 'origina-dev'
)
insert into parties (id, tenant_id, party_type, display_name, first_name, last_name, email, phone)
select p.id, t.id, p.party_type, p.display_name, p.first_name, p.last_name, p.email, p.phone
from tenant t
cross join (values
  ('aaaa1111-1111-1111-1111-111111111111', 'person', 'Jordan Rivera', 'Jordan', 'Rivera', 'jordan.rivera@example.com', '555-0101'),
  ('aaaa2222-2222-2222-2222-222222222222', 'person', 'Taylor Reed', 'Taylor', 'Reed', 'taylor.reed@example.com', '555-0102'),
  ('aaaa3333-3333-3333-3333-333333333333', 'company', 'Sunrise Realty', null, null, 'info@sunriserealty.example', '555-0103'),
  ('aaaa4444-4444-4444-4444-444444444444', 'company', 'Peak Brokerage', null, null, 'ops@peakbrokerage.example', '555-0104')
) as p(id, party_type, display_name, first_name, last_name, email, phone)
where not exists (
  select 1
  from parties p2
  where p2.tenant_id = t.id and p2.display_name = p.display_name and p2.party_type = p.party_type
);

-- Seed loans (core financials and status).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into loans (
  id, tenant_id, loan_number, status, assigned_to,
  loan_amount, purchase_price, appraised_value, down_payment, ltv, cltv,
  fico_score, debt_to_income, submitted_at, application_date, purpose
)
select
  l.id, t.id, l.loan_number, l.status, a.id,
  l.loan_amount, l.purchase_price, l.appraised_value, l.down_payment, l.ltv, l.cltv,
  l.fico_score, l.dti, l.submitted_at, l.application_date, l.purpose
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('11111111-1111-1111-1111-111111111111', 'LN-10001', 'submitted', 350000.00, 380000.00, 390000.00, 30000.00, 89.74, 89.74, 742, 31.5, date '2024-06-01', date '2024-05-20', 'purchase'::loan_purpose),
  ('22222222-2222-2222-2222-222222222222', 'LN-10002', 'conditions_review', 525000.00, 600000.00, 605000.00, 75000.00, 86.78, 86.78, 703, 36.2, date '2024-06-15', date '2024-06-05', 'refinance'::loan_purpose)
) as l(id, loan_number, status, loan_amount, purchase_price, appraised_value, down_payment, ltv, cltv, fico_score, dti, submitted_at, application_date, purpose)
where not exists (
  select 1 from loans l2 where l2.id = l.id
);

-- Link parties to loans (roles like borrower/broker/seller).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
loan_map as (
  select id from loans where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
),
party_map as (
  select id, display_name from parties where display_name in ('Jordan Rivera', 'Taylor Reed', 'Sunrise Realty', 'Peak Brokerage')
)
insert into loan_parties (tenant_id, loan_id, party_id, role, is_primary)
select t.id, l.id, p.id, lp.role, lp.is_primary
from tenant t
join loan_map l on true
join party_map p on p.display_name = lp.display_name
join (values
  ('Jordan Rivera', 'borrower', true, '11111111-1111-1111-1111-111111111111'),
  ('Taylor Reed', 'co_borrower', false, '11111111-1111-1111-1111-111111111111'),
  ('Peak Brokerage', 'broker', false, '11111111-1111-1111-1111-111111111111'),
  ('Sunrise Realty', 'seller', false, '22222222-2222-2222-2222-222222222222')
) as lp(display_name, role, is_primary, loan_id) on lp.loan_id = l.id
where not exists (
  select 1
  from loan_parties lp2
  where lp2.tenant_id = t.id and lp2.loan_id = l.id and lp2.party_id = p.id and lp2.role = lp.role
);

-- Seed properties tied to each loan.
with tenant as (
  select id from tenants where name = 'origina-dev'
)
insert into properties (id, tenant_id, loan_id, is_subject, address1, city, state, postal_code, property_type, occupancy)
select p.id, t.id, p.loan_id, true, p.address1, p.city, p.state, p.postal_code, p.property_type, p.occupancy
from tenant t
cross join (values
  ('bbbb1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '123 Alder St', 'Seattle', 'WA', '98101', 'single_family', 'owner_occupied'),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '987 Pine Ave', 'Portland', 'OR', '97205', 'condo', 'investment')
) as p(id, loan_id, address1, city, state, postal_code, property_type, occupancy)
where not exists (
  select 1
  from properties p2
  where p2.id = p.id
);

-- Seed loan conditions (underwriting requirements).
insert into conditions (id, loan_id, name, description, condition_number, status)
select c.id, c.loan_id, c.name, c.description, c.condition_number, c.status
from (values
  ('cccc1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Proof of Income', 'Provide most recent pay stubs.', 1, 'open'::condition_status),
  ('cccc2222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Bank Statements', 'Most recent 2 months of statements.', 2, 'submitted'::condition_status),
  ('cccc3333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Title Report', 'Order updated title report.', 1, 'open'::condition_status)
) as c(id, loan_id, name, description, condition_number, status)
where not exists (
  select 1 from conditions c2 where c2.id = c.id
);

-- Seed workflow items (split into exceptions/tasks/notes/status events).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into exceptions (id, tenant_id, loan_id, exception_type, title, description, status, severity, requested_by, decided_by, decided_at)
select e.id, t.id, e.loan_id, e.exception_type, e.title, e.description, e.status, e.severity, a.id, a.id, e.decided_at
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('eeee1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ltv', 'High LTV Exception', 'Request to approve 89.74 LTV.', 'approved', 'medium', timestamptz '2024-06-10 10:00:00+00')
) as e(id, loan_id, exception_type, title, description, status, severity, decided_at)
where not exists (
  select 1 from exceptions e2 where e2.id = e.id
);

-- Seed tasks for the processor.
with tenant as (
  select id from tenants where name = 'origina-dev'
),
processor_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'processor@origina.dev'
)
insert into tasks (id, tenant_id, loan_id, title, description, status, priority, assigned_to, due_at, created_by)
select tk.id, t.id, tk.loan_id, tk.title, tk.description, tk.status, tk.priority, p.id, tk.due_at, p.id
from tenant t
join processor_user p on p.tenant_id = t.id
cross join (values
  ('tttt1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Verify Employment', 'Confirm employment status with employer.', 'in_progress', 'high', timestamptz '2024-06-18 17:00:00+00'),
  ('tttt2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Order Appraisal', 'Request appraisal through AMC.', 'todo', 'normal', timestamptz '2024-06-20 17:00:00+00')
) as tk(id, loan_id, title, description, status, priority, due_at)
where not exists (
  select 1 from tasks t2 where t2.id = tk.id
);

-- Seed notes on loans.
with tenant as (
  select id from tenants where name = 'origina-dev'
),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into notes (id, tenant_id, loan_id, body, created_by)
select n.id, t.id, n.loan_id, n.body, a.id
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('nnnn1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Borrower submitted updated pay stubs.'),
  ('nnnn2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Title report ordered with local vendor.')
) as n(id, loan_id, body)
where not exists (
  select 1 from notes n2 where n2.id = n.id
);

-- Seed status changes for audit/history.
with tenant as (
  select id from tenants where name = 'origina-dev'
),
underwriter_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'underwriter@origina.dev'
)
insert into loan_status_events (id, tenant_id, loan_id, from_status, to_status, reason, actor_user_id, occurred_at)
select e.id, t.id, e.loan_id, e.from_status, e.to_status, e.reason, u.id, e.occurred_at
from tenant t
join underwriter_user u on u.tenant_id = t.id
cross join (values
  ('ssss1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'new_draft', 'submitted', 'Initial submission', timestamptz '2024-06-01 09:00:00+00'),
  ('ssss2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'submitted', 'conditions_review', 'Conditions review started', timestamptz '2024-06-12 09:00:00+00')
) as e(id, loan_id, from_status, to_status, reason, occurred_at)
where not exists (
  select 1 from loan_status_events e2 where e2.id = e.id
);

-- Seed documents (uploaded files).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into documents (id, tenant_id, loan_id, doc_type, file_name, mime_type, file_size_bytes, storage_key, sha256, uploaded_by, uploaded_at, tags)
select d.id, t.id, d.loan_id, d.doc_type, d.file_name, d.mime_type, d.file_size_bytes, d.storage_key, d.sha256, a.id, d.uploaded_at, d.tags
from tenant t
join admin_user a on a.tenant_id = t.id
cross join (values
  ('dddd1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'paystub', 'paystub_jun.pdf', 'application/pdf', 128432, 'loans/11111111/paystub_jun.pdf', 'hash-paystub-jun', timestamptz '2024-06-02 12:00:00+00', '{"category":"income"}'::jsonb),
  ('dddd2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'id', 'driver_license.png', 'image/png', 56321, 'loans/22222222/license.png', 'hash-license', timestamptz '2024-06-06 15:30:00+00', '{"category":"identity"}'::jsonb)
) as d(id, loan_id, doc_type, file_name, mime_type, file_size_bytes, storage_key, sha256, uploaded_at, tags)
where not exists (
  select 1 from documents d2 where d2.id = d.id
);

-- Seed pricing runs (rate calculations).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
underwriter_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'underwriter@origina.dev'
)
insert into pricing_runs (id, tenant_id, loan_id, run_at, run_by, input_hash, input_payload, output_payload)
select pr.id, t.id, pr.loan_id, pr.run_at, u.id, pr.input_hash, pr.input_payload, pr.output_payload
from tenant t
join underwriter_user u on u.tenant_id = t.id
cross join (values
  ('prpr1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', timestamptz '2024-06-03 10:00:00+00', 'pricing-input-111', '{"loan_amount":350000,"fico":742}'::jsonb, '{"rate":6.25,"points":0.5}'::jsonb)
) as pr(id, loan_id, run_at, input_hash, input_payload, output_payload)
where not exists (
  select 1 from pricing_runs pr2 where pr2.id = pr.id
);

-- Seed eligibility runs (pass/fail decisions).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
underwriter_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'underwriter@origina.dev'
)
insert into eligibility_runs (id, tenant_id, loan_id, run_at, run_by, input_hash, input_payload, output_payload)
select er.id, t.id, er.loan_id, er.run_at, u.id, er.input_hash, er.input_payload, er.output_payload
from tenant t
join underwriter_user u on u.tenant_id = t.id
cross join (values
  ('erer1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', timestamptz '2024-06-03 10:05:00+00', 'eligibility-input-111', '{"ltv":89.74,"dti":31.5}'::jsonb, '{"eligible":true}'::jsonb)
) as er(id, loan_id, run_at, input_hash, input_payload, output_payload)
where not exists (
  select 1 from eligibility_runs er2 where er2.id = er.id
);

-- Seed audit log (who changed what).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into audit_log (id, tenant_id, actor_user_id, entity_type, entity_id, action, occurred_at, reason, diff)
select a.id, t.id, u.id, a.entity_type, a.entity_id, a.action, a.occurred_at, a.reason, a.diff
from tenant t
join admin_user u on u.tenant_id = t.id
cross join (values
  ('aaaa9999-9999-9999-9999-999999999999', 'loan', '11111111-1111-1111-1111-111111111111', 'update', timestamptz '2024-06-04 09:00:00+00', 'Initial loan setup', '{"status":{"from":"new_draft","to":"submitted"}}'::jsonb)
) as a(id, entity_type, entity_id, action, occurred_at, reason, diff)
where not exists (
  select 1 from audit_log a2 where a2.id = a.id
);

-- Seed snapshots (saved system outputs).
with tenant as (
  select id from tenants where name = 'origina-dev'
),
admin_user as (
  select u.id, u.tenant_id from users u
  join tenant t on u.tenant_id = t.id
  where u.email = 'admin@origina.dev'
)
insert into snapshots (id, tenant_id, loan_id, snapshot_type, created_at, created_by, payload, payload_hash)
select s.id, t.id, s.loan_id, s.snapshot_type, s.created_at, u.id, s.payload, s.payload_hash
from tenant t
join admin_user u on u.tenant_id = t.id
cross join (values
  ('ssss9999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'pricing_output', timestamptz '2024-06-03 10:01:00+00', '{"rate":6.25,"points":0.5}'::jsonb, 'snapshot-hash-111')
) as s(id, loan_id, snapshot_type, created_at, payload, payload_hash)
where not exists (
  select 1 from snapshots s2 where s2.id = s.id
);

-- Seed addresses for borrowers.
with tenant as (
  select id from tenants where name = 'origina-dev'
)
insert into addresses (id, tenant_id, street1, city, state, postal_code, country)
select a.id, t.id, a.street1, a.city, a.state, a.postal_code, a.country
from tenant t
cross join (values
  ('addr1111-1111-1111-1111-111111111111', '123 Alder St', 'Seattle', 'WA', '98101', 'US'),
  ('addr2222-2222-2222-2222-222222222222', '456 Maple Rd', 'Seattle', 'WA', '98109', 'US')
) as a(id, street1, city, state, postal_code, country)
where not exists (
  select 1 from addresses a2 where a2.id = a.id
);

-- Seed borrowers (people applying on the loans).
with tenant as (
  select id from tenants where name = 'origina-dev'
)
insert into borrowers (
  id, tenant_id, loan_id, type, first_name, last_name, ssn_last4, dob, phone, email,
  current_address_id, mailing_address_id, relationship, income_type, income_amount,
  ethnicity, race, gender, marital_status, dependents, employment_status, employer_name,
  job_title, years_on_job, years_in_profession, work_phone, work_email
)
select b.id, t.id, b.loan_id, b.type, b.first_name, b.last_name, b.ssn_last4, b.dob, b.phone, b.email,
  b.current_address_id, b.mailing_address_id, b.relationship, b.income_type, b.income_amount,
  b.ethnicity, b.race, b.gender, b.marital_status, b.dependents, b.employment_status, b.employer_name,
  b.job_title, b.years_on_job, b.years_in_profession, b.work_phone, b.work_email
from tenant t
cross join (values
  ('bbbb9999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'primary_borrower', 'Jordan', 'Rivera', '1234', date '1985-07-12', '555-0101', 'jordan.rivera@example.com',
   'addr1111-1111-1111-1111-111111111111', 'addr1111-1111-1111-1111-111111111111', 'spouse', 'salary', 9200.00,
   'not_hispanic', 'white', 'male', 'married', 2, 'employed', 'Evergreen Tech', 'Senior Engineer', 5, 10, '555-0105', 'jordan.rivera@work.example'),
  ('bbbb8888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'co_borrower', 'Taylor', 'Reed', '5678', date '1987-03-09', '555-0102', 'taylor.reed@example.com',
   'addr2222-2222-2222-2222-222222222222', 'addr2222-2222-2222-2222-222222222222', 'spouse', 'salary', 7600.00,
   'not_hispanic', 'asian', 'female', 'married', 1, 'employed', 'Cascade Health', 'Analyst', 4, 8, '555-0106', 'taylor.reed@work.example')
) as b(
  id, loan_id, type, first_name, last_name, ssn_last4, dob, phone, email,
  current_address_id, mailing_address_id, relationship, income_type, income_amount,
  ethnicity, race, gender, marital_status, dependents, employment_status, employer_name,
  job_title, years_on_job, years_in_profession, work_phone, work_email
)
where not exists (
  select 1 from borrowers b2 where b2.id = b.id
);
