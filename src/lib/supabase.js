import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// True when a database function hasn't been installed yet (migration not run)
export function isMissingFunction(error) {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

/**
 * Fetch all rows across pages for a given table and query modifier,
 * bypassing PostgREST's default 1000 row limit.
 */
export async function fetchAllRows(tableName, buildQuery = (q) => q, pageSize = 1000, columns = '*') {
  let allData = [];
  const seen = new Set();
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select(columns);
    query = buildQuery(query);
    // Tie-break on the unique id. Sorting by a non-unique column alone (e.g. date)
    // lets rows with equal values shuffle between page requests, so some rows are
    // returned twice and others never — which made balances on screen drift.
    query = query.order('id', { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) throw new Error(`${tableName}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.id === undefined || !seen.has(row.id)) {
        if (row.id !== undefined) seen.add(row.id);
        allData.push(row);
      }
    }
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
