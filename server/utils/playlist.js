const { execSync } = require('child_process');

/**
 * Fetch all videos from a YouTube playlist using yt-dlp.
 * Returns title, view_count, like_count, upload_date, duration, url for each video.
 * No API key needed - uses public data.
 */
function getPlaylistPerformance(playlistUrl) {
  const raw = execSync(
    `yt-dlp --flat-playlist --dump-json "${playlistUrl}"`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
  );

  const videos = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        const data = JSON.parse(line);
        return {
          id: data.id || null,
          title: data.title || 'Untitled',
          viewCount: data.view_count || 0,
          likeCount: data.like_count || 0,
          duration: data.duration || 0,
          uploadDate: data.upload_date || null,
          url: data.url || (data.id ? `https://youtube.com/watch?v=${data.id}` : null),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return videos;
}

/**
 * Build a performance context string from playlist data.
 * Ranks videos by views, identifies patterns in titles/topics.
 * Capped to fit within ~1500 tokens.
 */
function buildPlaylistContext(videos) {
  if (!videos || videos.length === 0) return null;

  const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount);
  const avgViews = Math.round(sorted.reduce((s, v) => s + v.viewCount, 0) / sorted.length);

  const lines = [];
  lines.push(`=== YOUTUBE PERFORMANCE: ${videos.length} published shows ===`);
  lines.push(`Average views: ${avgViews.toLocaleString()}`);
  lines.push('');

  // Top 10 performers
  lines.push('TOP PERFORMERS:');
  sorted.slice(0, 10).forEach((v, i) => {
    const ratio = avgViews > 0 ? (v.viewCount / avgViews).toFixed(1) : '?';
    lines.push(`${i + 1}. "${v.title}" — ${v.viewCount.toLocaleString()} views (${ratio}x avg)${v.likeCount ? `, ${v.likeCount.toLocaleString()} likes` : ''}`);
  });

  // Bottom 5 (what to avoid)
  if (sorted.length > 10) {
    lines.push('');
    lines.push('UNDERPERFORMERS (avoid these patterns):');
    sorted.slice(-5).forEach((v) => {
      const ratio = avgViews > 0 ? (v.viewCount / avgViews).toFixed(1) : '?';
      lines.push(`- "${v.title}" — ${v.viewCount.toLocaleString()} views (${ratio}x avg)`);
    });
  }

  // Recent 5 (recency signal)
  const byDate = [...videos]
    .filter((v) => v.uploadDate)
    .sort((a, b) => (b.uploadDate || '').localeCompare(a.uploadDate || ''));

  if (byDate.length > 0) {
    lines.push('');
    lines.push('MOST RECENT:');
    byDate.slice(0, 5).forEach((v) => {
      const date = v.uploadDate
        ? `${v.uploadDate.slice(0, 4)}-${v.uploadDate.slice(4, 6)}-${v.uploadDate.slice(6, 8)}`
        : 'unknown';
      lines.push(`- "${v.title}" (${date}) — ${v.viewCount.toLocaleString()} views`);
    });
  }

  return lines.join('\n');
}

module.exports = { getPlaylistPerformance, buildPlaylistContext };
