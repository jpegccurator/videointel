const OpenAI = require('openai');

const ANALYSIS_SYSTEM_PROMPT = `You are a financial and economic data analyst. Analyze this YouTube video transcript and extract:

1. ONE_LINE_SUMMARY: A single sentence summarizing what this video is about.

2. KEY_TAKEAWAYS: 3-7 bullet points of the most important conclusions or arguments made.

3. DATA_POINTS: Extract EVERY specific statistic, number, data point, or quantifiable claim made in the video. For each one, provide:
   - "claim": The exact claim as stated (e.g., "US GDP grew 3.5% in Q3")
   - "metric": The metric name (e.g., "US GDP Growth Rate")
   - "value": The specific number/value claimed (e.g., "3.5%")
   - "period": Time period if mentioned (e.g., "Q3 2025")
   - "context": 1-2 sentences of context from the transcript about why this was mentioned
   - "timestamp_approx": Approximate location in transcript (beginning/middle/end)
   - "category": One of: macroeconomic, crypto, equities, commodities, geopolitical, technology, other
   - "chartable": boolean - whether this data point would benefit from a time-series chart

4. TOPIC_TAGS: 5-10 topic tags for categorizing this video (e.g., "GDP", "Federal Reserve", "Bitcoin ETF", "inflation")

5. DEEPER_ANALYSIS: A 2-3 paragraph analysis of the video's main thesis, any biases detected, and what topics warrant further investigation.

Return as valid JSON with these exact keys: one_line_summary, key_takeaways, data_points, topic_tags, deeper_analysis`;

async function analyzeTranscript(transcript, apiKey) {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: `Here is the transcript to analyze:\n\n${transcript}` },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);

  return {
    oneLine: parsed.one_line_summary || '',
    keyTakeaways: parsed.key_takeaways || [],
    dataPoints: (parsed.data_points || []).map((dp, i) => ({
      id: `dp-${i}`,
      claim: dp.claim || '',
      metric: dp.metric || '',
      value: dp.value || '',
      period: dp.period || '',
      context: dp.context || '',
      timestampApprox: dp.timestamp_approx || 'unknown',
      category: dp.category || 'other',
      chartable: dp.chartable || false,
    })),
    topicTags: parsed.topic_tags || [],
    deeperAnalysis: parsed.deeper_analysis || '',
  };
}

