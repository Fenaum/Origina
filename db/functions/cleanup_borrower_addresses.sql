-- db/functions/cleanup_borrower_addresses.sql
--
-- Deletes address rows when their owning borrower is deleted.
--
-- WHY this trigger is necessary:
--   The FK relationship is: borrowers.current_address_id → addresses.id
--   The arrow points FROM borrower TO address. This means:
--     • Deleting an address sets the borrower's FK column to NULL (SET NULL).
--     • Deleting a borrower has NO effect on the address row — it becomes an
--       orphan: a row with no parent that can never be referenced again.
--
--   ON DELETE CASCADE cannot solve this because CASCADE only works in the
--   direction of the FK arrow (parent → child). Here the borrower is the
--   child (it holds the FK), so the DB has no built-in way to cascade the
--   delete upward to the address parent.
--
--   An AFTER DELETE trigger on borrowers is the correct pattern. It fires
--   after the borrower row is removed and its FK columns (current_address_id,
--   mailing_address_id) are available in OLD.* for cleanup.
--
-- EDGE CASES handled:
--   • Same address used for both current and mailing: deleted once.
--   • NULL address IDs: skipped safely.
--
-- This file is reference documentation only — do not execute it directly.
-- The authoritative copy is inlined in migration 104_address_cleanup_trigger.sql,
-- which is what scripts/init_db.py runs. Keeping it here makes the function
-- easy to find and read without opening the migration file.

create or replace function cleanup_borrower_addresses()
returns trigger
language plpgsql
as $$
begin
  -- Delete current_address unless it is the same row as mailing_address.
  -- If they point to the same address, we delete it via mailing_address_id below.
  if old.current_address_id is not null
     and old.current_address_id is distinct from old.mailing_address_id then
    delete from addresses where id = old.current_address_id;
  end if;

  -- Delete mailing_address (covers the same-address case too).
  if old.mailing_address_id is not null then
    delete from addresses where id = old.mailing_address_id;
  end if;

  return old;
end;
$$;
