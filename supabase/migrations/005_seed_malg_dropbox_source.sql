-- Register the MALG Opportunity Dropbox as an ingestable source.
-- The URL is config, not code, per docs/SOURCES.md. The feed is a JSON
-- object with an `opportunities` array (not a bare Simplify array);
-- adapter: lib/sources/malg_dropbox.ts.

insert into sources (kind, name, config)
values (
  'malg_dropbox',
  'MALG Opportunity Dropbox',
  '{"url": "https://raw.githubusercontent.com/malgmash/Malama-s-Career-Assistant-main/main/data/malg-dropbox-feed.json"}'
)
on conflict do nothing;
