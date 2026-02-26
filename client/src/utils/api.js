/**
 * Shared fetch wrapper that attaches the X-API-Key header.
 * Use this for all API calls to the backend.
 */
export function apiFetch(url, options = {}) {
  const apiKey = localStorage.getItem('videointel_openai_key') || '';
  const headers = {
    ...options.headers,
    'X-API-Key': apiKey,
  };
  return fetch(url, { ...options, headers });
}

/**
 * Builds a condensed library context string from all analyzed videos.
 * This gives the AI "memory" of everything the user has analyzed.
 */
export function buildLibraryContext(videos) {
  if (!videos || videos.length === 0) return null;

  const summaries = videos.map((v) => {
    const tags = (v.analysis?.topicTags || []).join(', ');
    const topPoints = (v.analysis?.dataPoints || [])
      .filter((dp) => dp.verification?.verified === 'true' || dp.verification?.verified === 'partial')
      .slice(0, 5)
      .map((dp) => `  - ${dp.claim} [${dp.verification?.verified}]`)
      .join('\n');
    return `"${v.videoMeta?.title}" (${v.videoMeta?.channel}, ${v.videoMeta?.publishDate || 'unknown date'})
Summary: ${v.analysis?.oneLine || 'N/A'}
Tags: ${tags}
Key verified data:
${topPoints || '  (none)'}`;
  });

  return `=== LIBRARY: ${videos.length} previously analyzed videos ===\n\n${summaries.join('\n\n---\n\n')}`;
}
