import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { keysRouter } from './routes/keys.js';
import { modelsRouter } from './routes/models.js';
import { proxyRouter } from './routes/proxy.js';
import { fallbackRouter } from './routes/fallback.js';
import { analyticsRouter } from './routes/analytics.js';
import { healthRouter } from './routes/health.js';
import { settingsRouter } from './routes/settings.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DASHBOARD_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://[::1]:5173',
];

function getAllowedCorsOrigins() {
  const configuredOrigins = (process.env.DASHBOARD_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_DASHBOARD_ORIGINS, ...configuredOrigins]);
}

export function createApp() {
  const app = express();
  const allowedCorsOrigins = getAllowedCorsOrigins();

  // CSP intentionally disabled — the SPA bundles inline styles and the OG
  // image is loaded from the same origin; enabling helmet's default CSP
  // breaks the React build's hashed-asset loader. HSTS off because this is
  // a single-user local proxy, served over HTTP on localhost. Both should
  // stay disabled unless someone serves the proxy over HTTPS publicly
  // (which is also not a supported deployment — see README).
  app.use(helmet({ contentSecurityPolicy: false, hsts: false }));
  app.use(cors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      callback(null, !origin || allowedCorsOrigins.has(origin));
    },
  }));
  app.use(express.json({ limit: '1mb' }));
app.get('/api/dastyari', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Dast-Yari route works'
  });
});

app.post('/api/dastyari', async (req, res) => {
  try {
    const question = req.body?.question;

    if (!question) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
      return;
    }

    const knowledge = fs.readFileSync(path.resolve(__dirname, '../../dastyari.txt'), 'utf8');

    const prompt =
      'You are Dast-Yari assistant. Answer in the same language as the user question. Use natural wording in that language and avoid mixing Swedish or English words unless necessary. Give a short and clear answer first. If the user asks for details, then provide a longer explanation. ' +
      'You only give information about Dast-Yari. Do not answer questions outside this topic. ' +
      'Greeting messages are an exception to the information rule. If the user only greets you, answer with a friendly greeting in the same language and say that you can provide information about Dast-Yari, its purpose, membership, values, and who it helps. ' +
      'Only answer using the information below. Do not invent information. ' +
      'If information is missing say: Den informationen finns inte ännu. Kontakta oss via e-post: utbildningkonto2019@gmail.com\n\n' +
      'Dast-Yari information:\n' +
      knowledge +
      '\n\nUser question:\n' +
      question;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      const status = data.error?.status;
      const code = data.error?.code;

      if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
        res.status(429).json({
          error: 'Chatbot temporarily unavailable. Please try again soon.'
        });
        return;
      }

      res.status(500).json({
        error: 'Chatbot could not answer right now. Please try again later.'
      });
      return;
    }

    res.json({ answer });
  } catch (err) {
    console.error('Dast-Yari endpoint error:', err);
    res.status(500).json({ error: 'Dast-Yari endpoint failed' });
  }
});
  // API routes
  app.use('/api/keys', keysRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/fallback', fallbackRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/settings', settingsRouter);

  // OpenAI-compatible proxy
  app.use('/v1', proxyRouter);

  // Health check
  app.get('/api/ping', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler (for API routes)
  app.use(errorHandler);

  // Serve client static files (after API error handler)
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
