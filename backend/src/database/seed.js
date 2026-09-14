import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log('🌱 Starting Database Seeding with Kenyan Shilling (KES) Currencies...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || 'rms_database';
  await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
  await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  // Run schema first to ensure clean state
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
  }

  // 1. Seed Users
  console.log('👤 Seeding Users...');
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const cashierPasswordHash = await bcrypt.hash('Cashier123!', 10);
  const customerPasswordHash = await bcrypt.hash('Customer123!', 10);

  const adminId = '11111111-1111-1111-1111-111111111111';
  const cashier1Id = '22222222-2222-2222-2222-222222222222';
  const cashier2Id = '33333333-3333-3333-3333-333333333333';
  const customer1Id = '44444444-4444-4444-4444-444444444444';
  const customer2Id = '55555555-5555-5555-5555-555555555555';

  const users = [
    [
      adminId,
      'admin@rms.com',
      '+254711000111',
      'System',
      'Administrator',
      'admin',
      'active',
      adminPasswordHash,
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      'RMS Plaza, Suite 400',
      'Nairobi',
      'Kenya',
    ],
    [
      cashier1Id,
      'cashier@rms.com',
      '+254722000222',
      'Alice',
      'Mwangi',
      'cashier',
      'active',
      cashierPasswordHash,
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      'Desk 1, Westlands Branch',
      'Nairobi',
      'Kenya',
    ],
    [
      cashier2Id,
      'jane.cashier@rms.com',
      '+254733000333',
      'Jane',
      'Omondi',
      'cashier',
      'active',
      cashierPasswordHash,
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      'Desk 2, Mombasa Branch',
      'Mombasa',
      'Kenya',
    ],
    [
      customer1Id,
      'customer@rms.com',
      '+254744000444',
      'David',
      'Kamau',
      'customer',
      'active',
      customerPasswordHash,
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      'Kilimani Estate',
      'Nairobi',
      'Kenya',
    ],
    [
      customer2Id,
      'john.doe@gmail.com',
      '+254755000555',
      'John',
      'Doe',
      'customer',
      'active',
      customerPasswordHash,
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      'Nyali Beach Road',
      'Mombasa',
      'Kenya',
    ],
  ];

  for (const u of users) {
    await connection.execute(
      `INSERT INTO users (
        id, email, phone, first_name, last_name, role, status,
        password_hash, profile_image_url, address, city, country, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        role = VALUES(role),
        password_hash = VALUES(password_hash),
        updated_at = NOW()`,
      u
    );
  }

  // 2. Seed Amenities
  console.log('🛋️ Seeding Amenities...');
  const amenitiesList = [
    { id: 'am-1', name: 'High-Speed Wi-Fi', icon: 'wifi' },
    { id: 'am-2', name: 'Air Conditioning', icon: 'wind' },
    { id: 'am-3', name: 'Dedicated Workspace', icon: 'laptop' },
    { id: 'am-4', name: 'Free Parking on Premises', icon: 'car' },
    { id: 'am-5', name: 'Swimming Pool', icon: 'water' },
    { id: 'am-6', name: 'Full Kitchen & Cookware', icon: 'utensils' },
    { id: 'am-7', name: 'Smart TV & Netflix', icon: 'tv' },
    { id: 'am-8', name: 'Hot Water & Rain Shower', icon: 'shower' },
    { id: 'am-9', name: '24/7 Security & CCTV', icon: 'shield' },
    { id: 'am-10', name: 'Scenic Balcony View', icon: 'eye' },
  ];

  for (const a of amenitiesList) {
    await connection.execute(
      `INSERT INTO amenities (id, name, icon, created_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon)`,
      [a.id, a.name, a.icon]
    );
  }

  // Seed Service Addons
  console.log('🚕 Seeding Service Addons...');
  const serviceAddons = [
    { id: 'addon-airport', name: 'Airport pickup', description: 'One-way premium airport transfer', price: 3500.0, active: true },
    { id: 'addon-cleaning', name: 'Daily Cleaning', description: 'Daily thorough cleaning service', price: 1000.0, active: true },
    { id: 'addon-laundry', name: 'Laundry Service', description: 'Full laundry and ironing service per basket', price: 1500.0, active: true }
  ];

  for (const s of serviceAddons) {
    await connection.execute(
      `INSERT INTO service_addons (id, name, description, price, active, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), price = VALUES(price), active = VALUES(active)`,
      [s.id, s.name, s.description, s.price, s.active]
    );
  }

  // 3. Seed Properties (Values in Kenyan Shillings - KES)
  console.log('🏠 Seeding Properties in KES...');
  const properties = [
    {
      id: 'prop-101',
      ownerId: adminId,
      name: 'Sunlight Luxury 1-Bedroom Apartment',
      type: 'one_bedroom',
      description: 'Elegant sun-drenched one-bedroom unit with modern finishes, open-plan kitchen, fast Wi-Fi, and 24/7 concierge in the heart of Westlands.',
      address: 'Woodvale Grove, Westlands',
      city: 'Nairobi',
      country: 'Kenya',
      latitude: -1.2663,
      longitude: 36.8049,
      pricePerNight: 5500.0, // KES
      pricePerWeek: 35000.0,
      pricePerMonth: 110000.0,
      capacity: 2,
      bedrooms: 1,
      bathrooms: 1,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      ],
      amenities: ['am-1', 'am-2', 'am-3', 'am-4', 'am-6', 'am-7', 'am-8', 'am-9'],
    },
    {
      id: 'prop-102',
      ownerId: adminId,
      name: 'Ocean Breeze Beachfront Airbnb Villa',
      type: 'airbnb',
      description: 'Stunning beachfront Airbnb villa in Diani Beach with private swimming pool, lush tropical gardens, personal chef on request, and direct beach access.',
      address: 'Diani Beach Road',
      city: 'Diani',
      country: 'Kenya',
      latitude: -4.2798,
      longitude: 39.5947,
      pricePerNight: 18000.0, // KES
      pricePerWeek: 110000.0,
      pricePerMonth: 380000.0,
      capacity: 6,
      bedrooms: 3,
      bathrooms: 3,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
        'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800',
      ],
      amenities: ['am-1', 'am-2', 'am-4', 'am-5', 'am-6', 'am-7', 'am-8', 'am-9', 'am-10'],
    },
    {
      id: 'prop-103',
      ownerId: adminId,
      name: 'Cozy Urban Bedsitter Studio',
      type: 'bedsitter',
      description: 'Budget-friendly, fully furnished studio bedsitter perfect for solo travelers, students, or remote workers. Includes kitchenette and workspace.',
      address: 'Ngong Road, Kilimani',
      city: 'Nairobi',
      country: 'Kenya',
      latitude: -1.2982,
      longitude: 36.7892,
      pricePerNight: 2500.0, // KES
      pricePerWeek: 15000.0,
      pricePerMonth: 45000.0,
      capacity: 1,
      bedrooms: 1,
      bathrooms: 1,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
      ],
      amenities: ['am-1', 'am-3', 'am-6', 'am-7', 'am-8', 'am-9'],
    },
    {
      id: 'prop-104',
      ownerId: adminId,
      name: 'Lakeview Executive Bed & Breakfast',
      type: 'bnb',
      description: 'Charming Lake Victoria view BnB with complimentary hot breakfast every morning, rooftop terrace, serene sunset views, and conference space.',
      address: 'Riat Hills, Kisumu',
      city: 'Kisumu',
      country: 'Kenya',
      latitude: -0.0617,
      longitude: 34.7578,
      pricePerNight: 6500.0, // KES
      pricePerWeek: 40000.0,
      pricePerMonth: 140000.0,
      capacity: 3,
      bedrooms: 2,
      bathrooms: 2,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
      ],
      amenities: ['am-1', 'am-2', 'am-4', 'am-7', 'am-8', 'am-9', 'am-10'],
    },
    {
      id: 'prop-105',
      ownerId: adminId,
      name: 'Downtown Executive Single Room Suite',
      type: 'single_room',
      description: 'Compact, modern executive single room with en-suite bathroom, smart work desk, fast fiber internet, and daily housekeeping.',
      address: 'Kenyatta Avenue, CBD',
      city: 'Nairobi',
      country: 'Kenya',
      latitude: -1.2864,
      longitude: 36.8172,
      pricePerNight: 3500.0, // KES
      pricePerWeek: 22000.0,
      pricePerMonth: 65000.0,
      capacity: 1,
      bedrooms: 1,
      bathrooms: 1,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800',
        'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800',
      ],
      amenities: ['am-1', 'am-2', 'am-3', 'am-7', 'am-8', 'am-9'],
    },
    {
      id: 'prop-106',
      ownerId: adminId,
      name: 'Amber Heights 1-Bedroom Penthouse',
      type: 'one_bedroom',
      description: 'Luxury top-floor penthouse with private jacuzzi, panoramic city skyline view, bespoke interior design, and gourmet kitchen.',
      address: 'Riverside Drive',
      city: 'Nairobi',
      country: 'Kenya',
      latitude: -1.2755,
      longitude: 36.7963,
      pricePerNight: 9500.0, // KES
      pricePerWeek: 58000.0,
      pricePerMonth: 190000.0,
      capacity: 2,
      bedrooms: 1,
      bathrooms: 2,
      status: 'available',
      images: [
        'https://images.unsplash.com/photo-1502005229762-ee152da92e06?w=800',
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800',
      ],
      amenities: ['am-1', 'am-2', 'am-3', 'am-4', 'am-5', 'am-6', 'am-7', 'am-8', 'am-9', 'am-10'],
    },
  ];

  for (const p of properties) {
    await connection.execute(
      `INSERT INTO properties (
        id, owner_id, name, type, description, address, city, country,
        latitude, longitude, price_per_night, price_per_week, price_per_month,
        capacity, bedrooms, bathrooms, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        type = VALUES(type),
        description = VALUES(description),
        price_per_night = VALUES(price_per_night),
        status = VALUES(status),
        updated_at = NOW()`,
      [
        p.id,
        p.ownerId,
        p.name,
        p.type,
        p.description,
        p.address,
        p.city,
        p.country,
        p.latitude,
        p.longitude,
        p.pricePerNight,
        p.pricePerWeek,
        p.pricePerMonth,
        p.capacity,
        p.bedrooms,
        p.bathrooms,
        p.status,
      ]
    );

    // Property images
    await connection.execute('DELETE FROM property_images WHERE property_id = ?', [p.id]);
    for (let i = 0; i < p.images.length; i++) {
      await connection.execute(
        `INSERT INTO property_images (id, property_id, image_url, is_cover, display_order, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [uuidv4(), p.id, p.images[i], i === 0, i]
      );
    }

    // Property amenities
    await connection.execute('DELETE FROM property_amenities WHERE property_id = ?', [p.id]);
    for (const amId of p.amenities) {
      await connection.execute(
        `INSERT INTO property_amenities (property_id, amenity_id) VALUES (?, ?)`,
        [p.id, amId]
      );
    }
  }

  // 4. Seed Bookings & Payments in KES
  console.log('📅 Seeding Bookings & Payments in KES...');
  const booking1Id = 'book-201';
  const booking2Id = 'book-202';
  const booking3Id = 'book-203';

  const sampleBookings = [
    {
      id: booking1Id,
      propertyId: 'prop-101',
      customerId: customer1Id,
      checkIn: '2026-09-05',
      checkOut: '2026-09-08',
      guests: 2,
      total: 16500.0, // 3 nights x 5,500 KES
      status: 'confirmed',
      source: 'website',
      requests: 'Late evening check-in around 8 PM.',
    },
    {
      id: booking2Id,
      propertyId: 'prop-102',
      customerId: customer2Id,
      checkIn: '2026-09-10',
      checkOut: '2026-09-15',
      guests: 4,
      total: 90000.0, // 5 nights x 18,000 KES
      status: 'confirmed',
      source: 'pos',
      requests: 'Airport pickup requested.',
    },
    {
      id: booking3Id,
      propertyId: 'prop-103',
      customerId: customer1Id,
      checkIn: '2026-09-20',
      checkOut: '2026-09-22',
      guests: 1,
      total: 5000.0, // 2 nights x 2,500 KES
      status: 'pending',
      source: 'website',
      requests: null,
    },
  ];

  for (const b of sampleBookings) {
    await connection.execute(
      `INSERT INTO bookings (
        id, property_id, customer_id, check_in_date, check_out_date,
        number_of_guests, total_amount, status, source, special_requests, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE status = VALUES(status), total_amount = VALUES(total_amount)`,
      [
        b.id,
        b.propertyId,
        b.customerId,
        b.checkIn,
        b.checkOut,
        b.guests,
        b.total,
        b.status,
        b.source,
        b.requests,
      ]
    );
  }

  // Payments & Receipts in KES
  const payment1Id = 'pay-301';
  const payment2Id = 'pay-302';

  await connection.execute(
    `INSERT INTO payments (
      id, booking_id, amount, method, status, transaction_ref, issued_by, created_at, updated_at
    ) VALUES 
      (?, ?, 16500.00, 'mpesa', 'paid', 'MPESA_QK7291829', NULL, NOW(), NOW()),
      (?, ?, 90000.00, 'cash', 'paid', 'POS_CSH_992102', ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE status = VALUES(status), amount = VALUES(amount)`,
    [payment1Id, booking1Id, payment2Id, booking2Id, cashier1Id]
  );

  await connection.execute(
    `INSERT INTO receipts (id, payment_id, receipt_number, created_at)
     VALUES 
      (?, ?, 'REC-20260902-1001', NOW()),
      (?, ?, 'REC-20260902-1002', NOW())
     ON DUPLICATE KEY UPDATE receipt_number = VALUES(receipt_number)`,
    [uuidv4(), payment1Id, uuidv4(), payment2Id]
  );

  // 5. Seed Shifts in KES
  console.log('⏰ Seeding Shifts in KES...');
  const shiftId = 'shift-401';
  await connection.execute(
    `INSERT INTO shifts (
      id, cashier_id, open_time, opening_balance, expected_closing_balance,
      actual_closing_balance, transaction_count, status, notes, created_at, updated_at
    ) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 4 HOUR), 10000.00, 100000.00, 100000.00, 1, 'open', 'Morning active desk shift', NOW(), NOW())
    ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [shiftId, cashier1Id]
  );

  // 6. Seed Reviews
  console.log('⭐ Seeding Reviews...');
  const reviews = [
    {
      id: uuidv4(),
      propId: 'prop-101',
      custId: customer1Id,
      bookId: booking1Id,
      rating: 5,
      title: 'Flawless stay in Westlands!',
      comment: 'Super fast Wi-Fi, spotlessly clean, and great security. Would definitely book again!',
    },
    {
      id: uuidv4(),
      propId: 'prop-102',
      custId: customer2Id,
      bookId: booking2Id,
      rating: 5,
      title: 'Breathtaking beach views',
      comment: 'The villa exceeded all expectations. Direct beach access and the pool was pristine.',
    },
  ];

  for (const r of reviews) {
    await connection.execute(
      `INSERT INTO reviews (id, property_id, customer_id, booking_id, rating, title, comment, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NOW(), NOW())
       ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
      [r.id, r.propId, r.custId, r.bookId, r.rating, r.title, r.comment]
    );
  }

  await connection.end();
  console.log('✨ Database seeding in KES finished successfully!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
