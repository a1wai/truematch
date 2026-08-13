/* ==================================================================
   Baked-in Supabase config.

   These ship inside the app bundle so the APK syncs the moment it is
   installed, with nothing to type on either phone.

   ------------------------------------------------------------------
   READ THIS BEFORE CHANGING ANYTHING
   ------------------------------------------------------------------
   The anon key is a public, client-side key — it is meant to be visible
   in a browser bundle, and it cannot do anything the row-level security
   policies do not allow. BUT the demo policies in supabase/schema.sql
   allow any key holder to read and write any room. This file lives in a
   public repository, so treat every message in this project as readable
   by anyone who finds it.

   To make it actually private:
     1. Rotate this key in the Supabase dashboard (Settings -> API).
     2. Replace the demo RLS policies with auth.uid()-based ones.
     3. Keep the new key out of here — set it as the VITE_SUPABASE_*
        repository secrets instead, which the APK workflow already reads.

   Resolution order everywhere in the app:
     Settings screen  >  build-time env  >  these defaults
   ================================================================== */

export const BAKED_SUPABASE_URL = 'https://yxacrugblyriruuidoiy.supabase.co'

export const BAKED_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YWNydWdibHlyaXJ1dWlkb2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzM2MTYsImV4cCI6MjEwMjIwOTYxNn0.IROE8Jh7eYNHusLWodTe0Kmw1XHl9CS_8BsbP_DZYF8'

/**
 * Accepts a full URL or just the project ref, because the dashboard shows the
 * ref on its own in a few places and pasting that is an easy mistake to make.
 */
export function normalizeSupabaseUrl(value) {
  const raw = (value || '').trim().replace(/\/+$/, '')
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^[a-z0-9]{16,}$/i.test(raw)) return `https://${raw}.supabase.co`
  return `https://${raw}`
}
