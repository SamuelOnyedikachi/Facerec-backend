/**
 * seed.js — Populate database with admin user + sample persons
 * Run: npm run seed
 */
require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const Person = require('./models/Person')
const User = require('./models/User')
const Recognition = require('./models/Recognition')

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/facerec'
  await mongoose.connect(uri)
  console.log('[SEED] Connected to MongoDB')

  await Promise.all([
    Person.deleteMany(),
    User.deleteMany(),
    Recognition.deleteMany(),
  ])
  console.log('[SEED] Cleared existing data')

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'samuelonyedikachi450@gmail.com'
  const adminPwd = process.env.ADMIN_PASSWORD || 'Divinesavour12345'
  await User.create({
    username: adminEmail.toLowerCase(),
    passwordHash: await bcrypt.hash(adminPwd, 10),
    role: 'admin',
    fullName: process.env.ADMIN_FULLNAME || 'System Administrator',
  })

  // Operator user
  await User.create({
    username: 'operator1',
    passwordHash: await bcrypt.hash('Operator@123', 10),
    role: 'operator',
    fullName: 'Security Operator',
  })
  console.log('[SEED] Created 2 users')

  console.log('\n[SEED] ✓ Done!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Login credentials:')
  console.log(`  Admin:    ${adminEmail} / ${adminPwd}`)
  console.log('  Operator: operator1 / Operator@123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nNext steps:')
  console.log('  1. Start backend:  npm run dev')
  console.log('  2. Start frontend: cd ../frontend && npm run dev')
  console.log('  3. Login at http://localhost:3000')
  console.log('  4. Go to /enroll to add face descriptors to each person\n')

  await mongoose.disconnect()
}

seed().catch(err => {
  console.error('[SEED] Error:', err.message)
  process.exit(1)
})
