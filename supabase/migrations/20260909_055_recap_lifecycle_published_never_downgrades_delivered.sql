-- Publishing must not downgrade a delivered recap back to closed.
--
-- THE BUG. set_recap_lifecycle_status() derived lifecycle_status with
-- `when new.published = true then 'closed'` FIRST, so republishing a delivered
-- recap silently reset it. Reproduced on SPF in a rolled-back transaction
-- before changing anything:
--
--   start                delivered, published=true
--   unpublish            delivered          (fine)
--   republish            closed             <- the downgrade
--
-- Not hypothetical: the eight CVS recaps backfilled in this branch are exactly
-- delivered + published, so any unpublish/republish from the admin would have
-- undone the backfill and taken Results off the brand portal.
--
-- THE FIX, deliberately narrow. A row that is ALREADY delivered keeps that
-- status through any publish change — publishing is a visibility change, not a
-- lifecycle one. Reactivation remains a real transition: admin_is_active = true
-- makes it active again.
--
-- WHAT THIS DOES NOT DO, and why. The deeper problem is the ordering:
-- `published` is a visibility flag evaluated ahead of admin_is_active, which is
-- the actual lifecycle signal. Reordering so admin_is_active wins is cleaner,
-- and would look like:
--
--   case when new.admin_is_active = true  then 'active'
--        when new.admin_is_active = false then 'delivered'
--        when new.published = true        then 'closed'
--        else 'draft' end
--
-- but measured against the table that remaps 65 recaps that are not delivered
-- today — 63 closed -> delivered and 2 closed -> active — across other brands,
-- on their next update. That is a product decision, not a bug fix, so it is
-- left for Peyton. This change touches no row that is not already delivered.
--
-- Verified in a rolled-back transaction after the change:
--   SPF: unpublish -> delivered, republish -> delivered, two more toggles ->
--        delivered, reactivate -> active
--   CVS '26 Q1 (closed, admin_is_active null): unchanged through a toggle
--   status distribution after applying: 482 delivered / 76 closed / 69 active
--   / 9 draft, i.e. unchanged
--
-- Rollback: restore the previous body — the same CASE without the guard.

create or replace function public.set_recap_lifecycle_status()
returns trigger
language plpgsql
as $function$
begin
  -- Already delivered: publishing never changes it. Only reactivation does.
  if tg_op = 'UPDATE' and old.lifecycle_status = 'delivered' then
    new.lifecycle_status := case
      when new.admin_is_active = true then 'active'
      else 'delivered'
    end;
    return new;
  end if;

  new.lifecycle_status :=
    case
      when new.published = true          then 'closed'
      when new.admin_is_active = true    then 'active'
      when new.admin_is_active = false   then 'delivered'
      else 'draft'
    end;
  return new;
end;
$function$;
