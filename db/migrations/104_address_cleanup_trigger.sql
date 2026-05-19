-- =========================================================
-- db/migrations/104_address_cleanup_trigger.sql
--
-- Installs a trigger that deletes address rows when their borrower is deleted.
--
-- WHY: The FK direction is borrower → address (borrowers.current_address_id
-- points at addresses.id). Deleting a borrower leaves its address rows alive
-- with no parent — orphans that accumulate and can never be referenced again.
-- ON DELETE CASCADE cannot solve this because CASCADE only follows the FK
-- arrow (parent deletes child). Here the borrower IS the child — the address
-- is the parent. A BEFORE trigger cannot be used either: the FK from borrower
-- to address is still live during BEFORE DELETE, so deleting the address would
-- violate the constraint. AFTER DELETE fires once the borrower row is removed,
-- so the FK reference is gone and the address can be safely deleted.
--
-- The canonical function definition is documented in
-- db/functions/cleanup_borrower_addresses.sql for reference.
-- =========================================================

create or replace function cleanup_borrower_addresses()
returns trigger
language plpgsql
as $$
begin
  -- Delete current_address unless it is the same row as mailing_address.
  -- If both FKs point to the same address, we delete it once via
  -- mailing_address_id below — deleting it twice would error.
  if old.current_address_id is not null
     and old.current_address_id is distinct from old.mailing_address_id then
    delete from addresses where id = old.current_address_id;
  end if;

  -- Covers both the "different mailing address" case and the
  -- "same address used for both" case (current skipped above, deleted here).
  if old.mailing_address_id is not null then
    delete from addresses where id = old.mailing_address_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_borrower_addresses on borrowers;
create trigger trg_cleanup_borrower_addresses
  after delete on borrowers
  for each row
  execute procedure cleanup_borrower_addresses();
