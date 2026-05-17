const express = require('express');
const router = express.Router();
const { getTranscript } = require('../utils/transcript');
const { getPlaylistPerformance } = require('../utils/playlist');
const { analyzeDNA, synthesizeInsights } = require('../utils/dna');

router.post('/playlist-dna', async (req, res) => {
  const apiKey = req.apiKey;
  const { playlistUrl, alreadyAnalyzedIds } = req.body;

  if (!playlistUrl) {
    return res.status(400).json({ error: 'Playlist URL is required' });
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

  const skipSet = new Set(alreadyAnalyzedIds || []);

  try {
    // Phase 1: Fetch playlist metadata
    sendEvent({ phase: 'fetching', message: 'Fetching playlist metadata...' });
    const videos = getPlaylistPerformance(playlistUrl);
    sendEvent({ phase: 'fetched', totalVideos: videos.length, message: `Found ${videos.length} videos` });

    // Phase 2: Per-video DNA analysis
    const analyzedResults = [];
    const toAnalyze = videos.filter((v) => v.id && !skipSet.has(v.id));

    sendEvent({
      phase: 'analyzing',
      total: videos.length,
      toAnalyze: toAnalyze.length,
      skipped: videos.length - toAnalyze.length,
      message: `Analyzing ${toAnalyze.length} new videos (${videos.length - toAnalyze.length} cached)`,
    });

    for (let i = 0; i < toAnalyze.length; i++) {
      const video = toAnalyze[i];
      sendEvent({
        phase: 'analyzing-video',
        current: i + 1,
        total: toAnalyze.length,
        videoTitle: video.title,
        message: `Analyzing: ${video.title}`,
      });

      try {
        const videoUrl = video.url || `https://youtube.com/watch?v=${video.id}`;
        const { transcript } = await getTranscript(videoUrl, apiKey);

        if (transcript && transcript.trim().length > 50) {
          const dna = await analyzeDNA(transcript, apiKey);
          analyzedResults.push({
            videoId: video.id,
            dnaAnalysis: dna,
          });
          sendEvent({
            phase: 'video-complete',
            current: i + 1,
            total: toAnalyze.length,
            videoId: video.id,
            videoTitle: video.title,
            dnaAnalysis: dna,
          });
        } else {
          sendEvent({
            phase: 'video-skipped',
            current: i + 1,
            total: toAnalyze.length,
            videoId: video.id,
            videoTitle: video.title,
            reason: 'No transcript available',
          });
        }
      } catch (err) {
        console.error(`DNA analysis failed for ${video.title}:`, err.message);
        sendEvent({
          phase: 'video-error',
          current: i + 1,
          total: toAnalyze.length,
          videoId: video.id,
          videoTitle: video.title,
          error: err.message,
        });
      }
    }

    // Send completion with all data
    sendEvent({
      phase: 'complete',
      analyzedResults,
      videos: videos.map((v) => ({
        videoId: v.id,
        title: v.title,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        duration: v.duration,
        uploadDate: v.uploadDate,
        url: v.url,
      })),
    });
  } catch (error) {
    console.error('Playlist DNA error:', error);
    let message = error.message || 'An unexpected error occurred';
    if (message.includes('yt-dlp')) {
      message = 'yt-dlp error: ' + message + '. Make sure yt-dlp is installed and the playlist URL is valid.';
    }
    sendEvent({ phase: 'error', message });
  }

  res.end();
});

router.post('/playlist-dna/synthesize', async (req, res) => {
  const apiKey = req.apiKey;
  const { videosWithDNA } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'OpenAI API key not set.' });
  }
  if (!videosWithDNA || !Array.isArray(videosWithDNA) || videosWithDNA.length === 0) {
    return res.status(400).json({ error: 'Videos with DNA data are required.' });
  }

  try {
    const insights = await synthesizeInsights(videosWithDNA, apiKey);
    res.json({ insights });
  } catch (error) {
    console.error('Synthesis error:', error);
    let message = error.message || 'Failed to synthesize insights';
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
