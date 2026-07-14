import { createFleetServer } from './app'

const port = Number(process.env.PORT ?? 4000)

createFleetServer().listen(port, () => {
	console.log(`Fleet API listening on http://127.0.0.1:${port}`)
})
