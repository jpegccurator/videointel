const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Resolve a YouTube channel handle or URL to a channel ID.
 * Accepts: @handle, /channel/UCxxx, /c/name, or full URLs.
 */
export async function resolveChannelId(channelInput, apiKey) {
  const input = channelInput.trim();

  // Direct channel ID
  const channelIdMatch = input.match(/\/channel\/(UC[\w-]+)/);
  if (channelIdMatch) return channelIdMatch[1];

  // Extract handle from URL or raw input
  let handle = null;
  const handleFromUrl = input.match(/@([\w.-]+)/);
  if (handleFromUrl) {
    handle = handleFromUrl[1];
  } else if (input.match(/\/c\/([\w.-]+)/)) {
    handle = input.match(/\/c\/([\w.-]+)/)[1];
  } else if (!input.includes('/') && !input.startsWith('UC')) {
    handle = input;
  }

  if (handle) {
    const res = await fetch(
      `${YT_API_BASE}/channels?forHandle=${encodeURIComponent(handle)}&part=id&key=${apiKey}`
    );
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].id;
    }
    // Fallback: search by username
    const res2 = await fetch(
      `${YT_API_BASE}/channels?forUsername=${encodeURIComponent(handle)}&part=id&key=${apiKey}`
    );
    const data2 = await res2.json();
    if (data2.items && data2.items.length > 0) {
      return data2.items[0].id;
    }
  }

  // If it looks like a channel ID already
  if (input.startsWith('UC') && input.length >= 24) {
    return input;
  }

  throw new Error('Could not resolve channel. Try pasting a channel URL like youtube.com/@handle');
}

/**
 * Get recent videos from a channel's uploads playlist.
 * Returns up to `maxResults` videos (default 50).
 * API cost: 1 (channels.list) + 1 (playlistItems.list) + 1 (videos.list) = ~3 units
 */
export async function getChannelVideos(channelId, apiKey, maxResults = 50) {
  // Get uploads playlist ID
  const channelRes = await fetch(
    `${YT_API_BASE}/channels?id=${channelId}&part=contentDetails&key=${apiKey}`
  );
  const channelData = await channelRes.json();
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('Channel not found');
  }
  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  // Get video IDs from uploads playlist
  const playlistRes = await fetch(
    `${YT_API_BASE}/playlistItems?playlistId=${uploadsPlaylistId}&part=snippet&maxResults=${maxResults}&key=${apiKey}`
  );
  const playlistData = await playlistRes.json();
  if (!playlistData.items) return [];

  return playlistData.items.map((item) => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || null,
  }));
}

/**
 * Get statistics for a list of video IDs.
 * Batches up to 50 IDs per request (YouTube API limit).
 * API cost: 1 unit per batch of 50.
 */
export async function getVideoStats(videoIds, apiKey) {
  const stats = {};
  const batches = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    batches.push(videoIds.slice(i, i + 50));
  }

  for (const batch of batches) {
    const res = await fetch(
      `${YT_API_BASE}/videos?id=${batch.join(',')}&part=statistics&key=${apiKey}`
    );
    const data = await res.json();
    if (data.items) {
      for (const item of data.items) {
        stats[item.id] = {
          viewCount: parseInt(item.statistics.viewCount || '0', 10),
          likeCount: parseInt(item.statistics.likeCount || '0', 10),
          commentCount: parseInt(item.statistics.commentCount || '0', 10),
        };
      }
    }
  }

  return stats;
}

/**
 * Fuzzy match a show concept title against YouTube video titles.
 * Returns the best match if similarity is above threshold.
 */
export function findMatchingVideo(conceptTitle, channelVideos, threshold = 0.4) {
  if (!conceptTitle || !channelVideos || channelVideos.length === 0) return null;

  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const conceptNorm = normalize(conceptTitle);
  const conceptWords = new Set(conceptNorm.split(' '));

  let bestMatch = null;
  let bestScore = 0;

  for (const video of channelVideos) {
    const videoNorm = normalize(video.title);
    const videoWords = new Set(videoNorm.split(' '));

    // Jaccard similarity on words
    const intersection = [...conceptWords].filter((w) => videoWords.has(w)).length;
    const union = new Set([...conceptWords, ...videoWords]).size;
    const score = union > 0 ? intersection / union : 0;

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = { ...video, matchScore: score };
    }
  }

  return bestMatch;
}

/**
 * Extract a video ID from a YouTube URL.
 */
export function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
    /^([\w-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
