const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require('morgan')
const routes = require('./index')

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.urlencoded({extended : true}));
app.use(express.json());

// Health check
app.get("/api/qw", (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'IntelliMeet API is running',
    timestamp: new Date().toISOString(),
  })
});

// Mount all API routes
app.use('/api', routes);

module.exports = app;
