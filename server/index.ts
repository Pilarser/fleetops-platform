import { createApiServer } from './app'
import { createPrismaWorkspaceStore } from './prisma-store'

const port = Number(process.env.PORT ?? 4000)

createApiServer(createPrismaWorkspaceStore()).listen(port, () => {
	console.log(`OneMobility API listening on http://127.0.0.1:${port}`)
})
