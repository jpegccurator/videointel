const express = require('express');
const cors = require('cors');
const path = require('path');
const { execSync } = require('child_process');
const analyzeRoutes = require('./routes/analyze');
const generateRoutes = require('./routes/generate');
const settingsRoutes = require('./routes/settings');
const styleRoutes = require('./routes/style');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Basic auth - only active when AUTH_PASSWORD env var is set
if (process.env.AUTH_PASSWORD) {
  app.use((req, res, next) => {
    // Health check and static assets bypass auth (HTML triggers the prompt,
    // then the browser sends credentials for API calls automatically)
    if (req.path === '/health' || req.path.startsWith('/assets/')) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="VideoIntel"');
      return res.status(401).send('Authentication required');
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
    const [, password] = credentials.split(':');

    if (password !== process.env.AUTH_PASSWORD) {
      res.set('WWW-Authenticate', 'Basic realm="VideoIntel"');
      return res.status(401).send('Invalid credentials');
    }

    next();
  });
  console.log('Basic auth enabled');
}

// Middleware: extract API key from header, fall back to env var
app.use((req, res, next) => {
  req.apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY || null;
  next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API Routes
app.use('/api', analyzeRoutes);
app.use('/api', generateRoutes);
app.use('/api', settingsRoutes);
app.use('/api', styleRoutes);

// Production: serve built client
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Check for yt-dlp on startup
try {
  const version = execSync('yt-dlp --version', { encoding: 'utf-8' }).trim();
  console.log(`\u2713 yt-dlp found (version ${version})`);
} catch {
  console.error('\n\u2717 yt-dlp not found!');
  console.error('  Install it with one of:');
  console.error('    brew install yt-dlp');
  console.error('    pip install yt-dlp');
  console.error('    pip3 install yt-dlp\n');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nVideoIntel running on port ${PORT}\n`);
});
