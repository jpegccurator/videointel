import { openDB } from 'idb';

const DB_NAME = 'videointel';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('analyzedVideos')) {
          const videoStore = db.createObjectStore('analyzedVideos', { keyPath: 'id' });
          videoStore.createIndex('dateAnalyzed', 'dateAnalyzed');
        }
        if (!db.objectStoreNames.contains('showDrafts')) {
          db.createObjectStore('showDrafts', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// Analyzed Videos
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

// Show Drafts
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
