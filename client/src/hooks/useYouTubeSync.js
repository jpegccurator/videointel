import { useState, useCallback, useEffect, useRef } from 'react';
import { resolveChannelId, getChannelVideos, getVideoStats, findMatchingVideo } from '../utils/youtube';
import { getAllShowOutcomes, saveShowOutcome, getYouTubeSettings, saveYouTubeSettings } from '../utils/db';

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function useYouTubeSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const cooldownTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const syncPerformance = useCallback(async () => {
    // Cooldown check
    if (lastSyncTime && Date.now() - lastSyncTime < SYNC_COOLDOWN_MS) {
      const remaining = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - lastSyncTime)) / 60000);
      setSyncError(`Please wait ${remaining} more minute${remaining > 1 ? 's' : ''} before syncing again.`);
      return null;
    }

    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      const settings = await getYouTubeSettings();
      if (!settings || !settings.googleApiKey) {
        throw new Error('Google API key not configured. Add it in Settings.');
      }
      if (!settings.channelUrl && !settings.channelId) {
        throw new Error('YouTube channel not configured. Add it in Settings.');
      }

      const apiKey = settings.googleApiKey;

      // Resolve channel ID if needed
      let channelId = settings.channelId;
      if (!channelId) {
        channelId = await resolveChannelId(settings.channelUrl, apiKey);
        await saveYouTubeSettings({ ...settings, channelId });
      }

      // Get channel videos
      const channelVideos = await getChannelVideos(channelId, apiKey, 50);

      // Get all outcomes
      const outcomes = await getAllShowOutcomes();
      if (outcomes.length === 0) {
        const now = Date.now();
        setLastSyncTime(now);
        setSyncResult({ matched: 0, updated: 0, total: 0 });
        // Schedule re-render when cooldown expires
        cooldownTimerRef.current = setTimeout(() => setLastSyncTime((t) => t), SYNC_COOLDOWN_MS);
        return { matched: 0, updated: 0, total: 0 };
      }

      // Collect video IDs that need stats
      const videoIdsToFetch = new Set();
      const matchResults = [];

      for (const outcome of outcomes) {
        // Already matched - just refresh stats
        if (outcome.youtubeVideoId) {
          videoIdsToFetch.add(outcome.youtubeVideoId);
          matchResults.push({ outcome, videoId: outcome.youtubeVideoId, isNew: false });
          continue;
        }

        // Try fuzzy match
        const conceptTitle = outcome.finalContent?.title || outcome.concept?.title;
        if (!conceptTitle) continue;

        const match = findMatchingVideo(conceptTitle, channelVideos);
        if (match) {
          videoIdsToFetch.add(match.videoId);
          matchResults.push({ outcome, videoId: match.videoId, isNew: true });
        }
      }

      // Fetch stats for all matched videos
      let stats = {};
      if (videoIdsToFetch.size > 0) {
        stats = await getVideoStats([...videoIdsToFetch], apiKey);
      }

      // Update outcomes with performance data
      let matched = 0;
      let updated = 0;

      for (const { outcome, videoId, isNew } of matchResults) {
        const perf = stats[videoId];
        if (!perf) continue;

        const newHistory = [...(outcome.performanceHistory || [])];
        newHistory.push({
          timestamp: new Date().toISOString(),
          ...perf,
        });

        await saveShowOutcome({
          ...outcome,
          status: 'matched',
          youtubeVideoId: videoId,
          performance: perf,
          performanceHistory: newHistory,
        });

        if (isNew) matched++;
        updated++;
      }

      // Update last sync time
      await saveYouTubeSettings({ ...settings, channelId, lastSyncAt: new Date().toISOString() });
      const now = Date.now();
      setLastSyncTime(now);

      // Schedule re-render when cooldown expires so button re-enables
      cooldownTimerRef.current = setTimeout(() => setLastSyncTime((t) => t), SYNC_COOLDOWN_MS);

      const result = { matched, updated, total: outcomes.length };
      setSyncResult(result);
      return result;
    } catch (err) {
      setSyncError(err.message);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [lastSyncTime]);

  const canSync = !syncing && (!lastSyncTime || Date.now() - lastSyncTime >= SYNC_COOLDOWN_MS);

  return {
    syncing,
    syncResult,
    syncError,
    syncPerformance,
    canSync,
    clearSyncMessages: () => { setSyncResult(null); setSyncError(null); },
  };
}
