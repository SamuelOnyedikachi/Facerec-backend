/**
 * routes/persons.js
 *
 * GET    /api/persons                    — list / search
 * POST   /api/persons                    — create person
 * GET    /api/persons/watchlist          — watchlisted only
 * GET    /api/persons/enrolled/descriptors — all descriptors for recognition matcher
 * GET    /api/persons/:id               — single person full profile
 * PUT    /api/persons/:id               — update profile
 * DELETE /api/persons/:id               — delete (admin)
 * POST   /api/persons/:id/descriptor    — add face descriptor
 * GET    /api/persons/:id/recognitions  — recognition history
 */
const router = require('express').Router()
const Person = require('../models/Person')
const Recognition = require('../models/Recognition')
const auth = require('../middleware/auth')

/**
 * @swagger
 * /api/persons:
 *   get:
 *     summary: List and search persons
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, ID, email, or tags
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: watchlist
 *         schema:
 *           type: boolean
 *         description: Filter watchlist persons
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
 *         description: List of persons with pagination
 *       401:
 *         description: Not authenticated
 */
// ── List / search ─────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { search, tag, watchlist, page = 1, limit = 50 } = req.query
    const filter = {}

    if (search) {
      filter.$or = [
        { fullName: new RegExp(search, 'i') },
        { idNumber: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') },
      ]
    }
    if (tag) filter.tags = tag
    if (watchlist !== undefined) filter.onWatchlist = watchlist === 'true'

    const total = await Person.countDocuments(filter)
    const persons = await Person.find(filter, '-descriptors')
      .sort({ fullName: 1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)

    res.json({ persons, total, page: +page, pages: Math.ceil(total / +limit) })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/watchlist:
 *   get:
 *     summary: Get watchlisted persons only
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of watchlisted persons
 *       401:
 *         description: Not authenticated
 */
// ── Watchlist shortcut ────────────────────────────────────────────────────────
router.get('/watchlist', auth, async (req, res) => {
  try {
    const persons = await Person.find({ onWatchlist: true }, '-descriptors')
      .sort({ watchlistLevel: -1, fullName: 1 })
    res.json(persons)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/enrolled/descriptors:
 *   get:
 *     summary: Get all enrolled person descriptors for face matching
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All enrolled persons with their face descriptors
 *       401:
 *         description: Not authenticated
 */
// ── All enrolled descriptors for recognition matcher ──────────────────────────
// Called by frontend on /live startup to build FaceMatcher
router.get('/enrolled/descriptors', auth, async (req, res) => {
  try {
    const persons = await Person.find(
      { isEnrolled: true },
      'fullName idNumber descriptors onWatchlist watchlistLevel watchlistReason photo tags notes'
    )
    res.json(persons)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons:
 *   post:
 *     summary: Create a new person record
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *             properties:
 *               fullName:
 *                 type: string
 *               idNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *               nationality:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *               photo:
 *                 type: string
 *               onWatchlist:
 *                 type: boolean
 *               watchlistReason:
 *                 type: string
 *               watchlistLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *     responses:
 *       201:
 *         description: Person created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
// ── Create person ─────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      fullName, idNumber, dateOfBirth, gender, nationality,
      phone, email, address, tags, notes, photo,
      onWatchlist, watchlistReason, watchlistLevel,
    } = req.body

    if (!fullName?.trim())
      return res.status(400).json({ message: 'fullName is required' })

    const person = await Person.create({
      fullName: fullName.trim(),
      idNumber: idNumber?.trim() || '',
      dateOfBirth, gender, nationality,
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      address: address?.trim() || '',
      tags: Array.isArray(tags) ? tags : [],
      notes: notes?.trim() || '',
      photo: photo || '',
      onWatchlist: onWatchlist || false,
      watchlistReason: watchlistReason?.trim() || '',
      watchlistLevel: onWatchlist ? (watchlistLevel || 'medium') : '',
      createdBy: req.user.username,
    })

    // Notify connected clients
    req.app.get('io')?.emit('person:added', {
      id: person._id, fullName: person.fullName
    })

    res.status(201).json({ id: person._id, fullName: person.fullName })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/{id}:
 *   get:
 *     summary: Get a single person's full profile
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Person ID
 *     responses:
 *       200:
 *         description: Person details including descriptors
 *       404:
 *         description: Person not found
 *       401:
 *         description: Not authenticated
 */
// ── Get single person ─────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const person = await Person.findById(req.params.id)
    if (!person) return res.status(404).json({ message: 'Person not found' })
    res.json(person)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/{id}:
 *   put:
 *     summary: Update a person's profile
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated person profile
 *       404:
 *         description: Person not found
 *       401:
 *         description: Not authenticated
 */
router.put('/:id', auth, async (req, res) => {
  try {
    // Never overwrite descriptors via this route
    const { descriptors, ...fields } = req.body

    // Normalize tags if sent as comma string
    if (typeof fields.tags === 'string') {
      fields.tags = fields.tags.split(',').map(t => t.trim()).filter(Boolean)
    }

    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { ...fields, updatedAt: new Date() },
      { new: true, select: '-descriptors' }
    )
    if (!person) return res.status(404).json({ message: 'Person not found' })

    // Broadcast watchlist change to all clients
    if (fields.onWatchlist !== undefined) {
      req.app.get('io')?.emit('watchlist:updated', {
        id: person._id,
        fullName: person.fullName,
        onWatchlist: person.onWatchlist,
      })
    }

    res.json(person)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/{id}:
 *   delete:
 *     summary: Delete a person (admin only)
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Person deleted successfully
 *       404:
 *         description: Person not found
 *       401:
 *         description: Not authenticated or not admin
 */
// ── Delete person (admin only) ────────────────────────────────────────────────
router.delete('/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    const person = await Person.findByIdAndDelete(req.params.id)
    if (!person) return res.status(404).json({ message: 'Person not found' })

    // Also delete recognition logs for this person
    await Recognition.deleteMany({ person: req.params.id })

    res.json({ message: `${person.fullName} deleted successfully` })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/{id}/descriptor:
 *   post:
 *     summary: Add a face descriptor (enrollment)
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - descriptor
 *             properties:
 *               descriptor:
 *                 type: array
 *                 items:
 *                   type: number
 *                 minItems: 128
 *                 maxItems: 128
 *                 description: 128-element float32 array from face-api.js
 *     responses:
 *       200:
 *         description: Descriptor added successfully
 *       400:
 *         description: Invalid descriptor format
 *       404:
 *         description: Person not found
 *       401:
 *         description: Not authenticated
 */
// ── Add face descriptor (enrollment step) ─────────────────────────────────────
router.post('/:id/descriptor', auth, async (req, res) => {
  try {
    const { descriptor } = req.body

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128)
      return res.status(400).json({
        message: 'descriptor must be a 128-element float32 array'
      })

    const person = await Person.findByIdAndUpdate(
      req.params.id,
      {
        $push: { descriptors: descriptor },
        isEnrolled: true,
        enrolledAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true, select: 'fullName descriptors isEnrolled' }
    )

    if (!person) return res.status(404).json({ message: 'Person not found' })

    res.json({
      message: 'Descriptor added successfully',
      count: person.descriptors.length,
      isEnrolled: person.isEnrolled,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/persons/{id}/recognitions:
 *   get:
 *     summary: Get recognition history for a person
 *     tags: [Persons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of recognition records (last 100)
 *       401:
 *         description: Not authenticated
 */
// ── Recognition history for one person ───────────────────────────────────────
router.get('/:id/recognitions', auth, async (req, res) => {
  try {
    const logs = await Recognition.find({ person: req.params.id })
      .sort({ timestamp: -1 })
      .limit(100)
    res.json(logs)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
