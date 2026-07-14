import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { providers, services, transactions } from '../src/data/mock-data'
import { hashPassword } from '../server/passwords'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://fleetops:fleetops@localhost:55433/fleetops',
})

const prisma = new PrismaClient({ adapter })

const demoUsers = [
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
]

await prisma.company.upsert({
    where: { id: 'demo-company' },
    update: {
        name: 'FleetOps Demo',
    },
    create: {
        id: 'demo-company',
        name: 'FleetOps Demo',
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

for (const user of demoUsers) {
    const passwordHash = hashPassword(user.password)

    await prisma.user.upsert({
        where: { email: user.email },
        update: {
            companyId: 'demo-company',
            name: user.name,
            password: passwordHash,
            role: user.role,
        },
        create: {
            ...user,
            companyId: 'demo-company',
            password: passwordHash,
        },
    })
}

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

for (const service of services) {
    await prisma.mobilityService.upsert({
        where: { id: service.id },
        update: {
            name: service.name,
            description: service.description,
            enabled: service.enabled,
            monthlyLimit: service.monthlyLimit,
            requiresApproval: service.requiresApproval,
        },
        create: {
            id: service.id,
            companyId: 'demo-company',
            name: service.name,
            description: service.description,
            enabled: service.enabled,
            monthlyLimit: service.monthlyLimit,
            requiresApproval: service.requiresApproval,
        },
    })
}

for (const provider of providers) {
    await prisma.providerLocation.upsert({
        where: { id: provider.id },
        update: {
            name: provider.name,
            service: provider.service,
            address: provider.address,
            city: provider.city,
            distanceKm: provider.distanceKm,
            status: provider.status,
        },
        create: {
            id: provider.id,
            companyId: 'demo-company',
            name: provider.name,
            service: provider.service,
            address: provider.address,
            city: provider.city,
            distanceKm: provider.distanceKm,
            status: provider.status,
        },
    })
}

for (const transaction of transactions) {
    await prisma.fleetTransaction.upsert({
        where: { id: transaction.id },
        update: {
            date: transaction.date,
            driverId: transaction.driverId,
            vehicleId: transaction.vehicleId,
            service: transaction.service,
            provider: transaction.provider,
            amount: transaction.amount,
            vat: transaction.vat,
            status: transaction.status,
            expenseType: transaction.expenseType,
        },
        create: {
            id: transaction.id,
            companyId: 'demo-company',
            date: transaction.date,
            driverId: transaction.driverId,
            vehicleId: transaction.vehicleId,
            service: transaction.service,
            provider: transaction.provider,
            amount: transaction.amount,
            vat: transaction.vat,
            status: transaction.status,
            expenseType: transaction.expenseType,
        },
    })
}

console.log('Seeded demo fleet data.')

await prisma.$disconnect()
