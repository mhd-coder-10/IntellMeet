const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IntellMeet API",
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
        description: "Real-time chat in meetings",
      },
      {
        name: "Notifications",
        description: "User notifications",
      },
      {
        name: "AI",
        description: "AI transcription, summarization, and action items",
      },
      {
        name: "Teams",
        description: "Team workspaces, members, and invitations",
      },
      {
        name: "Projects",
        description: "Project boards under team workspaces",
      },
      {
        name: "Tasks",
        description: "Kanban task management and assignments",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;