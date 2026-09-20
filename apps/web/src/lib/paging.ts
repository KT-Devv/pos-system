/**
 * Supabase silently truncates any query to the project's max-rows (1000 by default), which would
 * make totals quietly wrong. This walks the result in pages until the server stops returning rows,
 * stepping by what actually came back so a lower server cap still terminates correctly.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    if (!data || data.length === 0) return { data: rows, error: null };
    rows.push(...(data as T[]));
    from += data.length;
  }
}
