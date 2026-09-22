import postgres from 'postgres'

export const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
	max: 1,
	prepare: false,
})
