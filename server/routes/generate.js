const express = require('express');
const router = express.Router();
const { generateShowConcept } = require('../utils/ai');

router.post('/generate-show', async (req, res) => {
  const apiKey = req.apiKey;

  if (!apiKey) {
    return res.status(400).json({ error: 'OpenAI API key not set. Please configure it in Settings.' });
  }

  const { videos, lockedElements, checkedDataPoints, currentContent, stylePrompt, libraryContext, learningContext } = req.body;

  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    return res.status(400).json({ error: 'At least one video is required.' });
  }

  try {
    const result = await generateShowConcept(
      videos,
      lockedElements || {},
      checkedDataPoints || [],
      currentContent || {},
      apiKey,
      stylePrompt || null,
      libraryContext || null,
      learningContext || null
    );
    res.json(result);
  } catch (error) {
    console.error('Generate show error:', error);
    let message = error.message || 'Failed to generate show concept';
    if (message.includes('401') || message.includes('Incorrect API key')) {
      message = 'Invalid OpenAI API key. Please check your settings.';
    }
    if (message.includes('429') || message.includes('rate limit')) {
      message = 'OpenAI rate limit reached. Please wait a moment and try again.';
    }
    res.status(500).json({ error: message });
  }
});

module.exports = router;
