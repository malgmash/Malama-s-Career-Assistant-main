-- Phase 1: opportunities.status gains a 'closed' value, set by the
-- normalizer when a source directly states a listing is no longer active
-- (e.g. Simplify's `active: false`). No DDL change needed since status is
-- plain text with no check constraint (see 001_init.sql) -- this migration
-- exists purely to document the new value in schema history.
--
-- Valid values as of this migration: 'open' (default), 'stale' (not seen
-- in 14 days, docs/SOURCES.md), 'closed' (source reports it inactive).
select 1;
