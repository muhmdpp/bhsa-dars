import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetch all rows across pages for a given table and query modifier,
 * bypassing PostgREST's default 1000 row limit.
 */
export async function fetchAllRows(tableName, buildQuery = (q) => q, pageSize = 1000, columns = '*') {
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select(columns);
    query = buildQuery(query);
    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) throw new Error(`${tableName}: ${error.message}`);
    if (!data || data.length === 0) break;

    allData.push(...data);
    if (data.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allData;
}

/**
 * Excludes soft-deleted rows. Uses `deleted IS NOT TRUE` so rows where
 * `deleted` is NULL are kept (a plain `neq('deleted', true)` drops them,
 * because `NULL <> true` is not true in SQL).
 */
export const notDeleted = (q) => q.not('deleted', 'is', true);
