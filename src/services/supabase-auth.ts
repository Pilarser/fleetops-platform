import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseAuth =
	supabaseUrl && supabasePublishableKey
		? createClient(supabaseUrl, supabasePublishableKey, {
				auth: {
					autoRefreshToken: true,
					detectSessionInUrl: true,
					flowType: 'pkce',
					persistSession: true,
					storageKey: 'fleetos.supabase.auth',
				},
			})
		: null

export function hasSupabaseAuth() {
	return Boolean(supabaseAuth)
}
