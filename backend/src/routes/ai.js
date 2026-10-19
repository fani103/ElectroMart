const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/auth');
const { chat } = require('../services/aiService');

const limiter = rateLimit({ windowMs: 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'You are sending messages too quickly. Please wait a moment.' } });

// POST /api/ai/chat { message, history:[{role:'user'|'model', text}] }  (sign-in optional; needed only for order questions)
router.post('/chat', limiter, optionalAuth, async (req, res, next) => {
  try { res.json(await chat({ message: req.body.message, history: req.body.history, user: req.user })); } catch (e) { next(e); }
});

module.exports = router;
