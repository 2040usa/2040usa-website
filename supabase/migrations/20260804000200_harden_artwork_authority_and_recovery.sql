revoke insert, update, delete on table public.artwork_files from anon, authenticated;
grant select on table public.artwork_files to authenticated;

drop policy if exists artwork_files_insert_own on public.artwork_files;
drop policy if exists artwork_files_update_own on public.artwork_files;
drop policy if exists artwork_files_delete_own on public.artwork_files;

alter table public.artwork_files
  add column recovery_of_id uuid;

drop index if exists public.artwork_files_recoverable_fingerprint_key;

create index artwork_files_recovery_lookup_idx
on public.artwork_files (
  owner_user_id,
  draft_id,
  client_fingerprint,
  status,
  attempt_expires_at
);

alter table public.artwork_files
  add constraint artwork_files_canonical_storage_path_check check (
    storage_path =
      'users/' || owner_user_id::text ||
      '/drafts/' || draft_id::text ||
      '/artwork/' || id::text ||
      '/original.' || extension
  );

create or replace function public.enforce_artwork_file_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  replacement_matches boolean;
begin
  if tg_op = 'UPDATE' and (
    new.owner_user_id is distinct from old.owner_user_id
    or new.draft_id is distinct from old.draft_id
    or new.route is distinct from old.route
    or new.purpose is distinct from old.purpose
    or new.original_name is distinct from old.original_name
    or new.extension is distinct from old.extension
    or new.mime_type is distinct from old.mime_type
    or new.declared_size_bytes is distinct from old.declared_size_bytes
    or new.client_last_modified is distinct from old.client_last_modified
    or new.client_fingerprint is distinct from old.client_fingerprint
    or new.idempotency_key is distinct from old.idempotency_key
    or new.recovery_of_id is distinct from old.recovery_of_id
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
  ) then
    raise exception 'immutable artwork reservation identity';
  end if;

  if tg_op = 'UPDATE' and (
    (old.replacement_for_id is null and new.replacement_for_id is not null)
    or (
      old.replacement_for_id is not null
      and new.replacement_for_id is not null
      and new.replacement_for_id is distinct from old.replacement_for_id
    )
  ) then
    raise exception 'immutable artwork replacement identity';
  end if;

  if new.replacement_for_id is not null then
    if new.replacement_for_id = new.id then
      raise exception 'artwork cannot replace itself';
    end if;

    select exists (
      select 1
      from public.artwork_files target
      where target.id = new.replacement_for_id
        and target.owner_user_id = new.owner_user_id
        and target.draft_id = new.draft_id
        and target.route = new.route
    ) into replacement_matches;

    if not replacement_matches then
      raise exception 'replacement target must share owner, draft, and route';
    end if;
  end if;

  if new.status = 'pending' and new.attempt_expires_at < clock_timestamp() then
    raise exception 'pending upload attempt must not already be expired';
  end if;

  new.updated_at = clock_timestamp();
  return new;
end;
$$;

revoke execute on function public.enforce_artwork_file_mutation() from public, anon, authenticated;
