import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://onemobility:onemobility@localhost:55433/onemobility',
})

const prisma = new PrismaClient({ adapter })

const companies = await prisma.company.findMany({
    include: {
        users: true,
        drivers: true,
        vehicles: true,
    },
})

console.log(JSON.stringify(companies, null, 2))

await prisma.$disconnect()
