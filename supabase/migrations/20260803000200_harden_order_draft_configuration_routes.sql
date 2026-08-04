alter table public.order_drafts
  drop constraint order_drafts_working_route_check,
  add constraint order_drafts_working_route_check check (
    working_configuration is null
    or (
      working_configuration ? 'route'
      and jsonb_typeof(working_configuration->'route') = 'string'
      and working_configuration->>'route' = selected_route
    )
  ),
  drop constraint order_drafts_configuration_route_check,
  add constraint order_drafts_configuration_route_check check (
    configuration is null
    or (
      configuration ? 'route'
      and jsonb_typeof(configuration->'route') = 'string'
      and configuration->>'route' = selected_route
    )
  );
