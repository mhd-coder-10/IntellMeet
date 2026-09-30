const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IntelliMeet API",
      version: "1.0.0",
      description:
        "AI-Powered Enterprise Meeting and Collaboration Platform API",
    },
    servers: [
      {
        url: "http://localhost:5100/api",
        description: "Development server",
      },
    ],
    tags: [
      {
        name: "Auth",
        description: "Authentication and authorization endpoints",
      },
      {
        name: "Users",
        description: "User profile and account management",
      },
      {
        name: "Meetings",
        description: "Meeting creation and management endpoints",
      },
      {
        name: "Chat",
        description: "Real-time chat in meetings"
      },
      {
        name: "Notifications",
        description: "User notifications"
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;