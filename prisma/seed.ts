import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

await prisma.company.upsert({
    where: { id: 'demo-company' },
    update: {},
    create: {
        id: 'demo-company',
        name: 'FleetOps Demo',
        users: {
            create: [
                {
                    id: 'user-admin',
                    name: 'Admin User',
                    email: 'admin@example.com',
                    password: 'demo1234',
                    role: 'fleet_admin',
                },
                {
                    id: 'user-finance',
                    name: 'Finance User',
                    email: 'finance@example.com',
                    password: 'demo1234',
                    role: 'finance',
                },
                {
                    id: 'user-driver',
                    name: 'Driver User',
                    email: 'driver@example.com',
                    password: 'demo1234',
                    role: 'driver',
                },
            ],
        },
        drivers: {
            create: [
                {
                    id: 'driver-1',
                    name: 'Marta Rinaldi',
                    email: 'marta.rinaldi@example.com',
                    vehicleId: 'vehicle-1',
                    status: 'active',
                    costCenter: 'Sales',
                    monthlySpend: 410,
                    personalSpend: 38,
                },
                {
                    id: 'driver-2',
                    name: 'Luca Ferri',
                    email: 'luca.ferri@example.com',
                    vehicleId: 'vehicle-2',
                    status: 'active',
                    costCenter: 'Operations',
                    monthlySpend: 295,
                    personalSpend: 12,
                },
            ],
        },
        vehicles: {
            create: [
                {
                    id: 'vehicle-1',
                    plate: 'GE842LK',
                    make: 'Fiat',
                    model: '500e',
                    fuelType: 'electric',
                    status: 'active',
                    costCenter: 'Sales',
                    monthlySpend: 520,
                    mileageKm: 18400,
                },
                {
                    id: 'vehicle-2',
                    plate: 'FN193TR',
                    make: 'Toyota',
                    model: 'Yaris Hybrid',
                    fuelType: 'hybrid',
                    status: 'maintenance',
                    costCenter: 'Operations',
                    monthlySpend: 430,
                    mileageKm: 32100,
                },
            ],
        },
    },
})

await prisma.driver.updateMany({
    where: { id: 'driver-1' },
    data: { vehicleId: 'vehicle-1' },
})

await prisma.driver.updateMany({
    where: { id: 'driver-2' },
    data: { vehicleId: 'vehicle-2' },
})

await prisma.vehicle.updateMany({
    where: { id: 'vehicle-1' },
    data: { fuelType: 'electric' },
})

await prisma.vehicle.updateMany({
    where: { id: 'vehicle-2' },
    data: { fuelType: 'hybrid' },
})

console.log('Seeded demo fleet data.')

await prisma.$disconnect()
