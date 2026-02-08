import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🔐 Creating admin user...');

    const adminEmail = 'admin@signatureshades.com';
    const adminPassword = 'Admin@123'; // Should be changed on first login

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail }
    });

    if (existingAdmin) {
        console.log('✅ Admin user already exists:', adminEmail);
        return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            password: hashedPassword,
            name: 'System Administrator',
            phone: '+94 77 123 4567',
            address: 'Signature Shades Head Office',
            company: 'Signature Shades',
            role: 'ADMIN',
            isActive: true
        }
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password:', adminPassword);
    console.log('⚠️  Please change this password after first login!');
}

main()
    .catch((e) => {
        console.error('❌ Error creating admin user:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
