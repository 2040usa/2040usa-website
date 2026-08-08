-- Link Print-Ready Gang Sheet configuration to canonical uploaded artwork.
-- Artwork rows and private Storage objects are not changed by this migration.

with gang_drafts as (
  select
    draft.id,
    draft.working_configuration,
    draft.configuration,
    case
      when jsonb_typeof(draft.working_configuration->'notes') = 'string' then draft.working_configuration->>'notes'
      when jsonb_typeof(draft.configuration->'notes') = 'string' then draft.configuration->>'notes'
      else ''
    end as notes,
    count(artwork.id) filter (
      where artwork.status = 'uploaded'
        and artwork.route = 'gang-sheet'
        and artwork.purpose = 'gang-sheet-file'
    )::integer as uploaded_count,
    min(artwork.id::text) filter (
      where artwork.status = 'uploaded'
        and artwork.route = 'gang-sheet'
        and artwork.purpose = 'gang-sheet-file'
    ) as only_artwork_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'artworkId', artwork.id,
          'copies', '1',
          'finishedWidth', '',
          'finishedLength', ''
        ) order by artwork.created_at, artwork.id
      ) filter (
        where artwork.status = 'uploaded'
          and artwork.route = 'gang-sheet'
          and artwork.purpose = 'gang-sheet-file'
      ),
      '[]'::jsonb
    ) as incomplete_sheets
  from public.order_drafts draft
  left join public.artwork_files artwork
    on artwork.draft_id = draft.id
   and artwork.owner_user_id = draft.owner_user_id
  where draft.status = 'active'
    and draft.selected_route = 'gang-sheet'
  group by draft.id
), transformed as (
  select
    id,
    uploaded_count,
    notes,
    case
      when uploaded_count = 1
        and working_configuration->>'route' = 'gang-sheet'
        and working_configuration ? 'sheetCount'
        and working_configuration ? 'finishedWidth'
        and working_configuration ? 'finishedLength'
      then jsonb_build_object(
        'route', 'gang-sheet',
        'sheets', jsonb_build_array(jsonb_build_object(
          'artworkId', only_artwork_id,
          'copies', working_configuration->>'sheetCount',
          'finishedWidth', working_configuration->>'finishedWidth',
          'finishedLength', working_configuration->>'finishedLength'
        )),
        'notes', notes
      )
      when uploaded_count = 1
        and configuration->>'route' = 'gang-sheet'
        and configuration ? 'sheetCount'
        and configuration ? 'finishedWidth'
        and configuration ? 'finishedLength'
      then jsonb_build_object(
        'route', 'gang-sheet',
        'sheets', jsonb_build_array(jsonb_build_object(
          'artworkId', only_artwork_id,
          'copies', configuration->>'sheetCount',
          'finishedWidth', configuration->>'finishedWidth',
          'finishedLength', configuration->>'finishedLength'
        )),
        'notes', notes
      )
      when working_configuration is not null or configuration is not null or uploaded_count > 0
      then jsonb_build_object('route', 'gang-sheet', 'sheets', incomplete_sheets, 'notes', notes)
      else null
    end as next_working_configuration,
    case
      when uploaded_count = 1
        and configuration->>'route' = 'gang-sheet'
        and jsonb_typeof(configuration->'sheetCount') = 'number'
        and jsonb_typeof(configuration->'finishedWidth') = 'number'
        and jsonb_typeof(configuration->'finishedLength') = 'number'
        and (configuration->>'sheetCount')::numeric between 1 and 10000
        and trunc((configuration->>'sheetCount')::numeric) = (configuration->>'sheetCount')::numeric
        and (configuration->>'finishedWidth')::numeric > 0
        and (configuration->>'finishedWidth')::numeric <= 1000
        and (configuration->>'finishedLength')::numeric > 0
        and (configuration->>'finishedLength')::numeric <= 1000
      then jsonb_build_object(
        'route', 'gang-sheet',
        'sheets', jsonb_build_array(jsonb_build_object(
          'artworkId', only_artwork_id,
          'copies', configuration->'sheetCount',
          'finishedWidth', configuration->'finishedWidth',
          'finishedLength', configuration->'finishedLength'
        )),
        'notes', notes
      )
      else null
    end as next_configuration
  from gang_drafts
)
update public.order_drafts draft
set working_configuration = transformed.next_working_configuration,
    configuration = transformed.next_configuration,
    artwork_acknowledged = case
      when transformed.uploaded_count = 0 then false
      else draft.artwork_acknowledged
    end,
    version = draft.version + 1
from transformed
where draft.id = transformed.id
  and (
    draft.working_configuration ? 'sheetCount'
    or draft.configuration ? 'sheetCount'
  );

do $$
begin
  if exists (
    select 1
    from public.order_drafts
    where status = 'active'
      and selected_route = 'gang-sheet'
      and (
        working_configuration ? 'sheetCount'
        or configuration ? 'sheetCount'
      )
  ) then
    raise exception 'legacy global gang-sheet configuration remains';
  end if;
end;
$$;
