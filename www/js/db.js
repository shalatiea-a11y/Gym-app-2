// IndexedDB wrapper for IronLog. Everything lives on-device only.
const DB_NAME = 'ironlog';
const DB_VERSION = 1;

const STORES = ['settings', 'program', 'workouts', 'recovery', 'photos', 'achievements'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('program')) db.createObjectStore('program', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('workouts')) {
        const s = db.createObjectStore('workouts', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('recovery')) {
        const s = db.createObjectStore('recovery', { keyPath: 'date' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'exerciseId' });
      if (!db.objectStoreNames.contains('achievements')) db.createObjectStore('achievements', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode) {
  const db = await openDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export const DB = {
  async get(store, key) {
    const s = await tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const r = s.get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async getAll(store) {
    const s = await tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const r = s.getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async put(store, value) {
    const s = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.put(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async delete(store, key) {
    const s = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.delete(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async clear(store) {
    const s = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.clear();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async exportAll() {
    const dump = {};
    for (const store of STORES) {
      dump[store] = await DB.getAll(store);
    }
    dump._meta = { app: 'IronLog', exportedAt: new Date().toISOString(), version: DB_VERSION };
    return dump;
  },
  async importAll(dump) {
    for (const store of STORES) {
      if (!dump[store]) continue;
      await DB.clear(store);
      const s = await tx(store, 'readwrite');
      for (const item of dump[store]) {
        s.put(item);
      }
    }
  },
};
