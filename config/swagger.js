const swaggerJsdoc = require('swagger-jsdoc')

const options = {
    definition: {
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
                url: `http://localhost:${process.env.PORT || 5000}`,
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
    },
    apis: ['./routes/*.js'],
}

module.exports = swaggerJsdoc(options)
