/**
 * routes/auth.js
 * POST /api/auth/login
 * POST /api/auth/register  (admin only)
 * GET  /api/auth/me
 * GET  /api/auth/users     (admin only)
 */
const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const auth = require('../middleware/auth')

const sign = (user) => jwt.sign(
  { id: user._id, username: user.username, role: user.role, fullName: user.fullName },
  process.env.JWT_SECRET || 'dev_secret',
  { expiresIn: '12h' }
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 role:
 *                   type: string
 *                 username:
 *                   type: string
 *                 fullName:
 *                   type: string
 *       400:
 *         description: Missing username or password
 *       401:
 *         description: Invalid credentials
 */
// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' })

    const user = await User.findOne({ username: username.toLowerCase() })
    if (!user || !user.active)
      return res.status(401).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok)
      return res.status(401).json({ message: 'Invalid credentials' })

    user.lastSeen = new Date()
    await user.save()

    res.json({
      token: sign(user),
      role: user.role,
      username: user.username,
      fullName: user.fullName,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "operator1"
 *               password:
 *                 type: string
 *                 example: "securepass123"
 *               role:
 *                 type: string
 *                 enum: [admin, operator]
 *                 default: operator
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Username already taken
 *       401:
 *         description: Not authenticated or not admin
 */
// Register new user (admin only)
router.post('/register', auth, auth.adminOnly, async (req, res) => {
  try {
    const { username, password, role, fullName } = req.body
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' })

    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(409).json({ message: 'Username already taken' })

    const user = await User.create({
      username: username.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: role || 'operator',
      fullName: fullName || '',
    })
    res.status(201).json({ message: 'User created', userId: user._id })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 role:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 active:
 *                   type: boolean
 *       404:
 *         description: User not found
 *       401:
 *         description: Not authenticated
 */
// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, '-passwordHash')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   username:
 *                     type: string
 *                   role:
 *                     type: string
 *                   fullName:
 *                     type: string
 *                   active:
 *                     type: boolean
 *       401:
 *         description: Not authenticated or not admin
 */
// List all users
router.get('/users', auth, auth.adminOnly, async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 })
    res.json(users)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/**
 * @swagger
 * /api/auth/users/{id}:
 *   put:
 *     summary: Update a user (admin only)
 *     tags: [Auth]
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
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, operator]
 *               fullName:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated or not admin
 */
router.put('/users/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    const updates = {}
    const { role, fullName, active } = req.body
    if (role && ['admin', 'operator'].includes(role)) updates.role = role
    if (typeof fullName === 'string') updates.fullName = fullName
    if (typeof active === 'boolean') updates.active = active

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ message: 'No valid fields to update' })

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, select: '-passwordHash' })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
