import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'videointel';
const DB_VERSION = 3;

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
          if (!db.objectStoreNames.contains('showOutcomes')) {
            const outcomeStore = db.createObjectStore('showOutcomes', { keyPath: 'id' });
            outcomeStore.createIndex('createdAt', 'createdAt');
            outcomeStore.createIndex('status', 'status');
          }
          if (!db.objectStoreNames.contains('editorialDecisions')) {
            db.createObjectStore('editorialDecisions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('youtubeSettings')) {
            db.createObjectStore('youtubeSettings', { keyPath: 'id' });
          }
        }
        // v3 stores - playlist DNA
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('playlistDNA')) {
            const dnaStore = db.createObjectStore('playlistDNA', { keyPath: 'id' });
            dnaStore.createIndex('playlistUrl', 'playlistUrl');
            dnaStore.createIndex('lastUpdated', 'lastUpdated');
          }
        }
      },
      blocked() {
        // Another tab has the old version open - close it to continue
        console.warn('IndexedDB upgrade blocked by another tab. Close other VideoIntel tabs and refresh.');
      },
    }).catch((err) => {
      console.error('IndexedDB open failed, resetting:', err);
      // Nuclear fallback: delete and recreate
      dbPromise = null;
      return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => {
          // Retry after delete
          resolve(getDB());
        };
        req.onerror = () => reject(err);
      });
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

// ─── Playlist DNA ───

export async function savePlaylistDNA(dnaRecord) {
  const db = await getDB();
  const record = {
    ...dnaRecord,
    id: dnaRecord.id || uuidv4(),
    lastUpdated: new Date().toISOString(),
  };
  await db.put('playlistDNA', record);
  return record;
}

export async function getPlaylistDNA(id) {
  const db = await getDB();
  return db.get('playlistDNA', id);
}

export async function getPlaylistDNAByUrl(playlistUrl) {
  const db = await getDB();
  const all = await db.getAllFromIndex('playlistDNA', 'playlistUrl', playlistUrl);
  // Return the most recently updated one
  if (all.length === 0) return null;
  return all.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))[0];
}

export async function getAllPlaylistDNA() {
  const db = await getDB();
  return db.getAll('playlistDNA');
}

export async function deletePlaylistDNA(id) {
  const db = await getDB();
  await db.delete('playlistDNA', id);
}

// ─── YouTube Settings (playlist URL persistence) ───

export async function saveYoutubePlaylistUrl(url) {
  const db = await getDB();
  await db.put('youtubeSettings', { id: 'playlistUrl', value: url });
}

export async function getYoutubePlaylistUrl() {
  const db = await getDB();
  const record = await db.get('youtubeSettings', 'playlistUrl');
  return record?.value || '';
}

