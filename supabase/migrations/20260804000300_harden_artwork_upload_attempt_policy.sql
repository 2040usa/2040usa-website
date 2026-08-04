drop policy if exists customer_artwork_insert_reserved on storage.objects;

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
      and a.attempt_expires_at > clock_timestamp()
      and (
        a.status = 'pending'
        or (a.status = 'failed' and a.failure_code = 'upload_failed')
      )
      and d.status = 'active'
      and d.selected_route = a.route
      and d.owner_user_id = (select auth.uid())
  )
);
