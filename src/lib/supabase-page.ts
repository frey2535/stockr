import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export async function selectAllForCompany<T>(
  supabase: SupabaseClient,
  table: string,
  companyId: string,
  columns = "*",
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("company_id", companyId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Load ${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}
