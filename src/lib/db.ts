// ═══════════════════════════════════════════════════════════════════
// GovBot AI — Database helper
// Returns true when a real Supabase project is configured.
// ═══════════════════════════════════════════════════════════════════

export function useSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!(url && !url.includes("your_"));
}
