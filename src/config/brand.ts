export const brand = {
	name: 'OneMobility',
	initials: 'OM',
	tagline: 'Mobility control',
} as const

export const storageKeys = {
	user: 'onemobility.session.user',
	token: 'onemobility.session.token',
	supabaseAuth: 'onemobility.supabase.auth',
} as const

// Keep these only long enough to migrate sessions created before the OneMobility rename.
export const legacyStorageKeys = {
	user: 'fleetos.session.user',
	token: 'fleetos.session.token',
	supabaseAuth: 'fleetos.supabase.auth',
} as const

export function migrateStorageValue(key: string, legacyKey: string) {
	const currentValue = localStorage.getItem(key)
	if (currentValue) {
		return currentValue
	}

	const legacyValue = localStorage.getItem(legacyKey)
	if (legacyValue) {
		localStorage.setItem(key, legacyValue)
		localStorage.removeItem(legacyKey)
	}

	return legacyValue
}
