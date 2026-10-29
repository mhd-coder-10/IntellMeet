// To reliably load environment variables across both root and backend contexts
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 1. Load default process cwd .env if present
dotenv.config();

// 2. Always ensure backend/.env is loaded if SMTP or PORT are not set from cwd
if (!process.env.SMTP_USER || !process.env.PORT) {
  const backendEnvPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
  }
}
