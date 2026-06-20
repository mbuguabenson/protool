import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

// For client-side components (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For server-side APIs (uses service role key to bypass RLS if needed for admin tasks)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
