-- Consolidate the four prototype starting routes into the two active gang-sheet workflows.
-- Storage paths and artwork row identities are preserved.

alter table public.order_drafts
  drop constraint order_drafts_route_check;

alter table public.artwork_files
  drop constraint artwork_files_route_check,
  drop constraint artwork_files_purpose_check,
  drop constraint artwork_files_route_purpose_check;

alter table public.artwork_files disable trigger artwork_files_enforce_mutation;

update public.artwork_files
set route = 'individual-designs',
    purpose = 'individual-design'
where route in ('separate-artwork', 'transfers-by-size', 'full-apparel');

alter table public.artwork_files enable trigger artwork_files_enforce_mutation;

update public.order_drafts
set selected_route = 'individual-designs',
    artwork_acknowledged = false,
    working_configuration = null,
    configuration = null,
    version = version + 1
where selected_route in ('separate-artwork', 'transfers-by-size', 'full-apparel');

alter table public.order_drafts
  add constraint order_drafts_route_check check (
    selected_route is null or selected_route in ('gang-sheet', 'individual-designs')
  );

alter table public.artwork_files
  add constraint artwork_files_route_check check (
    route in ('gang-sheet', 'individual-designs')
  ),
  add constraint artwork_files_purpose_check check (
    purpose in ('gang-sheet-file', 'individual-design')
  ),
  add constraint artwork_files_route_purpose_check check (
    (route = 'gang-sheet' and purpose = 'gang-sheet-file')
    or (route = 'individual-designs' and purpose = 'individual-design')
  );

do $$
begin
  if exists (
    select 1
    from public.order_drafts
    where selected_route in ('separate-artwork', 'transfers-by-size', 'full-apparel')
  ) or exists (
    select 1
    from public.artwork_files
    where route in ('separate-artwork', 'transfers-by-size', 'full-apparel')
       or purpose in ('size-based-design', 'apparel-artwork-reference')
  ) then
    raise exception 'legacy route consolidation was incomplete';
  end if;
end;
$$;
