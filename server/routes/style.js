const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const { getTranscript } = require('../utils/transcript');
const OpenAI = require('openai');

// Analyze a channel or playlist to extract style
router.post('/analyze-style', async (req, res) => {
  const { url } = req.body;
  const apiKey = req.apiKey;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!apiKey) return res.status(400).json({ error: 'OpenAI API key not set.' });

  // SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    send({ step: 1, message: 'Fetching video list from channel/playlist...' });

    let videoUrls = [];
    try {
      const listJson = execSync(
        `yt-dlp --flat-playlist --dump-json "${url}" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
      );
      const lines = listJson.trim().split('\n');
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const vid = entry.id || entry.url;
          if (vid) videoUrls.push(`https://www.youtube.com/watch?v=${vid}`);
        } catch { /* skip */ }
      }
    } catch {
      try {
        const listJson = execSync(
          `yt-dlp --flat-playlist --dump-json "${url}/videos" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
        );
        const lines = listJson.trim().split('\n');
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const vid = entry.id || entry.url;
            if (vid) videoUrls.push(`https://www.youtube.com/watch?v=${vid}`);
          } catch { /* skip */ }
        }
      } catch {
        send({ step: 'error', message: 'Could not fetch videos from this URL. Try a direct channel or playlist link.' });
        return res.end();
      }
    }

    if (videoUrls.length === 0) {
      send({ step: 'error', message: 'No videos found at this URL.' });
      return res.end();
    }

    const sampleSize = Math.min(8, videoUrls.length);
    const step = Math.max(1, Math.floor(videoUrls.length / sampleSize));
    const sampled = [];
    for (let i = 0; i < videoUrls.length && sampled.length < sampleSize; i += step) {
      sampled.push(videoUrls[i]);
    }

    send({ step: 2, message: `Found ${videoUrls.length} videos. Sampling ${sampled.length} for style analysis...` });

    const videoData = [];
    for (let i = 0; i < sampled.length; i++) {
      send({ step: 2, message: `Transcribing video ${i + 1} of ${sampled.length}...` });
      try {
        const { transcript, videoMeta } = await getTranscript(sampled[i], apiKey);
        if (transcript && transcript.length > 100) {
          videoData.push({
            title: videoMeta.title,
            channel: videoMeta.channel,
            transcript: transcript.substring(0, 3000),
          });
        }
      } catch (e) {
        console.log(`  [style] Skipped video: ${e.message}`);
      }
    }

    if (videoData.length < 2) {
      send({ step: 'error', message: 'Could not get enough transcripts. Try a different channel or playlist.' });
      return res.end();
    }

    send({ step: 3, message: `Analyzing style from ${videoData.length} videos...` });

    const openai = new OpenAI({ apiKey });

    const videoText = videoData.map((v, i) =>
      `=== VIDEO ${i + 1}: "${v.title}" ===\n${v.transcript}`
    ).join('\n\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing YouTube videos to extract a comprehensive style profile for a content creator. Study the transcripts carefully and produce a detailed style guide that could be used to generate new show concepts matching this creator's exact voice, structure, and approach.

Cover ALL of the following:

1. TITLE PATTERNS: How do they structure titles? What formulas, hooks, patterns?
2. OPENING HOOKS: How do they start videos? What's the structure of their first 30-60 seconds?
3. NARRATIVE STRUCTURE: How do they build arguments? What's the episode flow?
4. VOICE & TONE: Formal vs casual? Key phrases? Personality traits?
5. DATA PRESENTATION: How do they introduce numbers and statistics?
6. TOPIC PATTERNS: What subjects do they gravitate toward? What's their lens?
7. CONTRARIAN/UNIQUE POSITIONING: How do they differentiate from others?
8. THUMBNAIL STYLE: Based on titles, what would their ideal thumbnails look like?
9. WHAT THEY NEVER DO: Anti-patterns to avoid

Write the style guide as a system prompt that could be given to an AI to generate show concepts in this creator's voice. Be specific and actionable, not vague.`
        },
        {
          role: 'user',
          content: `Channel: ${videoData[0].channel}\n\nHere are ${videoData.length} video transcripts to analyze:\n\n${videoText}`
        },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const styleProfile = response.choices[0].message.content;
    send({ step: 'complete', data: { styleProfile, channel: videoData[0].channel, videoCount: videoData.length } });
  } catch (error) {
    console.error('Style analysis error:', error);
    send({ step: 'error', message: error.message || 'Style analysis failed' });
  }

  res.end();
});

// AI cowork: ask next question or generate final prompt
router.post('/build-prompt', async (req, res) => {
  const apiKey = req.apiKey;
  if (!apiKey) return res.status(400).json({ error: 'OpenAI API key not set.' });

  const { answers, skipQuestions } = req.body;
  const openai = new OpenAI({ apiKey });

  if (skipQuestions && answers.rawPrompt) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Take the user's rough prompt/description and transform it into a polished, comprehensive system prompt for an AI show generator. Keep their voice and intent intact but make it structured, specific, and actionable. Return JSON: { "prompt": "the full system prompt" }`
          },
          { role: 'user', content: answers.rawPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      });
      const parsed = JSON.parse(response.choices[0].message.content);
      return res.json({ done: true, prompt: parsed.prompt });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const questions = [
    { id: 'channel_about', question: "What's your channel about? What topics do you typically cover?", context: 'This helps me understand your content universe.' },
    { id: 'tone', question: "How would you describe your tone? Are you casual, formal, educational, provocative, calm? Give me examples of how you'd naturally explain something.", context: 'I need to nail your voice.' },
    { id: 'structure', question: "Walk me through how you typically structure an episode. How do you open? How do you build your argument? How do you close?", context: 'This is the DNA of your show.' },
    { id: 'differentiator', question: "What makes your content different from others in your space? What's your unique angle or approach that viewers come back for?", context: 'This is your edge.' },
    { id: 'audience', question: "Who's your target viewer? What do they already know? What do they want to learn?", context: 'Knowing the audience shapes everything.' },
    { id: 'data_style', question: "How do you use data and evidence? Do you lean heavily on charts and numbers, or more on narrative and frameworks? How do you introduce a statistic?", context: 'Data presentation is a huge part of credibility.' },
    { id: 'never_do', question: "What should the AI NEVER do when generating show concepts for you? Any pet peeves, things that feel off-brand, or content types you'd never make?", context: 'Anti-patterns are just as important as patterns.' },
  ];

  const answeredIds = Object.keys(answers || {});
  const nextQuestion = questions.find(q => !answeredIds.includes(q.id));

  if (nextQuestion) {
    return res.json({
      done: false,
      questionId: nextQuestion.id,
      question: nextQuestion.question,
      context: nextQuestion.context,
      progress: `${answeredIds.length + 1} of ${questions.length}`,
    });
  }

  try {
    const answersText = questions.map(q => `Q: ${q.question}\nA: ${answers[q.id]}`).join('\n\n');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Based on the creator's answers below, generate a comprehensive system prompt for an AI YouTube show generator. The prompt should capture their exact voice, tone, personality, title formulas, show structure, data presentation style, topic scope, thumbnail style, and anti-patterns. Make it detailed, specific, and actionable. Write it as a system prompt that starts with "You are generating YouTube show concepts for..." Return ONLY the prompt text.`
        },
        { role: 'user', content: answersText },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });
    return res.json({ done: true, prompt: response.choices[0].message.content });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