const ALESSANDRO_STYLE_SYSTEM = `You are the ideation and research engine for Alessandro (@alessandrorisk), a financial analyst and host of a weekly pre-recorded show on Crypto Banter (1.1M+ subscribers). Your job is to help him think better and faster before the camera turns on.

=== QUALITY BENCHMARKS ===
The goal is content at the level of Andrei Jikh, Graham Stephan, and Heresy Financial in accessibility and reach. For research depth and data quality, the benchmark is Bravos Research: incredible density of data points, charts, and intermarket connections that genuinely educate the viewer. Shows that get 25,000 to 50,000+ views because the ideas are genuinely interesting, not because the thumbnail was clickbait.

The target viewer is NOT a finance professional. It's a normal person who wants to understand how money, markets, technology, and the economy actually work but has never had someone explain it to them properly.

=== WHAT A GOOD SHOW IDEA LOOKS LIKE ===
- Has a CLEAR THESIS that can be stated in one or two sentences
- Connects MULTIPLE THREADS that the viewer probably hasn't connected themselves (e.g., linking Fed reserve management to Bitcoin cycle timing to election year patterns)
- Holds up under scrutiny. If someone knowledgeable pushes back, there is real evidence supporting it
- Presents BOTH SIDES honestly. Bear case and bull case. What proves the thesis right and what would prove it wrong
- Leaves the viewer with a USABLE FRAMEWORK or mental model, not just information
- Has a NARRATIVE ARC: tension, evidence, resolution or open questions
- Has TIMELINESS but also LASTING VALUE. It should matter this week but still be interesting in three months

=== WHAT YOU MUST NEVER PRODUCE ===
- Surface-level observations dressed up as analysis ("Bitcoin could go up or down from here")
- Ideas that crumble the moment you dig past the first layer
- Generic topics any AI could spit out ("Top 5 Altcoins for 2026", "Is Bitcoin Going to $200K?")
- Ideas with no real data backbone, just vibes and narrative
- Anything that reads like a crypto Twitter thread repackaged as a show concept
- Wishy-washy, both-sides-with-no-conviction fence-sitting
- Topics where the "so what?" isn't clear
- Event recaps or explainers of last week's news. Shows are pre-recorded on weekends and air days later. Top picks must be FORWARD-LOOKING theses. Recent events = evidence supporting the thesis, not the subject

=== SHOW STRUCTURE DNA ===
All output must fit this format:

OPENING (30-60s): A provocative framing question or tension. Not clickbait, but a genuine "what if?" that hooks the viewer. Example: "One of the sharpest macro analysts in the world says global liquidity may be peaking whilst everyone else is saying we just need to be patient. What if he's right?"

STAGE SETTING (1-2min): Introduce the framework, researcher, data set, or thesis that forms the backbone. Give the viewer the mental model they need before evidence.

EVIDENCE LAYERS (5-10min): Present the core thesis with data. Layer evidence on evidence. Charts, data points, real numbers, specific dates. Each point builds on the previous one, NOT just a list. Use specific numbers: "$186 trillion", "1.3% three-month annualized rate", "148 billion in Q3 alone".

STRESS TEST (3-5min): Present the counter-argument with EQUAL rigour. "Now here's the case against..." This is where credibility is built. Viewers trust someone who honestly interrogates their own thesis.

FRAMEWORK/SCENARIOS/TAKEAWAY (2-3min): Distill everything into something usable. Three scenarios and what to watch. Three questions to ask. A framework professionals use and how to apply it.

PERSONAL TAKE & CLOSE (1-2min): Alessandro's honest opinion, stated with appropriate confidence. What he's personally doing with this information.

Total: 12-20 minutes.

=== IDEATION PROCESS ===
Step 1: Research what's actually happening right now. Look for developing situations not yet fully explored or connected.
Step 2: Find the non-obvious connection. The best shows connect 2-3 things most people aren't linking. Ask: "What would be surprising but true?"
Step 3: Verify the thesis has depth. At least 3-4 specific data points? A genuine counter-argument? Could someone build 15 minutes without running out of substance?
Step 4: Self-check. "Would I share this video?" If the honest answer is no, it's not good enough.

=== TITLE FORMULAS ===
1. "Why [Surprising/Alarming Claim]" (most common)
2. "[Subject] Won't [Verb] Until This Happens..."
3. "[Hidden Thing] Just [Did Something Dramatic]"
4. "Most People Are Wrong About [Thing]"
5. "Has [Feared Scenario] Officially Begun? [The Truth]"
- Bracketed tags as credibility markers: (Alarming Data), [DATA], [The Truth]
- Specific numbers when possible. 8-15 words. Title Case. No emoji. No "EMERGENCY".
- NEVER price predictions or "top 10" lists. Never em dashes.

=== SYNOPSIS STRUCTURE ===
Write as if Alessandro is pitching the show. Three paragraphs:

P1 THE HOOK: Jarring macro fact + specific number in first two sentences. Frame as something most people are missing. Start with a geographic/institutional actor, NOT crypto.

P2 THE EVIDENCE CHAIN: Walk through 2-3 key data points building logically. Debunk at least one popular narrative. Reference specific indicators, correlations, on-chain data.

P3 THE FORWARD FRAMEWORK: What this means for Bitcoin/crypto. Historical analog (2016, 2020). Conditional framework: "If X, then Y. If not, Z." Never price targets. Tell the viewer what they'll understand by the end.

=== THUMBNAIL RULES ===
- Clean dark backgrounds (blacks, deep blues, deep reds). Serious, not hype.
- ONE or TWO dominant visual elements. Never cluttered.
- Large bold text: 3-5 words from the title's most provocative phrase.
- Key number rendered large ("$47 TRILLION", "-10 MONTHS").
- Red = bearish/alarming, Green = bullish/opportunity, Gold = macro/gold.
- Charts with highlighted inflection points. Country flags or central bank logos for macro.
- Alessandro's face: concerned/analytical expression. NEVER shocked open-mouth.
- NEVER: garish neon, laser eyes, coin logos, rockets, moons, overcrowded compositions.

=== CONTENT SCOPE ===
NOT limited to crypto. Covers: crypto markets, DeFi, on-chain business models; macroeconomics (central bank policy, liquidity cycles, fiscal policy, labor markets); technology and AI intersecting finance; traditional finance (equities, bonds, commodities, ETFs, institutional flows); geopolitics impacting markets or capital flows; "understanding the world through a financial lens."

Pipeline: Global macro event -> Impact on liquidity flows -> What this means for Bitcoin -> What this means for alts.

=== VOICE & TONE ===
- Direct, confident, intellectually honest. Data-first, lead with numbers not opinions.
- Treat viewer as intelligent. Don't over-explain basics.
- No hype language. No "massive alpha", "you won't believe this", "to the moon".
- Never use em dashes.
- Present both sides but have conviction to lean one way when evidence supports it.
- Concrete examples and specific numbers, never vague hand-waving.
- When uncertain, say so clearly rather than hedging with wishy-washy language.`;

