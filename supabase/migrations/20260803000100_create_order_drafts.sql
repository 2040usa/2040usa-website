create extension if not exists pgcrypto with schema extensions;

create table public.order_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  selected_route text,
  starting_point_confirmed boolean not null default false,
  artwork_acknowledged boolean not null default false,
  working_configuration jsonb,
  configuration jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_drafts_status_check check (status = 'active'),
  constraint order_drafts_version_check check (version >= 1),
  constraint order_drafts_route_check check (
    selected_route is null or selected_route in ('gang-sheet', 'separate-artwork', 'transfers-by-size', 'full-apparel')
  ),
  constraint order_drafts_working_object_check check (
    working_configuration is null or jsonb_typeof(working_configuration) = 'object'
  ),
  constraint order_drafts_configuration_object_check check (
    configuration is null or jsonb_typeof(configuration) = 'object'
  ),
  constraint order_drafts_empty_lifecycle_check check (
    selected_route is not null
    or (
      starting_point_confirmed = false
      and artwork_acknowledged = false
      and working_configuration is null
      and configuration is null
    )
  ),
  constraint order_drafts_confirmation_route_check check (
    starting_point_confirmed = false or selected_route is not null
  ),
  constraint order_drafts_artwork_sequence_check check (
    artwork_acknowledged = false or starting_point_confirmed = true
  ),
  constraint order_drafts_configuration_lifecycle_check check (
    configuration is null
    or (selected_route is not null and starting_point_confirmed = true and artwork_acknowledged = true)
  ),
  constraint order_drafts_working_route_check check (
    working_configuration is null
    or working_configuration->>'route' = selected_route
  ),
  constraint order_drafts_configuration_route_check check (
    configuration is null
    or configuration->>'route' = selected_route
  ),
  constraint order_drafts_one_active_per_owner unique (owner_user_id)
);

create or replace function public.set_order_draft_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger order_drafts_set_updated_at
before update on public.order_drafts
for each row execute function public.set_order_draft_updated_at();

alter table public.order_drafts enable row level security;
alter table public.order_drafts force row level security;

revoke all on table public.order_drafts from anon, authenticated;
grant select, insert, update, delete on table public.order_drafts to authenticated;

create policy order_drafts_select_own
on public.order_drafts
for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy order_drafts_insert_own
on public.order_drafts
for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy order_drafts_update_own
on public.order_drafts
for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy order_drafts_delete_own
on public.order_drafts
for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

revoke execute on function public.set_order_draft_updated_at() from public, anon, authenticated;
