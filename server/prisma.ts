import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://onemobility:onemobility@localhost:55433/onemobility',
})

export const prisma = new PrismaClient({ adapter })
