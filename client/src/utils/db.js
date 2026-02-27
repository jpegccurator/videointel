import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'videointel';
const DB_VERSION = 2;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 stores
        if (oldVersion < 1) {
          const videoStore = db.createObjectStore('analyzedVideos', { keyPath: 'id' });
          videoStore.createIndex('dateAnalyzed', 'dateAnalyzed');
          db.createObjectStore('showDrafts', { keyPath: 'id' });
        }
        // v2 stores - learning loop
        if (oldVersion < 2) {
          const outcomeStore = db.createObjectStore('showOutcomes', { keyPath: 'id' });
          outcomeStore.createIndex('createdAt', 'createdAt');
          outcomeStore.createIndex('status', 'status');
          db.createObjectStore('editorialDecisions', { keyPath: 'id' });
          db.createObjectStore('youtubeSettings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Analyzed Videos ───

export async function saveVideo(video) {
  const db = await getDB();
  await db.put('analyzedVideos', video);
  return video;
}

export async function getAllVideos() {
  const db = await getDB();
  const videos = await db.getAll('analyzedVideos');
  return videos.sort((a, b) => new Date(b.dateAnalyzed) - new Date(a.dateAnalyzed));
}

export async function getVideo(id) {
  const db = await getDB();
  return db.get('analyzedVideos', id);
}

export async function deleteVideo(id) {
  const db = await getDB();
  await db.delete('analyzedVideos', id);
}

// ─── Show Drafts ───

export async function saveShowDraft(draft) {
  const db = await getDB();
  await db.put('showDrafts', draft);
  return draft;
}

export async function getAllShowDrafts() {
  const db = await getDB();
  return db.getAll('showDrafts');
}

export async function getShowDraft(id) {
  const db = await getDB();
  return db.get('showDrafts', id);
}

export async function deleteShowDraft(id) {
  const db = await getDB();
  await db.delete('showDrafts', id);
}

// ─── Show Outcomes ───

export async function saveShowOutcome(outcome) {
  const db = await getDB();
  const record = {
    ...outcome,
    id: outcome.id || uuidv4(),
    createdAt: outcome.createdAt || new Date().toISOString(),
    status: outcome.status || 'draft', // draft | published | matched
    concept: outcome.concept || {},
    finalContent: outcome.finalContent || {},
    sourceVideoIds: outcome.sourceVideoIds || [],
    checkedDataPointIds: outcome.checkedDataPointIds || [],
    youtubeVideoId: outcome.youtubeVideoId || null,
    performance: outcome.performance || null,
    performanceHistory: outcome.performanceHistory || [],
  };
  await db.put('showOutcomes', record);
  return record;
}

export async function getAllShowOutcomes() {
  const db = await getDB();
  const outcomes = await db.getAll('showOutcomes');
  return outcomes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getShowOutcome(id) {
  const db = await getDB();
  return db.get('showOutcomes', id);
}

export async function deleteShowOutcome(id) {
  const db = await getDB();
  await db.delete('showOutcomes', id);
}

// ─── Editorial Decisions ───

export async function saveEditorialDecision(decision) {
  const db = await getDB();
  const record = {
    ...decision,
    id: decision.id || uuidv4(),
    outcomeId: decision.outcomeId,
    totalRegenerations: decision.totalRegenerations || 0,
    versionsGenerated: decision.versionsGenerated || 1,
    titleKept: decision.titleKept || false,
    titleEdited: decision.titleEdited || false,
    titleOriginal: decision.titleOriginal || '',
    titleFinal: decision.titleFinal || '',
    synopsisKept: decision.synopsisKept || false,
    synopsisEdited: decision.synopsisEdited || false,
    thumbnailKept: decision.thumbnailKept || false,
    thumbnailEdited: decision.thumbnailEdited || false,
    dataPointsOffered: decision.dataPointsOffered || 0,
    dataPointsKept: decision.dataPointsKept || 0,
    dataPointsRemoved: decision.dataPointsRemoved || 0,
    elementsLocked: decision.elementsLocked || [],
  };
  await db.put('editorialDecisions', record);
  return record;
}

export async function getAllEditorialDecisions() {
  const db = await getDB();
  return db.getAll('editorialDecisions');
}

export async function getEditorialDecision(id) {
  const db = await getDB();
  return db.get('editorialDecisions', id);
}

export async function deleteEditorialDecision(id) {
  const db = await getDB();
  await db.delete('editorialDecisions', id);
}

// ─── YouTube Settings ───

const YT_SETTINGS_KEY = 'default';

export async function getYouTubeSettings() {
  const db = await getDB();
  return db.get('youtubeSettings', YT_SETTINGS_KEY) || null;
}

export async function saveYouTubeSettings(settings) {
  const db = await getDB();
  const record = {
    ...settings,
    id: YT_SETTINGS_KEY,
    googleApiKey: settings.googleApiKey || '',
    playlistUrl: settings.playlistUrl || '',
    channelUrl: settings.channelUrl || '',
    channelId: settings.channelId || null,
    lastSyncAt: settings.lastSyncAt || null,
  };
  await db.put('youtubeSettings', record);
  return record;
}
