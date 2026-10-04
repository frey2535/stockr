import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export async function selectAllMatching<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label = "rows",
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(`Load ${label}: ${error.message}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function selectAllForCompany<T>(
  supabase: SupabaseClient,
  table: string,
  companyId: string,
  columns = "*",
): Promise<T[]> {
  return selectAllMatching<T>(
    (from, to) =>
      supabase.from(table).select(columns).eq("company_id", companyId).range(from, to) as unknown as PromiseLike<{
        data: T[] | null;
        error: { message: string } | null;
      }>,
    table,
  );
}
