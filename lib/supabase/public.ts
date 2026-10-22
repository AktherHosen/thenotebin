import { createClient } from "@supabase/supabase-js";

// Cookie-free client for public pages so they can be statically cached with ISR.
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
