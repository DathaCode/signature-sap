import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating admin user...');

    const adminEmail = process.env.ADMIN_EMAIL || 'orders@signatureshades.com.au';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.error('ERROR: ADMIN_PASSWORD environment variable is required.');
        console.error('Usage: ADMIN_PASSWORD="YourStr0ng!Pass" npm run create:admin');
        process.exit(1);
    }

    if (adminPassword.length < 10) {
        console.error('ERROR: Password must be at least 10 characters.');
        process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail }
    });

    if (existingAdmin) {
        console.log('Admin user already exists:', adminEmail);
        return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            password: hashedPassword,
            name: 'System Administrator',
            phone: '+61 000 000 000',
            address: 'Signature Shades Head Office',
            company: 'Signature Shades',
            role: 'ADMIN',
            isActive: true
        }
    });

    console.log('Admin user created successfully!');
    console.log('Email:', admin.email);
    // Never log the password
}

main()
    .catch((e) => {
        console.error('❌ Error creating admin user:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
