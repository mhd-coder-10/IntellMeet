// Prometheus metrics exporter and instrumentation for IntellMeet
// Collects Node.js runtime metrics, HTTP request latency, active calls, and socket sessions

const client = require("prom-client");

// Initialize Prometheus Register
const register = new client.Registry();

// Collect default metrics (CPU, Memory Heap, Event Loop Lag, GC, File Descriptors)
client.collectDefaultMetrics({
  app: "intellmeet-backend",
  prefix: "intellmeet_",
  timeout: 10000,
  register,
});

// 1. HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: "intellmeet_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// 2. HTTP Requests Total Counter
const httpRequestsTotal = new client.Counter({
  name: "intellmeet_http_requests_total",
  help: "Total number of HTTP requests handled",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// 3. Active Socket.io Connections Gauge
const activeSocketsGauge = new client.Gauge({
  name: "intellmeet_active_socket_connections",
  help: "Current number of active Socket.io connected clients",
  registers: [register],
});

// 4. Active Live Video Meetings Gauge
const activeMeetingsGauge = new client.Gauge({
  name: "intellmeet_active_meetings_count",
  help: "Current number of ongoing WebRTC video meetings",
  registers: [register],
});

// 5. Active Meeting Participants Gauge
const activeParticipantsGauge = new client.Gauge({
  name: "intellmeet_active_meeting_participants",
  help: "Current total number of participants across all active meetings",
  registers: [register],
});

// Middleware to time HTTP requests and increment counters
const metricsMiddleware = (req, res, next) => {
  if (req.path === "/metrics" || req.path === "/api/metrics" || req.path === "/api/health") {
    return next();
  }

  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    // Normalize route to avoid high cardinality (e.g. /meetings/123 -> /meetings/:id)
    let route = (req.baseUrl || "") + (req.route?.path || req.path || "");
    if (!route || route === "") route = req.path || "unknown";

    // Clean up IDs in route pattern
    route = route.replace(/[0-9a-fA-F]{24}/g, ":id");

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestDurationSeconds.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });

  next();
};

// Route handler for Prometheus scraper (/metrics) with Secure Basic Auth
const metricsEndpointHandler = async (req, res) => {
  const metricsUser = process.env.METRICS_USER;
  const metricsPass = process.env.METRICS_PASS;

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader("WWW-Authenticate", 'Basic realm="IntellMeet Metrics"');
    return res.status(401).send("Authentication required for Prometheus metrics");
  }

  const [scheme, encoded] = authHeader.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    if (user === metricsUser && pass === metricsPass) {
      try {
        res.set("Content-Type", register.contentType);
        return res.end(await register.metrics());
      } catch (err) {
        return res.status(500).end(err.message);
      }
    }
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="IntellMeet Metrics"');
  return res.status(401).send("Invalid metrics credentials");
};

// Helper methods to update socket and meeting gauges
const incActiveSockets = () => activeSocketsGauge.inc();
const decActiveSockets = () => activeSocketsGauge.dec();
const setActiveSockets = (count) => activeSocketsGauge.set(count);
const setActiveMeetings = (count) => activeMeetingsGauge.set(count);
const setActiveParticipants = (count) => activeParticipantsGauge.set(count);

module.exports = {
  register,
  metricsMiddleware,
  metricsEndpointHandler,
  incActiveSockets,
  decActiveSockets,
  setActiveSockets,
  setActiveMeetings,
  setActiveParticipants,
};


