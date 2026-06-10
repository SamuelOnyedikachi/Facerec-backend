/**
 * models/Recognition.js
 * Logs every recognition event — matched or unknown.
 */
const mongoose = require('mongoose')

const recognitionSchema = new mongoose.Schema({
  person:     { type: mongoose.Schema.Types.ObjectId, ref: 'Person', default: null },
  personName: { type: String, default: 'Unknown' },

  matched:    { type: Boolean, required: true },
  confidence: { type: Number, default: 0 },    // 0–100
  distance:   { type: Number, default: null },  // raw Euclidean distance

  snapshot:   { type: String, default: '' },    // base64 JPEG frame at recognition time
  location:   { type: String, default: '' },
  operator:   { type: String, default: '' },

  wasWatchlisted: { type: Boolean, default: false },

  timestamp: { type: Date, default: Date.now },
})

recognitionSchema.index({ timestamp: -1 })
recognitionSchema.index({ person: 1 })
recognitionSchema.index({ matched: 1 })

module.exports = mongoose.model('Recognition', recognitionSchema)
