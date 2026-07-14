import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
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
