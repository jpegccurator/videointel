import { useState, useEffect, useCallback } from 'react';
import { getAllVideos, saveVideo, deleteVideo as dbDeleteVideo } from '../utils/db';

export function useLibrary() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllVideos();
      setVideos(all);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addVideo = useCallback(async (video) => {
    await saveVideo(video);
    await refresh();
  }, [refresh]);

  const removeVideo = useCallback(async (id) => {
    await dbDeleteVideo(id);
    await refresh();
  }, [refresh]);

  return { videos, loading, refresh, addVideo, removeVideo };
}
