/**
 * config/db.js — MongoDB Atlas connection with helpful error messages
 */
const mongoose = require('mongoose')

async function connectDB() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    console.error('[DB] ERROR: MONGO_URI is not set in .env')
    console.error('[DB] Copy .env.example → .env and fill in your Atlas connection string')
    process.exit(1)
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })
    console.log(`[DB] ✓ Connected → ${mongoose.connection.host} / ${mongoose.connection.name}`)
  } catch (err) {
    console.error('[DB] Connection failed:', err.message)
    if (err.message.includes('authentication'))
      console.error('[DB] → Wrong username or password in MONGO_URI')
    else if (err.message.includes('ETIMEOUT') || err.message.includes('querySrv'))
      console.error('[DB] → Cannot reach Atlas. Check your internet or cluster URL')
    else if (err.message.includes('IP') || err.message.includes('whitelist'))
      console.error('[DB] → Your IP is not whitelisted → Atlas → Network Access → Add IP')
    process.exit(1)
  }
}

mongoose.connection.on('disconnected', () => console.warn('[DB] Disconnected'))

process.on('SIGINT', async () => {
  await mongoose.connection.close()
  console.log('[DB] Connection closed on shutdown')
  process.exit(0)
})

module.exports = connectDB
