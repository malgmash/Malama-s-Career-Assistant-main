const PAGE_SIZE = 1000; // Supabase/PostgREST's own default row cap per request

// Supabase caps any unpaginated .select() at 1000 rows — silently, no
// error, no warning. Found the hard way in lib/scoring: past ~1000 rows,
// queries were truncated without any indication. Any query that might
// return more than 1000 rows should use this instead of awaiting the
// query directly.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}
