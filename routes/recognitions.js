/**
 * routes/recognitions.js
 *
 * POST   /api/recognitions         — log a recognition event
 * GET    /api/recognitions         — list all logs (filterable)
 * GET    /api/recognitions/recent  — last 20 events
 * GET    /api/recognitions/stats   — aggregated analytics
 * DELETE /api/recognitions/:id     — delete single log (admin)
 */
const router = require('express').Router()
const Recognition = require('../models/Recognition')
const Person = require('../models/Person')
const auth = require('../middleware/auth')

/**
 * @swagger
 * /api/recognitions:
 *   post:
 *     summary: Log a recognition event
 *     tags: [Recognitions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - matched
 *             properties:
 *               personId:
 *                 type: string
 *                 description: MongoDB ID of matched person (null if unknown)
 *               matched:
 *                 type: boolean
 *                 description: Whether a match was found
 *               confidence:
 *                 type: number
 *                 description: Confidence score (0-1)
 *               distance:
 *                 type: number
 *                 description: Euclidean distance from matched descriptor
 *               snapshot:
 *                 type: string
 *                 description: Base64-encoded face image
 *               location:
 *                 type: string
 *                 description: Location/camera name
 *     responses:
 *       201:
 *         description: Recognition event logged
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
// ── Log recognition event ─────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { personId, matched, confidence, distance, snapshot, location } = req.body

    if (matched === undefined)
      return res.status(400).json({ message: 'matched (boolean) is required' })

    let personName = 'Unknown'
    let wasWatchlisted = false

    if (personId && matched) {
      const person = await Person.findById(personId, 'fullName onWatchlist watchlistLevel watchlistReason photo')
      if (person) {
        personName = person.fullName
        wasWatchlisted = person.onWatchlist

        // Emit watchlist alert to all clients immediately
        if (wasWatchlisted) {
          req.app.get('io')?.emit('watchlist:alert', {
            personId,
            fullName: person.fullName,
            watchlistLevel: person.watchlistLevel,
            watchlistReason: person.watchlistReason,
            confidence: confidence || 0,
            location: location || '',
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    const rec = await Recognition.create({
      person: personId || null,
      personName,
      matched,
      confidence: confidence || 0,
      distance: distance || null,
      snapshot: snapshot || '',
      location: location || '',
      operator: req.user.username,
      wasWatchlisted,
    })

    // Broadcast every recognition to all clients (for live log feed)
    req.app.get('io')?.emit('recognition:new', {
      id: rec._id,
      personId: personId || null,
      personName,
      matched,
      confidence: confidence || 0,
      wasWatchlisted,
      location: location || '',
      timestamp: rec.timestamp,
    })

    res.status(201).json({ id: rec._id })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/recognitions:
 *   get:
 *     summary: List all recognition logs with filters
 *     tags: [Recognitions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: matched
 *         schema:
 *           type: boolean
 *         description: Filter by match status
 *       - in: query
 *         name: person
 *         schema:
 *           type: string
 *         description: Filter by person ID
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of recognition logs
 *       401:
 *         description: Not authenticated
 */
// ── List logs ─────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { matched, person, from, to, page = 1, limit = 50 } = req.query
    const filter = {}

    if (matched !== undefined) filter.matched = matched === 'true'
    if (person) filter.person = person
    if (from || to) {
      filter.timestamp = {}
      if (from) filter.timestamp.$gte = new Date(from)
      if (to) filter.timestamp.$lte = new Date(to)
    }

    const total = await Recognition.countDocuments(filter)
    const logs = await Recognition.find(filter)
      .populate('person', 'fullName idNumber tags photo onWatchlist')
      .sort({ timestamp: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ logs, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/recognitions/recent:
 *   get:
 *     summary: Get last 20 recognition events
 *     tags: [Recognitions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent recognition events
 *       401:
 *         description: Not authenticated
 */
// ── Recent events for live feed ───────────────────────────────────────────────
router.get('/recent', auth, async (req, res) => {
  try {
    const logs = await Recognition.find()
      .populate('person', 'fullName photo tags onWatchlist')
      .sort({ timestamp: -1 })
      .limit(20)
    res.json(logs)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/recognitions/stats:
 *   get:
 *     summary: Get recognition analytics and statistics
 *     tags: [Recognitions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recognition statistics with daily/hourly breakdowns
 *       401:
 *         description: Not authenticated
 */
// ── Analytics stats ───────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalRecognitions,
      totalMatched,
      totalUnknown,
      watchlistHits,
      today,
      avgConfResult,
      hourlyData,
      dailyData,
    ] = await Promise.all([
      Recognition.countDocuments(),
      Recognition.countDocuments({ matched: true }),
      Recognition.countDocuments({ matched: false }),
      Recognition.countDocuments({ wasWatchlisted: true }),
      Recognition.countDocuments({ timestamp: { $gte: day } }),
      Recognition.aggregate([
        { $match: { matched: true } },
        { $group: { _id: null, avg: { $avg: '$confidence' } } },
      ]),
      Recognition.aggregate([
        { $match: { timestamp: { $gte: day } } },
        {
          $group: {
            _id: { $hour: '$timestamp' },
            count: { $sum: 1 },
            matched: { $sum: { $cond: ['$matched', 1, 0] } },
          }
        },
        { $sort: { _id: 1 } },
      ]),
      Recognition.aggregate([
        { $match: { timestamp: { $gte: month } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
            matched: { $sum: { $cond: ['$matched', 1, 0] } },
            avgConf: { $avg: '$confidence' },
          }
        },
        { $sort: { _id: 1 } },
      ]),
    ])

    res.json({
      totalRecognitions,
      totalMatched,
      totalUnknown,
      watchlistHits,
      today,
      matchRate: totalRecognitions > 0
        ? Math.round((totalMatched / totalRecognitions) * 100) : 0,
      avgConfidence: avgConfResult[0]
        ? Math.round(avgConfResult[0].avg) : 0,
      hourlyData,
      dailyData,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/recognitions/{id}:
 *   delete:
 *     summary: Delete a single recognition log (admin only)
 *     tags: [Recognitions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Recognition log ID
 *     responses:
 *       200:
 *         description: Log entry deleted
 *       401:
 *         description: Not authenticated or not admin
 */
// ── Delete single log (admin only) ────────────────────────────────────────────
router.delete('/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    await Recognition.findByIdAndDelete(req.params.id)
    res.json({ message: 'Log entry deleted' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
