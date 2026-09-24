const dotenv = require("dotenv");
const app = require("./app");
const connectDB = require("./config/database");

dotenv.config();

const PORT = process.env.PORT || 5100;

const startServer = async () => {
  await connectDB()
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV}\n`)
  })
}

startServer();




