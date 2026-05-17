const OpenAI = require('openai');

const DNA_SYSTEM_PROMPT = `You are a YouTube content analyst. Analyze this video transcript and categorize it.

Return valid JSON with these exact keys:
- topic: Primary topic in 2-5 words (e.g., "Bitcoin ETF Flows", "US Debt Crisis", "Fed Rate Decision")
- thesis: The video's core argument in one sentence
- formatTags: Array of 1-3 format tags from: ["explainer", "news-recap", "deep-dive", "prediction", "debate", "interview", "tutorial", "opinion", "data-breakdown", "market-update"]
- themeTags: Array of 2-5 theme tags (e.g., ["macro", "crypto", "fed", "inflation", "geopolitics"])
- tone: One of: "urgent", "analytical", "conversational", "contrarian", "educational", "speculative"
- titleStyle: One of: "question", "statement", "number-driven", "fear-based", "opportunity", "comparison", "prediction"`;

/**
 * Analyze a single video's transcript to extract DNA (topic, thesis, format, etc.)
 * Uses gpt-4o-mini for cost efficiency (~$0.002/video).
 */
async function analyzeDNA(transcript, apiKey) {
  const openai = new OpenAI({ apiKey });

  // Truncate to ~4000 chars to keep costs low — enough for categorization
  const truncated = transcript.length > 4000
    ? transcript.slice(0, 2000) + '\n...\n' + transcript.slice(-2000)
    : transcript;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DNA_SYSTEM_PROMPT },
      { role: 'user', content: `Transcript:\n\n${truncated}` },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return {
    topic: parsed.topic || 'Unknown',
    thesis: parsed.thesis || '',
    formatTags: parsed.formatTags || [],
    themeTags: parsed.themeTags || [],
    tone: parsed.tone || 'analytical',
    titleStyle: parsed.titleStyle || 'statement',
  };
}

const SYNTHESIS_SYSTEM_PROMPT = `You are a YouTube content strategist. Given a channel's complete video catalog with performance data and content DNA, produce structured insights.

For each video you receive: title, views, likes, duration, upload date, and DNA analysis (topic, thesis, format, theme, tone, title style).

Return valid JSON with these exact keys:
- topTopics: Array of {topic, avgViews, count, trend} — top 10 topics by average views. "trend" is "rising", "stable", or "declining" based on whether recent videos in this topic outperform older ones.
- worstTopics: Array of {topic, avgViews, count} — bottom 5 topics by average views (min 2 videos each)
- titlePatterns: Array of {pattern, avgViews, examples} — title style patterns that correlate with high views. "pattern" is a description like "Questions about future events" or "Number-driven claims". "examples" are 2-3 actual titles.
- optimalDuration: {minSeconds, maxSeconds, avgViewsInRange} — the duration range that gets the most views
- formatBreakdown: Array of {format, avgViews, count} — performance by format tag
- actionableInsights: Array of 5-8 specific, actionable recommendations based on the data (e.g., "Your 'deep-dive' format averages 2.3x more views than 'news-recap' — lean into long-form analysis")`;

/**
 * Synthesize all videos' DNA + performance into aggregate insights.
 * Uses gpt-4o for nuanced cross-video reasoning.
 */
