const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// Return what's pre-configured via env vars (for "personal" deployments)
router.get('/settings/defaults', (req, res) => {
  res.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasPlaylist: !!process.env.YOUTUBE_PLAYLIST,
  });
});

// Test API key - stateless, key comes from header
router.post('/settings/test', async (req, res) => {
  const apiKey = req.apiKey;

  if (!apiKey) {
    return res.status(400).json({ error: 'No API key provided in header' });
  }

  try {
    const openai = new OpenAI({ apiKey });
    await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 5,
    });
    res.json({ success: true, message: 'API key is valid' });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message.includes('401')
        ? 'Invalid API key'
        : `API test failed: ${error.message}`,
    });
  }
});

module.exports = router;
