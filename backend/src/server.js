const dotenv = require("dotenv");
const app = require("./app");
const connectDatabase = require("./config/database");

dotenv.config();

const PORT = process.env.PORT || 5100;

connectDatabase();

app.listen(PORT, () => {
  console.log(`\nIntellMeet backend running on port ${PORT}`);
});



