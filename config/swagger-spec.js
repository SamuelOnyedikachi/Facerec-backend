/**
 * config/swagger-spec.js
 * 
 * Lightweight OpenAPI spec generator (no swagger-jsdoc dependency)
 * Generates the Swagger/OpenAPI spec dynamically from route comments
 */

const fs = require('fs')
const path = require('path')

function generateSpec() {
    const PORT = process.env.PORT || 5000

    const spec = {
        openapi: '3.0.0',
        info: {
            title: 'FaceRec API',
            version: '1.0.0',
            description: 'Face Recognition Backend API Documentation',
            contact: {
                name: 'FaceRec Team',
                url: 'http://localhost:3000',
            },
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Development Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        paths: {
            '/api/auth/login': {
                post: {
                    summary: 'User login',
                    tags: ['Auth'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['username', 'password'],
                                    properties: {
                                        username: { type: 'string', example: 'admin' },
                                        password: { type: 'string', example: 'password123' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Login successful, returns JWT token' },
                        400: { description: 'Missing username or password' },
                        401: { description: 'Invalid credentials' },
                    },
                },
            },
            '/api/auth/register': {
                post: {
                    summary: 'Register a new user (admin only)',
                    tags: ['Auth'],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['username', 'password'],
                                    properties: {
                                        username: { type: 'string', example: 'operator1' },
                                        password: { type: 'string', example: 'securepass123' },
                                        role: { type: 'string', enum: ['admin', 'operator'], default: 'operator' },
                                        fullName: { type: 'string', example: 'John Doe' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'User created successfully' },
                        400: { description: 'Missing required fields' },
                        409: { description: 'Username already taken' },
                        401: { description: 'Not authenticated or not admin' },
                    },
                },
            },
            '/api/auth/me': {
                get: {
                    summary: 'Get current user profile',
                    tags: ['Auth'],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Current user profile' },
                        404: { description: 'User not found' },
                        401: { description: 'Not authenticated' },
                    },
                },
            },
            '/api/auth/users': {
                get: {
                    summary: 'List all users (admin only)',
                    tags: ['Auth'],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'List of all users' },
                        401: { description: 'Not authenticated or not admin' },
                    },
                },
            },
            '/api/persons': {
                get: {
                    summary: 'List and search persons',
                    tags: ['Persons'],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by name, ID, email, or tags' },
                        { in: 'query', name: 'tag', schema: { type: 'string' }, description: 'Filter by tag' },
                        { in: 'query', name: 'watchlist', schema: { type: 'boolean' }, description: 'Filter watchlist persons' },
                        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                        { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
                    ],
                    responses: {
                        200: { description: 'List of persons with pagination' },
                        401: { description: 'Not authenticated' },
                    },
                },
                post: {
                    summary: 'Create a new person record',
                    tags: ['Persons'],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['fullName'],
                                    properties: {
                                        fullName: { type: 'string' },
                                        idNumber: { type: 'string' },
                                        email: { type: 'string' },
                                        onWatchlist: { type: 'boolean' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Person created successfully' },
                        401: { description: 'Not authenticated' },
                    },
                },
            },
            '/api/recognitions': {
                post: {
                    summary: 'Log a recognition event',
                    tags: ['Recognitions'],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['matched'],
                                    properties: {
                                        personId: { type: 'string' },
                                        matched: { type: 'boolean' },
                                        confidence: { type: 'number' },
                                        location: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Recognition event logged' },
                        401: { description: 'Not authenticated' },
                    },
                },
                get: {
                    summary: 'List all recognition logs with filters',
                    tags: ['Recognitions'],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: 'query', name: 'matched', schema: { type: 'boolean' } },
                        { in: 'query', name: 'person', schema: { type: 'string' } },
                        { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
                        { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
                        { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
                        { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
                    ],
                    responses: {
                        200: { description: 'List of recognition logs' },
                        401: { description: 'Not authenticated' },
                    },
                },
            },
            '/api/recognitions/recent': {
                get: {
                    summary: 'Get last 20 recognition events',
                    tags: ['Recognitions'],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Recent recognition events' },
                        401: { description: 'Not authenticated' },
                    },
                },
            },
            '/api/recognitions/stats': {
                get: {
                    summary: 'Get recognition analytics and statistics',
                    tags: ['Recognitions'],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'Recognition statistics with daily/hourly breakdowns' },
                        401: { description: 'Not authenticated' },
                    },
                },
            },
        },
    }

    return spec
}

module.exports = { generateSpec }
