// Stand-in for supabase-js inside edge-function tests. The test installs
// globalThis.__fakeSupabase.createClient(url, key, options) before calling the handler.
export function createClient(url, key, options) {
  return globalThis.__fakeSupabase.createClient(url, key, options);
}
