const OpenAI = require('openai');

async function verifySingleDataPoint(dataPoint, apiKey) {
  const openai = new OpenAI({ apiKey });
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Today's date is ${today}.

Verify this specific claim: "${dataPoint.claim}"
Category: ${dataPoint.category}
Time period referenced: ${dataPoint.period || 'not specified'}
Context: ${dataPoint.context || 'none'}

IMPORTANT: You MUST use web search to find the most current, real data. Do NOT rely on training data alone. Search for official sources, financial reports, government data, and reputable news outlets.

Search strategies to try:
- Search for the exact metric + company/entity + year
- Search for official filings, earnings reports, press releases
- Search financial data sites (e.g. macrotrends, statista, official .gov sites)
- If the claim references "this year", that means ${new Date().getFullYear()}

After searching, respond with ONLY a valid JSON object (no markdown, no code fences) with these fields:
{
  "verified": "true" or "false" or "partial",
  "actual_value": "the real value you found from sources (or 'unknown' if not found)",
  "source_name": "name of the official source",
  "source_url": "URL to the source",
  "verification_note": "brief explanation — what you found and how it compares to the claim",
  "matches_claim": true or false,
  "chart_data": [{"period": "Q1 2024", "value": 123}, ...] or null
}

If the claim is approximately correct (within 10-15%), mark as "partial" not "false".
If you find the data and it matches, mark "true".
Only mark "false" if the data clearly contradicts the claim OR you truly cannot find any supporting evidence after thorough searching.`;

  // Method 1: Responses API with web search (preferred)
  try {
    console.log(`  [verify] Searching web for: "${dataPoint.claim.substring(0, 60)}..."`);
    const response = await openai.responses.create({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    });

    const text = response.output_text;
    const parsed = extractJSON(text);
    if (parsed) {
      console.log(`  [verify] Web search result: ${parsed.verified}`);
      return formatVerification(parsed, dataPoint);
    }
  } catch (e) {
    console.log(`  [verify] Responses API failed: ${e.message}`);
  }

  // Method 2: Chat completions with strong search-oriented prompt
  try {
    console.log(`  [verify] Falling back to chat completions for: "${dataPoint.claim.substring(0, 60)}..."`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a financial fact-checker. Today is ${today}. Verify claims using your most up-to-date knowledge. When a claim says "this year" it means ${new Date().getFullYear()}. Be generous with "partial" — if the claim is directionally correct or in the right ballpark, use "partial" rather than "false". Only use "false" if you are confident the claim is wrong or you truly have zero information. Return valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    const parsed = extractJSON(content);
    if (parsed) {
      console.log(`  [verify] Chat completions result: ${parsed.verified}`);
      return formatVerification(parsed, dataPoint);
    }
  } catch (fallbackError) {
    console.log(`  [verify] Chat completions also failed: ${fallbackError.message}`);
  }

  return {
    ...dataPoint,
    verification: {
      verified: 'false',
      actualValue: dataPoint.value,
      sourceName: 'Verification failed',
      sourceUrl: '',
      verificationNote: 'Both verification methods failed. Please check your API key and try again.',
      matchesClaim: false,
      chartData: null,
    },
  };
}

function extractJSON(text) {
  if (!text) return null;

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // ignore
  }

  // Try to find JSON in code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // ignore
    }
  }

  // Try to find JSON object in text
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

function formatVerification(parsed, dataPoint) {
  const verified = String(parsed.verified || 'false').toLowerCase();
  return {
    ...dataPoint,
    verification: {
      verified: verified === 'true' ? 'true' : verified === 'partial' ? 'partial' : 'false',
      actualValue: parsed.actual_value || dataPoint.value,
      sourceName: parsed.source_name || 'Unknown',
      sourceUrl: parsed.source_url || '',
      verificationNote: parsed.verification_note || '',
      matchesClaim: parsed.matches_claim === true || parsed.matches_claim === 'true',
      chartData: Array.isArray(parsed.chart_data) ? parsed.chart_data : null,
    },
  };
}

async function verifyDataPoints(dataPoints, apiKey) {
  // Process in batches of 3 to avoid rate limits
  const batchSize = 3;
  const results = [];

  for (let i = 0; i < dataPoints.length; i += batchSize) {
    const batch = dataPoints.slice(i, i + batchSize);
    console.log(`  [verify] Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(dataPoints.length / batchSize)}...`);
    const batchResults = await Promise.all(
      batch.map((dp) => verifySingleDataPoint(dp, apiKey))
    );
    results.push(...batchResults);
  }

  return results;
}

module.exports = { verifyDataPoints };
