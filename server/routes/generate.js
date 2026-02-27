const express = require('express');
const router = express.Router();
const { generateShowConcept } = require('../utils/ai');
const { getPlaylistPerformance, buildPlaylistContext } = require('../utils/playlist');

// Cache playlist data for 10 minutes to avoid hammering YouTube on every regeneration
let playlistCache = { data: null, timestamp: 0 };
const PLAYLIST_CACHE_TTL = 10 * 60 * 1000;

function getPlaylistContext() {
  const playlistUrl = process.env.YOUTUBE_PLAYLIST;
  if (!playlistUrl) return null;

  const now = Date.now();
  if (playlistCache.data && now - playlistCache.timestamp < PLAYLIST_CACHE_TTL) {
    return playlistCache.data;
  }

  try {
    const videos = getPlaylistPerformance(playlistUrl);
    const context = buildPlaylistContext(videos);
    playlistCache = { data: context, timestamp: now };
    return context;
  } catch (err) {
    console.error('Playlist fetch failed:', err.message);
    return playlistCache.data || null; // Return stale cache if available
  }
}

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
    // Fetch playlist performance data (server-side, no API key needed)
    const playlistContext = getPlaylistContext();

    // Merge playlist performance into learning context
    let fullLearningContext = learningContext || '';
    if (playlistContext) {
      fullLearningContext = fullLearningContext
        ? `${fullLearningContext}\n\n${playlistContext}`
        : playlistContext;
    }

    const result = await generateShowConcept(
      videos,
      lockedElements || {},
      checkedDataPoints || [],
      currentContent || {},
      apiKey,
      stylePrompt || null,
      libraryContext || null,
      fullLearningContext || null
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