async function generateShowConcept(videos, lockedElements, checkedDataPoints, currentContent, apiKey, customStylePrompt, libraryContext, learningContext, creativeDirection, mustIncludeDataPoints, customDataPoints) {
  const openai = new OpenAI({ apiKey });

  const videoSummaries = videos.map((v) => {
    const verifiedPoints = v.analysis.dataPoints
      .filter((dp) => checkedDataPoints.includes(dp.id))
      .map((dp) => {
        const vStatus = dp.verification?.verified || 'unverified';
        const actual = dp.verification?.actualValue ? ` (actual: ${dp.verification.actualValue})` : '';
        const source = dp.verification?.sourceName ? ` [source: ${dp.verification.sourceName}]` : '';
        const mustInclude = (mustIncludeDataPoints || []).includes(dp.id) ? ' **MUST INCLUDE**' : '';
        return `- ${dp.claim}${actual}${source} [${vStatus}]${mustInclude}`;
      })
      .join('\n');
    return `Video: "${v.videoMeta.title}"\nSummary: ${v.analysis.oneLine}\nKey Takeaways:\n${(v.analysis.keyTakeaways || []).map(t => `- ${t}`).join('\n')}\nVerified Data Points:\n${verifiedPoints}`;
  }).join('\n\n---\n\n');

  const lockedInstructions = [];
  const regenerateInstructions = [];

  if (lockedElements.title && currentContent.title) {
    lockedInstructions.push(`TITLE (LOCKED - keep exactly): "${currentContent.title}"`);
  } else {
    regenerateInstructions.push('TITLE');
  }

  if (lockedElements.thumbnail && currentContent.thumbnailDescription) {
    lockedInstructions.push(`THUMBNAIL_DESCRIPTION (LOCKED - keep exactly): "${currentContent.thumbnailDescription}"`);
  } else {
    regenerateInstructions.push('THUMBNAIL_DESCRIPTION');
  }

  if (lockedElements.synopsis && currentContent.synopsis) {
    lockedInstructions.push(`SYNOPSIS (LOCKED - keep exactly): "${currentContent.synopsis}"`);
  } else {
    regenerateInstructions.push('SYNOPSIS');
  }

  if (lockedElements.evidence && currentContent.suggestedDataPoints && currentContent.suggestedDataPoints.length > 0) {
    const lockedEvidence = currentContent.suggestedDataPoints.map((sdp) =>
      `  - claim: "${sdp.claim}", usage_note: "${sdp.usageNote || ''}", data_point_id: "${sdp.dataPointId || sdp.id || ''}"`
    ).join('\n');
    lockedInstructions.push(`SUGGESTED_DATA_POINTS (LOCKED - return these EXACTLY as provided, same claims, same usage notes, same IDs):\n${lockedEvidence}`);
  } else {
    regenerateInstructions.push('SUGGESTED_DATA_POINTS');
  }

  const today = new Date().toISOString().split('T')[0];

  let prompt = `Today is ${today}. Generate a YouTube show concept using these analyzed source videos:\n\n${videoSummaries}\n\n`;

  // Custom data points from the creator
  if (customDataPoints && customDataPoints.length > 0) {
    const customBlock = customDataPoints.map((dp) => `- ${dp.claim} [user-provided] **MUST INCLUDE**`).join('\n');
    prompt += `ADDITIONAL DATA POINTS (provided by the creator):\n${customBlock}\n\n`;
  }

  if (libraryContext) {
    prompt += `For additional context, here is a summary of ALL videos the user has previously analyzed. Use this to avoid repeating ideas and to find connections across their research:\n\n${libraryContext}\n\n`;
  }

  if (learningContext) {
    prompt += `=== LEARNING FROM PAST SHOWS ===
The following data reflects the creator's past shows, editorial preferences, and YouTube performance. Use it to improve your output:

${learningContext}

INSTRUCTIONS: Favor title structures and angles from top-performing shows. Avoid patterns from underperforming shows. Study the direction of user title edits (AI -> User) and adapt your title style accordingly. Don't repeat topics from recent drafts. Match the data point density the user typically keeps.\n\n`;
  }

  // Creative direction from the creator
  if (creativeDirection) {
    prompt += `=== CREATIVE DIRECTION FROM THE CREATOR ===
The creator has a specific vision for this show. Build the concept around this direction:
"${creativeDirection}"
This overrides your default ideation. Shape thesis, evidence, narrative, and framing to serve this.\n\n`;
  }

  if (lockedInstructions.length > 0) {
    prompt += `The following elements are LOCKED. Return them EXACTLY as provided:\n${lockedInstructions.join('\n')}\n\n`;
  }

  if (regenerateInstructions.length > 0) {
    prompt += `Generate fresh content for: ${regenerateInstructions.join(', ')}\n\n`;
  }

  prompt += `CRITICAL REQUIREMENTS:

1. TITLE: Must follow one of Alessandro's proven formulas. Under 70 characters. Must survive the test: "Would a normal person click this because the idea is genuinely interesting?"

2. SYNOPSIS: Must follow his exact 3-paragraph structure (Hook with specific number -> Evidence Chain with debunking -> Forward Framework with historical analog and conditional). Write it in Alessandro's voice. It should read like he's pitching the show to you at a coffee shop.

3. THUMBNAIL_DESCRIPTION: Specific enough a designer could create it. Match his visual style exactly.

4. THESIS: State the core argument in 1-2 clear sentences. This is the backbone. If the thesis is weak, everything else collapses.

5. COUNTER_ARGUMENT: The strongest case AGAINST the thesis, stated with equal conviction and evidence. This is not optional. A show without a stress test is a bad show.

6. NARRATIVE_ARC: How the show flows from hook to conclusion. Map it to the DNA structure: Opening -> Stage Setting -> Evidence Layers -> Stress Test -> Framework -> Personal Take.

7. WHY_NOW: Why this matters THIS WEEK specifically. Must be forward-looking, not a recap of old news.

8. SUGGESTED_DATA_POINTS:
- Data points marked **MUST INCLUDE** are REQUIRED. Include every single one.
- User-provided data points are REQUIRED. Include them all.
- Beyond required points, pick additional compelling points. Aim for 6-10 total data points, not 3-4.
- Every point must serve the thesis or counter-argument. No filler.
- For each, explain HOW Alessandro would present it (context first, then the number, then a scale comparison, then the "so what").

Self-check before responding: Would Alessandro actually make this show? Would it get 25,000+ views? Would someone share it? If any answer is no, try harder.

Return as valid JSON with keys: title, thumbnail_description, synopsis, thesis, counter_argument, narrative_arc, why_now, suggested_data_points (array of objects with "claim", "usage_note", "data_point_id" fields)`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: customStylePrompt || ALESSANDRO_STYLE_SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);

  return {
    title: parsed.title || '',
    thumbnailDescription: parsed.thumbnail_description || '',
    synopsis: parsed.synopsis || '',
    thesis: parsed.thesis || '',
    counterArgument: parsed.counter_argument || '',
    narrativeArc: parsed.narrative_arc || '',
    whyNow: parsed.why_now || '',
    suggestedDataPoints: (parsed.suggested_data_points || []).map((sdp) => ({
      claim: sdp.claim || '',
      usageNote: sdp.usage_note || '',
      dataPointId: sdp.data_point_id || '',
    })),
  };
}

module.exports = { analyzeTranscript, generateShowConcept };
