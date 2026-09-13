/**
 * supabase/server.ts — Server-side Supabase Clients
 *
 * Provides two clients for server-side code:
 *
 * 1. createServerClient() — For Server Components, Route Handlers, and
 *    Server Actions. Uses the anon key with cookie-based auth forwarding.
 *
 * 2. createServiceClient() — For admin operations that bypass Row Level
 *    Security (RLS). Uses the service_role key. NEVER expose to the client.
 *
 * Usage:
 *   // In a Server Component or Route Handler:
 *   import { createServerClient, createServiceClient } from '@/lib/supabase/server';
 *   const supabase = await createServerClient();       // respects RLS
 *   const supabaseAdmin = createServiceClient();       // bypasses RLS
 */

import { createServerClient as _createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for Server Components, Route Handlers,
 * and Server Actions. Forwards the user's auth cookies so RLS
 * policies work correctly.
 *
 * Must be called inside a request context (Server Component, Route Handler, etc.)
 */
export async function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  const cookieStore = await cookies();

  return _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll can fail in Server Components (read-only).
          // This is fine — auth refresh will happen in middleware instead.
        }
      },
    },
  });
}

/**
 * Creates a Supabase admin client using the service_role key.
 * This bypasses ALL Row Level Security (RLS) policies.
 *
 * ⚠️ ONLY use in:
 *   - API Route Handlers (src/app/api/...)
 *   - Server Actions
 *   - Scripts (src/scripts/...)
 *
 * ⚠️ NEVER:
 *   - Import in "use client" components
 *   - Expose the service_role key to the browser
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase service credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
