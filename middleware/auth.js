/**
 * middleware/auth.js — JWT verification + role guard
 */
const jwt = require('jsonwebtoken')

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token — access denied' })
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret')
    next()
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' })
  }
}

auth.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required' })
  next()
}

module.exports = auth
