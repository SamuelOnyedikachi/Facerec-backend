/**
 * server.js — FaceRec Backend Entry Point
 *
 * Quick start:
 *   cp .env.example .env    ← fill MONGO_URI + JWT_SECRET
 *   npm install
 *   npm run seed            ← create admin + sample data
 *   npm run dev             ← starts on http://localhost:5000
 */
require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const connectDB = require('./config/db')
const { generateSpec } = require('./config/swagger-spec')

require('./models/Person')
require('./models/Recognition')
require('./models/User')

const app = express()
const server = http.createServer(app)

// ── Socket.io ──────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  }
})
app.set('io', io)

io.on('connection', socket => {
  console.log(`[WS] Client connected: ${socket.id}`)
  socket.on('disconnect', () => console.log(`[WS] Disconnected: ${socket.id}`))
})

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }))
app.use(express.json({ limit: '10mb' }))  // 10mb for base64 photos + descriptors

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — slow down' },
}))

// ── Swagger API Docs ───────────────────────────────────────────────────────────
// Spec endpoint
app.get('/api/swagger.json', (req, res) => {
  res.json(generateSpec())
})

// Swagger UI (served from CDN)
app.get('/api-docs', (req, res) => {
  const spec = generateSpec()
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>FaceRec API Documentation</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
        <style>
          html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
          *, *:before, *:after { box-sizing: inherit; }
          body { margin:0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            SwaggerUIBundle({
              url: "/api/swagger.json",
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout"
            })
          }
        </script>
      </body>
    </html>
  `)
})

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'))
app.use('/api/persons', require('./routes/persons'))
app.use('/api/recognitions', require('./routes/recognitions'))

app.get('/api/health', (_, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
}))

// 404
app.use((req, res) => res.status(404).json({ message: `Not found: ${req.path}` }))

// Global error
app.use((err, req, res, next) => {
  console.error('[ERR]', err)
  res.status(500).json({ message: 'Internal server error' })
})

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🛡  FaceRec backend running`)
    console.log(`   http://localhost:${PORT}`)
    console.log(`   📚 Swagger UI: http://localhost:${PORT}/api-docs`)
    console.log(`   ENV: ${process.env.NODE_ENV || 'development'}\n`)
  })
})
