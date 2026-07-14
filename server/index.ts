import { createFleetServer } from './app'
import { createPrismaFleetStore } from './prisma-store'

const port = Number(process.env.PORT ?? 4000)

createFleetServer(createPrismaFleetStore()).listen(port, () => {
	console.log(`Fleet API listening on http://127.0.0.1:${port}`)
})
