/**
 * models/User.js — Operator and admin accounts
 */
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'operator'], default: 'operator' },
  fullName:     { type: String, default: '' },
  lastSeen:     { type: Date },
  active:       { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now },
})

module.exports = mongoose.model('User', userSchema)
