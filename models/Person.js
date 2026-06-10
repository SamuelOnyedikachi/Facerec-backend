/**
 * models/Person.js
 * Core model — every enrolled individual in the system.
 * Stores biometric face descriptors + full profile data.
 */
const mongoose = require('mongoose')

const personSchema = new mongoose.Schema({
  // Identity
  fullName:    { type: String, required: true, trim: true },
  idNumber:    { type: String, trim: true, default: '' },
  dateOfBirth: { type: Date },
  gender:      { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  nationality: { type: String, default: '' },

  // Contact
  phone:   { type: String, default: '' },
  email:   { type: String, lowercase: true, trim: true, default: '' },
  address: { type: String, default: '' },

  // Classification — flexible labels e.g. ['staff','student','suspect','visitor']
  tags:  [{ type: String }],
  notes: { type: String, default: '' },

  // Profile photo — base64 JPEG thumbnail stored directly
  photo: { type: String, default: '' },

  // Face biometrics — array of 128-D float32 descriptors (one per enrollment angle)
  descriptors: { type: [[Number]], default: [] },
  isEnrolled:  { type: Boolean, default: false },
  enrolledAt:  { type: Date },

  // Watchlist
  onWatchlist:     { type: Boolean, default: false },
  watchlistReason: { type: String, default: '' },
  watchlistLevel:  { type: String, enum: ['low', 'medium', 'high', ''], default: '' },

  // Meta
  createdBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

personSchema.pre('save', function (next) { this.updatedAt = new Date(); next() })

personSchema.index({ fullName: 'text', idNumber: 'text' })
personSchema.index({ onWatchlist: 1 })
personSchema.index({ tags: 1 })

module.exports = mongoose.model('Person', personSchema)
