const express = require('express');
const router = express.Router();
const { getTranscript } = require('../utils/transcript');
const { analyzeTranscript } = require('../utils/ai');
const { verifyDataPoints } = require('../utils/verify');

router.post('/analyze', async (req, res) => {
  const { url } = req.body;
  const apiKey = req.apiKey;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'OpenAI API key not set. Please configure it in Settings.' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Step 1: Get transcript
    sendEvent({ step: 1, message: 'Fetching transcript...' });
    const { transcript, videoMeta } = await getTranscript(url, apiKey);

    if (!transcript || transcript.trim().length < 20) {
      sendEvent({ step: 'error', message: 'Could not extract a transcript from this video. The video may not have captions available.' });
      return res.end();
    }

    // Step 2: AI Analysis
    sendEvent({ step: 2, message: 'Extracting data points...' });
    const analysis = await analyzeTranscript(transcript, apiKey);

    // Step 3: Verify data points
    sendEvent({ step: 3, message: `Verifying ${analysis.dataPoints.length} statistics...` });
    const verifiedDataPoints = await verifyDataPoints(analysis.dataPoints, apiKey);

    // Step 4: Complete
    sendEvent({ step: 4, message: 'Building dashboard...' });

    const result = {
      videoMeta,
      transcript,
      analysis: {
        ...analysis,
        dataPoints: verifiedDataPoints,
      },
    };

    sendEvent({ step: 'complete', data: result });
  } catch (error) {
    console.error('Analysis error:', error);
    let message = error.message || 'An unexpected error occurred';
    if (message.includes('yt-dlp')) {
      message = 'yt-dlp error: ' + message + '. Make sure yt-dlp is installed and the URL is valid.';
    }
    if (message.includes('401') || message.includes('Incorrect API key')) {
      message = 'Invalid OpenAI API key. Please check your settings.';
    }
    if (message.includes('429') || message.includes('rate limit')) {
      message = 'OpenAI rate limit reached. Please wait a moment and try again.';
    }
    sendEvent({ step: 'error', message });
  }

  res.end();
});

module.exports = router;
