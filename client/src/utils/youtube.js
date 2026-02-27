const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Extract a playlist ID from a YouTube playlist URL.
 * Accepts: full URL with ?list=PLxxx, or raw playlist ID.
 */
export function extractPlaylistId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  // URL with list= parameter
  const urlMatch = trimmed.match(/[?&]list=(PL[\w-]+)/);
  if (urlMatch) return urlMatch[1];

  // Raw playlist ID
  if (trimmed.startsWith('PL') && trimmed.length > 10) return trimmed;

  return null;
}

/**
 * Get videos from a specific playlist.
 * Paginates to fetch all items (playlists can have hundreds of videos).
 * API cost: 1 unit per page of 50 items.
 */
export async function getPlaylistVideos(playlistId, apiKey, maxResults = 200) {
  const videos = [];
  let nextPageToken = null;

  do {
    const pageSize = Math.min(50, maxResults - videos.length);
    let url = `${YT_API_BASE}/playlistItems?playlistId=${playlistId}&part=snippet&maxResults=${pageSize}&key=${apiKey}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to fetch playlist');
    }

    if (data.items) {
      for (const item of data.items) {
        // Skip deleted/private videos
        if (item.snippet.title === 'Deleted video' || item.snippet.title === 'Private video') continue;
        videos.push({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          publishedAt: item.snippet.publishedAt,
          thumbnailUrl: item.snippet.thumbnails?.medium?.url || null,
        });
      }
    }

    nextPageToken = data.nextPageToken || null;
  } while (nextPageToken && videos.length < maxResults);

  return videos;
}

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
    const res2 = await fetch(
      `${YT_API_BASE}/channels?forUsername=${encodeURIComponent(handle)}&part=id&key=${apiKey}`
    );
    const data2 = await res2.json();
    if (data2.items && data2.items.length > 0) {
      return data2.items[0].id;
    }
  }

  if (input.startsWith('UC') && input.length >= 24) {
    return input;
  }

  throw new Error('Could not resolve channel. Try pasting a channel URL like youtube.com/@handle');
}

/**
 * Get recent videos from a channel's uploads playlist.
 * Returns up to `maxResults` videos (default 50).
 */
export async function getChannelVideos(channelId, apiKey, maxResults = 50) {
  const channelRes = await fetch(
    `${YT_API_BASE}/channels?id=${channelId}&part=contentDetails&key=${apiKey}`
  );
  const channelData = await channelRes.json();
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error('Channel not found');
  }
  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
  return getPlaylistVideos(uploadsPlaylistId, apiKey, maxResults);
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
