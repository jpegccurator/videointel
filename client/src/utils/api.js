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

/**
 * Builds a learning context string from past show outcomes and editorial decisions.
 * Capped at ~1200 tokens to fit easily alongside the main prompt.
 */
export function buildLearningContext(outcomes, decisions) {
  if ((!outcomes || outcomes.length === 0) && (!decisions || decisions.length === 0)) {
    return null;
  }

  const sections = [];

  // Section 1: Top performing shows (by views)
  const performingShows = (outcomes || [])
    .filter((o) => o.performance && o.performance.viewCount > 0)
    .sort((a, b) => (b.performance.viewCount || 0) - (a.performance.viewCount || 0))
    .slice(0, 10);

  if (performingShows.length > 0) {
    const lines = performingShows.map((o, i) => {
      const p = o.performance;
      const title = o.finalContent?.title || o.concept?.title || 'Untitled';
      return `${i + 1}. "${title}" - ${p.viewCount.toLocaleString()} views, ${p.likeCount.toLocaleString()} likes`;
    });
    sections.push(`=== TOP PERFORMING SHOWS ===\n${lines.join('\n')}`);
  }

  // Section 2: Editorial patterns
  if (decisions && decisions.length > 0) {
    const totalDecisions = decisions.length;
    const titleEdits = decisions.filter((d) => d.titleEdited).length;
    const synopsisEdits = decisions.filter((d) => d.synopsisEdited).length;
    const avgRegens = decisions.reduce((sum, d) => sum + (d.totalRegenerations || 0), 0) / totalDecisions;
    const decisionsWithDp = decisions.filter((d) => d.dataPointsOffered > 0);
    const avgDpKeptRate = decisionsWithDp.length > 0
      ? decisionsWithDp.reduce((sum, d) => sum + (d.dataPointsKept / d.dataPointsOffered), 0) / decisionsWithDp.length
      : 0;

    const patternLines = [
      `Shows saved: ${totalDecisions}`,
      `Title edit rate: ${Math.round((titleEdits / totalDecisions) * 100)}% (user changes AI titles ${titleEdits} of ${totalDecisions} times)`,
      `Synopsis edit rate: ${Math.round((synopsisEdits / totalDecisions) * 100)}%`,
      `Avg regenerations per show: ${avgRegens.toFixed(1)}`,
      `Avg data point keep rate: ${Math.round(avgDpKeptRate * 100)}%`,
    ];

    // Show recent title edits to reveal direction
    const recentTitleEdits = decisions
      .filter((d) => d.titleEdited && d.titleOriginal && d.titleFinal)
      .slice(-5);

    if (recentTitleEdits.length > 0) {
      patternLines.push('', 'Recent title edits (AI -> User):');
      recentTitleEdits.forEach((d) => {
        patternLines.push(`  "${d.titleOriginal}" -> "${d.titleFinal}"`);
      });
    }

    sections.push(`=== EDITORIAL PATTERNS ===\n${patternLines.join('\n')}`);
  }

  // Section 3: Recent drafts (no performance data yet)
  const recentDrafts = (outcomes || [])
    .filter((o) => o.status === 'draft')
    .slice(0, 5);

  if (recentDrafts.length > 0) {
    const draftLines = recentDrafts.map((o) => {
      const title = o.finalContent?.title || o.concept?.title || 'Untitled';
      return `- "${title}" (${new Date(o.createdAt).toLocaleDateString()})`;
    });
    sections.push(`=== RECENT DRAFTS (avoid repeating these topics) ===\n${draftLines.join('\n')}`);
  }

  if (sections.length === 0) return null;

  return sections.join('\n\n');
}
