-- Phase 1: register the Simplify internship list as an ingestable source.
-- The URL is config, not code, per docs/SOURCES.md. Note: the repo name
-- rotates yearly (Summer2026-Internships -> Summer2027-Internships -> ...);
-- this config value needs a manual update via UPDATE sources SET config = ...
-- when Simplify renames it. Verified live on 2026-09-12.

insert into sources (kind, name, config)
values (
  'github_json',
  'Simplify internship list',
  '{"url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json"}'
)
on conflict do nothing;
