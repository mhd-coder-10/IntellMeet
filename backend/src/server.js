
require("./config/env_config");

const http = require("http");
const app = require("./app");
const connectDB = require("./config/database");
const { initSocket } = require("./socket/index");

const PORT = process.env.PORT || 5100;

const startServer = async () => {

  try {
    await connectDB()

    const httpServer = http.createServer(app)
    const io = initSocket(httpServer)

    app.set("io", io)

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      // console.log(`Network: http://192.168.0.41:${PORT}`)
      console.log(`Socket.io ready for connections\n`)

      // Check for due tasks reminder shortly after boot and periodically
      const taskService = require("./services/taskService");
      setTimeout(() => {
        taskService.checkDueTasksAndNotify(io).catch((err) => {
          console.warn("[DueReminder] Initial check error:", err.message);
        });
      }, 5000);

      // Periodically scan every 30 minutes
      setInterval(() => {
        taskService.checkDueTasksAndNotify(io).catch((err) => {
          console.warn("[DueReminder] Periodic check error:", err.message);
        });
      }, 30 * 60 * 1000);
    })
  } catch (error) {
    console.error("\nServer startup error:", error.message)
    process.exit(1)
  }
}

startServer();

