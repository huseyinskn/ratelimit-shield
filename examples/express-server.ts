import express from 'express';
import { rateShield } from '../src/index.js';

const app = express();

app.use(
  rateShield({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, slow down!' }
  })
);

const authLimiter = rateShield({
  windowMs: 5 * 60 * 1000,
  max: 5,
  banThreshold: 3,
  message: { error: 'Too many login attempts. Your IP has been temporarily restricted.' }
});

app.post('/api/login', authLimiter, (req, res) => {
  res.json({ success: true, message: 'Logged in successfully' });
});

app.get('/api/data', (req, res) => {
  res.json({ success: true, data: [1, 2, 3] });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000 with rate-shield protection!');
});
