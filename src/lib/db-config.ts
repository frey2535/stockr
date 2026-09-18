export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function dataBackend(): "supabase" | "sqlite" {
  return isSupabaseConfigured() ? "supabase" : "sqlite";
}
