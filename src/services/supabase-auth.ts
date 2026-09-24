import { createClient } from '@supabase/supabase-js'
import { legacyStorageKeys, migrateStorageValue, storageKeys } from '../config/brand'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

migrateStorageValue(storageKeys.supabaseAuth, legacyStorageKeys.supabaseAuth)

export const supabaseAuth =
	supabaseUrl && supabasePublishableKey
		? createClient(supabaseUrl, supabasePublishableKey, {
				auth: {
					autoRefreshToken: true,
					detectSessionInUrl: true,
					flowType: 'pkce',
					persistSession: true,
					storageKey: storageKeys.supabaseAuth,
				},
			})
		: null

export function hasSupabaseAuth() {
	return Boolean(supabaseAuth)
}
