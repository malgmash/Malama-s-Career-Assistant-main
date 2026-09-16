-- Phase 5: resume files live in Supabase Storage instead of Azure Blob
-- Storage (Azure subscription is off for cost reasons; see CLAUDE.md and
-- docs/DATA-MODEL.md, updated alongside this migration). The bucket itself
-- is created via the Supabase dashboard (Storage -> New bucket -> "resumes",
-- private) since bucket creation isn't reliably scriptable the same way
-- across Supabase CLI versions -- this migration only adds the RLS
-- policies on storage.objects, scoped to the same owner email as every
-- other private table (007_owner_policies_by_email.sql).

-- RLS is already enabled by default on storage.objects in every Supabase
-- project; the SQL Editor's role doesn't own that table (it belongs to
-- supabase_storage_admin), so an explicit "alter table ... enable row
-- level security" here fails with "must be owner of table objects" even
-- though creating a policy on it is allowed.

create policy "owner full access to resume files" on storage.objects
  for all to authenticated
  using (bucket_id = 'resumes' and (auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com')
  with check (bucket_id = 'resumes' and (auth.jwt() ->> 'email') = 'gabrielmasheke@gmail.com');
