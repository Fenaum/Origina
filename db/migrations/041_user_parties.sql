-- =========================================================
-- db/migrations/041_user_parties.sql
-- =========================================================
-- Join table linking app users to parties (people/companies).
-- This supports many-to-many relationships (one user can manage many parties,
-- and a party can be managed by multiple users).
create table if not exists user_parties (
  tenant_id uuid not null references tenants(id) on delete restrict,
  user_id uuid not null references users(id) on delete cascade,
  party_id uuid not null references parties(id) on delete cascade,
  relationship text, -- optional label like 'owner','assistant','primary_contact'
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, party_id)
);

-- Helpful indexes for lookup by user or party within a tenant.
create index if not exists idx_user_parties_user on user_parties (tenant_id, user_id);
create index if not exists idx_user_parties_party on user_parties (tenant_id, party_id);
