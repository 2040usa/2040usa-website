insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-artwork',
  'customer-artwork',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/postscript',
    'image/vnd.adobe.photoshop'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.order_drafts
  add constraint order_drafts_id_owner_user_id_key unique (id, owner_user_id);

create table public.artwork_files (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null,
  owner_user_id uuid not null,
  route text not null,
  purpose text not null,
  status text not null default 'pending',
  original_name varchar(255) not null,
  extension text not null,
  mime_type text not null,
  declared_size_bytes bigint not null,
  client_last_modified bigint,
  client_fingerprint text not null,
  idempotency_key uuid not null,
  storage_bucket text not null default 'customer-artwork',
  storage_path text not null,
  failure_code text,
  attempt_expires_at timestamptz not null,
  uploaded_at timestamptz,
  verified_size_bytes bigint,
  verified_mime_type text,
  version integer not null default 1,
  replacement_for_id uuid references public.artwork_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artwork_files_draft_owner_fk
    foreign key (draft_id, owner_user_id)
    references public.order_drafts(id, owner_user_id)
    on delete cascade,
  constraint artwork_files_version_check check (version >= 1),
  constraint artwork_files_route_check check (
    route in ('gang-sheet', 'separate-artwork', 'transfers-by-size', 'full-apparel')
  ),
  constraint artwork_files_purpose_check check (
    purpose in ('gang-sheet-file', 'individual-design', 'size-based-design', 'apparel-artwork-reference')
  ),
  constraint artwork_files_route_purpose_check check (
    (route = 'gang-sheet' and purpose = 'gang-sheet-file')
    or (route = 'separate-artwork' and purpose = 'individual-design')
    or (route = 'transfers-by-size' and purpose = 'size-based-design')
    or (route = 'full-apparel' and purpose = 'apparel-artwork-reference')
  ),
  constraint artwork_files_status_check check (status in ('pending', 'uploaded', 'failed', 'deleting')),
  constraint artwork_files_extension_check check (extension in ('png', 'jpg', 'jpeg', 'webp', 'pdf', 'ai', 'psd')),
  constraint artwork_files_mime_check check (
    mime_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/postscript', 'image/vnd.adobe.photoshop')
  ),
  constraint artwork_files_extension_mime_check check (
    (extension = 'png' and mime_type = 'image/png')
    or (extension in ('jpg', 'jpeg') and mime_type = 'image/jpeg')
    or (extension = 'webp' and mime_type = 'image/webp')
    or (extension = 'pdf' and mime_type = 'application/pdf')
    or (extension = 'ai' and mime_type = 'application/postscript')
    or (extension = 'psd' and mime_type = 'image/vnd.adobe.photoshop')
  ),
  constraint artwork_files_declared_size_check check (declared_size_bytes between 1 and 52428800),
  constraint artwork_files_verified_size_check check (
    verified_size_bytes is null or verified_size_bytes between 1 and 52428800
  ),
  constraint artwork_files_last_modified_check check (client_last_modified is null or client_last_modified >= 0),
  constraint artwork_files_original_name_check check (
    char_length(original_name) between 1 and 255
    and original_name !~ '[\\/]'
    and original_name !~ '[[:cntrl:]]'
  ),
  constraint artwork_files_fingerprint_check check (client_fingerprint ~ '^fp1:[0-9a-f]{64}$'),
  constraint artwork_files_bucket_check check (storage_bucket = 'customer-artwork'),
  constraint artwork_files_path_check check (char_length(storage_path) > 0),
  constraint artwork_files_failure_code_check check (
    failure_code is null or failure_code in (
      'upload_failed', 'upload_expired', 'object_missing', 'size_mismatch',
      'mime_mismatch', 'verification_failed', 'deletion_failed'
    )
  ),
  constraint artwork_files_uploaded_lifecycle_check check (
    (status = 'uploaded' and uploaded_at is not null and verified_size_bytes is not null
      and verified_mime_type = mime_type and failure_code is null)
    or (status <> 'uploaded' and uploaded_at is null and verified_size_bytes is null and verified_mime_type is null)
  ),
  constraint artwork_files_failure_lifecycle_check check (
    (status = 'failed' and failure_code is not null) or (status <> 'failed' and failure_code is null)
  ),
  constraint artwork_files_storage_path_key unique (storage_path),
  constraint artwork_files_draft_idempotency_key unique (draft_id, idempotency_key)
);

create unique index artwork_files_recoverable_fingerprint_key
on public.artwork_files (draft_id, client_fingerprint)
where status in ('pending', 'failed');

create index artwork_files_owner_draft_idx on public.artwork_files (owner_user_id, draft_id, created_at);

create or replace function public.enforce_artwork_file_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.owner_user_id <> old.owner_user_id
    or new.draft_id <> old.draft_id
    or new.storage_bucket <> old.storage_bucket
    or new.storage_path <> old.storage_path
    or new.idempotency_key <> old.idempotency_key
  ) then
    raise exception 'immutable artwork ownership or storage identity';
  end if;

  if new.status = 'pending' and new.attempt_expires_at < clock_timestamp() then
    raise exception 'pending upload attempt must not already be expired';
  end if;

  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger artwork_files_enforce_mutation
before insert or update on public.artwork_files
for each row execute function public.enforce_artwork_file_mutation();

alter table public.artwork_files enable row level security;
alter table public.artwork_files force row level security;

revoke all on table public.artwork_files from anon, authenticated;
grant select, insert, update, delete on table public.artwork_files to authenticated;

create policy artwork_files_select_own
on public.artwork_files for select to authenticated
using ((select auth.uid()) = owner_user_id);

create policy artwork_files_insert_own
on public.artwork_files for insert to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.order_drafts d
    where d.id = draft_id and d.owner_user_id = (select auth.uid()) and d.status = 'active'
  )
);

create policy artwork_files_update_own
on public.artwork_files for update to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy artwork_files_delete_own
on public.artwork_files for delete to authenticated
using ((select auth.uid()) = owner_user_id);

create policy customer_artwork_insert_reserved
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-artwork'
  and owner_id = (select auth.uid())::text
  and exists (
    select 1
    from public.artwork_files a
    join public.order_drafts d on d.id = a.draft_id and d.owner_user_id = a.owner_user_id
    where a.storage_bucket = bucket_id
      and a.storage_path = name
      and a.owner_user_id = (select auth.uid())
      and a.status in ('pending', 'failed')
      and d.status = 'active'
      and d.selected_route = a.route
      and d.owner_user_id = (select auth.uid())
  )
);

create policy customer_artwork_select_own
on storage.objects for select to authenticated
using (bucket_id = 'customer-artwork' and owner_id = (select auth.uid())::text);

create policy customer_artwork_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'customer-artwork' and owner_id = (select auth.uid())::text);

revoke execute on function public.enforce_artwork_file_mutation() from public, anon, authenticated;