async function synthesizeInsights(videosWithDNA, apiKey) {
  const openai = new OpenAI({ apiKey });

  // Build compact summary for the prompt
  const videoSummaries = videosWithDNA
    .filter((v) => v.dnaAnalysis)
    .map((v) => {
      const dna = v.dnaAnalysis;
      return `"${v.title}" | views: ${v.viewCount} | likes: ${v.likeCount || 0} | duration: ${v.duration}s | date: ${v.uploadDate || 'unknown'} | topic: ${dna.topic} | format: ${dna.formatTags.join(',')} | themes: ${dna.themeTags.join(',')} | tone: ${dna.tone} | titleStyle: ${dna.titleStyle}`;
    })
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
      { role: 'user', content: `Channel catalog (${videosWithDNA.length} videos):\n\n${videoSummaries}` },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  // Compute viewsTrend by month (pure JS, no LLM needed)
  const monthMap = {};
  for (const v of videosWithDNA) {
    if (!v.uploadDate) continue;
    const dateStr = v.uploadDate.length === 8
      ? `${v.uploadDate.slice(0, 4)}-${v.uploadDate.slice(4, 6)}`
      : v.uploadDate.slice(0, 7);
    if (!monthMap[dateStr]) monthMap[dateStr] = { totalViews: 0, count: 0 };
    monthMap[dateStr].totalViews += v.viewCount || 0;
    monthMap[dateStr].count += 1;
  }
  const viewsTrend = Object.entries(monthMap)
    .map(([month, data]) => ({
      month,
      avgViews: Math.round(data.totalViews / data.count),
      count: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Compute overall stats
  const views = videosWithDNA.map((v) => v.viewCount || 0).sort((a, b) => a - b);
  const totalViews = views.reduce((s, v) => s + v, 0);
  const durations = videosWithDNA.map((v) => v.duration || 0);
  const overallStats = {
    totalVideos: videosWithDNA.length,
    avgViews: Math.round(totalViews / (videosWithDNA.length || 1)),
    medianViews: views.length > 0 ? views[Math.floor(views.length / 2)] : 0,
    totalViews,
    avgDuration: Math.round(durations.reduce((s, d) => s + d, 0) / (durations.length || 1)),
  };

  return {
    topTopics: parsed.topTopics || [],
    worstTopics: parsed.worstTopics || [],
    titlePatterns: parsed.titlePatterns || [],
    optimalDuration: parsed.optimalDuration || { minSeconds: 0, maxSeconds: 0, avgViewsInRange: 0 },
    formatBreakdown: parsed.formatBreakdown || [],
    viewsTrend,
    actionableInsights: parsed.actionableInsights || [],
    overallStats,
  };
}

/**
 * Build an enriched context string from DNA insights for the Show Generator.
 * Replaces the basic buildPlaylistContext when DNA data is available.
 */
function buildEnrichedPlaylistContext(dnaRecord) {
  if (!dnaRecord?.insights) return null;

  const { insights } = dnaRecord;
  const lines = [];

  lines.push(`=== SHOW DNA: Deep Channel Intelligence (${insights.overallStats?.totalVideos || 0} videos analyzed) ===`);
  lines.push(`Avg views: ${(insights.overallStats?.avgViews || 0).toLocaleString()} | Median: ${(insights.overallStats?.medianViews || 0).toLocaleString()}`);
  lines.push('');

  // Winning topics
  if (insights.topTopics?.length > 0) {
    lines.push('WINNING TOPICS (lean into these):');
    insights.topTopics.slice(0, 7).forEach((t, i) => {
      lines.push(`${i + 1}. "${t.topic}" — ${(t.avgViews || 0).toLocaleString()} avg views (${t.count} videos, ${t.trend || 'stable'})`);
    });
    lines.push('');
  }

  // Topics to avoid
  if (insights.worstTopics?.length > 0) {
    lines.push('TOPICS TO AVOID:');
    insights.worstTopics.forEach((t) => {
      lines.push(`- "${t.topic}" — ${(t.avgViews || 0).toLocaleString()} avg views (${t.count} videos)`);
    });
    lines.push('');
  }

  // Title patterns
  if (insights.titlePatterns?.length > 0) {
    lines.push('TITLE PATTERNS THAT WORK:');
    insights.titlePatterns.forEach((p) => {
      const examples = (p.examples || []).slice(0, 2).map((e) => `"${e}"`).join(', ');
      lines.push(`- ${p.pattern}: ${(p.avgViews || 0).toLocaleString()} avg views${examples ? ` (e.g., ${examples})` : ''}`);
    });
    lines.push('');
  }

  // Optimal duration
  if (insights.optimalDuration?.maxSeconds > 0) {
    const min = Math.round(insights.optimalDuration.minSeconds / 60);
    const max = Math.round(insights.optimalDuration.maxSeconds / 60);
    lines.push(`OPTIMAL DURATION: ${min}-${max} minutes (${(insights.optimalDuration.avgViewsInRange || 0).toLocaleString()} avg views in range)`);
    lines.push('');
  }

  // Key insights
  if (insights.actionableInsights?.length > 0) {
    lines.push('KEY INSIGHTS:');
    insights.actionableInsights.slice(0, 5).forEach((insight, i) => {
      lines.push(`${i + 1}. ${insight}`);
    });
  }

  return lines.join('\n');
}

module.exports = { analyzeDNA, synthesizeInsights, buildEnrichedPlaylistContext };
