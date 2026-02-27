import { useState, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import SettingsModal from './components/SettingsModal';
import Analyze from './pages/Analyze';
import Library from './pages/Library';
import ShowGenerator from './pages/ShowGenerator';
import ShowOutcomes from './pages/ShowOutcomes';
import { useLibrary } from './hooks/useIndexedDB';
import { useOpenAI } from './hooks/useOpenAI';
import { getYouTubeSettings, saveYouTubeSettings } from './utils/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);

  const { apiKey, hasKey, serverHasKey, defaults, saveKey, testKey } = useOpenAI();
  const { videos, loading: libraryLoading, addVideo, removeVideo, refresh } = useLibrary();

  // Show settings on first launch if no key (local or server)
  useEffect(() => {
    if (!hasKey) {
      setSettingsOpen(true);
    }
  }, [hasKey]);

  // Auto-populate YouTube settings from server env vars (one-time)
  useEffect(() => {
    if (!defaults) return;
    if (!defaults.hasGoogleApiKey && !defaults.youtubeChannel) return;

    getYouTubeSettings().then((existing) => {
      // Only populate if user hasn't already configured their own
      if (existing && (existing.googleApiKey || existing.channelUrl)) return;

      saveYouTubeSettings({
        googleApiKey: defaults.googleApiKey || '',
        channelUrl: defaults.youtubeChannel || '',
      });
    });
  }, [defaults]);

  const handleSaveToLibrary = useCallback(async (video) => {
    await addVideo(video);
    setActiveTab('library');
  }, [addVideo]);

  const handleToggleSelect = useCallback((id) => {
    setSelectedVideoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleGenerateShow = useCallback(() => {
    setActiveTab('show');
  }, []);

  const handleGoToLibrary = useCallback(() => {
    setActiveTab('library');
  }, []);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSettingsClick={() => setSettingsOpen(true)}
    >
      {activeTab === 'analyze' && (
        <Analyze
          onSaveToLibrary={handleSaveToLibrary}
          hasApiKey={hasKey}
          onNeedSettings={() => setSettingsOpen(true)}
        />
      )}

      {activeTab === 'library' && (
        <Library
          videos={videos}
          loading={libraryLoading}
          onDelete={removeVideo}
          selectedIds={selectedVideoIds}
          onToggleSelect={handleToggleSelect}
          onGenerateShow={handleGenerateShow}
        />
      )}

      {activeTab === 'show' && (
        <ShowGenerator
          videos={videos}
          allLibraryVideos={videos}
          selectedVideoIds={selectedVideoIds}
          onGoToLibrary={handleGoToLibrary}
        />
      )}

      {activeTab === 'outcomes' && (
        <ShowOutcomes />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        serverHasKey={serverHasKey}
        onSave={saveKey}
        onTest={testKey}
      />
    </Layout>
  );
}
