const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.urlencoded({extended : true}));
app.use(express.json());


app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "IntellMeet API is running",
  });
});

module.exports = app;
