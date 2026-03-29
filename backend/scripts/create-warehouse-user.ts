import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating Warehouse agent user...');

    const email = process.env.WAREHOUSE_EMAIL || 'productionsignatureshades@gmail.com';
    const password = process.env.WAREHOUSE_PASSWORD;

    if (!password) {
        console.error('ERROR: WAREHOUSE_PASSWORD environment variable is required.');
        console.error('Usage: WAREHOUSE_PASSWORD="YourStr0ng!Pass" npm run create:warehouse');
        process.exit(1);
    }

    if (password.length < 10) {
        console.error('ERROR: Password must be at least 10 characters.');
        process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        console.log('Warehouse user already exists:', email);
        console.log('   Role:', existing.role);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const warehouseUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name: 'Production Warehouse',
            phone: '0000000000',
            address: 'Signature Shades Warehouse',
            company: 'Signature Shades',
            role: 'WAREHOUSE',
            isActive: true,
            isApproved: true,
        },
    });

    console.log('Warehouse user created successfully!');
    console.log('Email:', warehouseUser.email);
    console.log('Role: WAREHOUSE');
    // Never log the password
}

main()
    .catch((e) => {
        console.error('❌ Error creating warehouse user:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
