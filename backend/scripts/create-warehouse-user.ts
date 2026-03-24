import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🏭 Creating Warehouse agent user...');

    const email = 'productionsignatureshades@gmail.com';
    const password = 'Warehouse@123'; // Should be changed on first login

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
        console.log('✅ Warehouse user already exists:', email);
        console.log('   Role:', existing.role);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    console.log('✅ Warehouse user created successfully!');
    console.log('📧 Email:', warehouseUser.email);
    console.log('🔑 Password:', password);
    console.log('🏷️  Role: WAREHOUSE (Orders in Production + Inventory view only)');
    console.log('⚠️  Please change this password after first login!');
}

main()
    .catch((e) => {
        console.error('❌ Error creating warehouse user:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
