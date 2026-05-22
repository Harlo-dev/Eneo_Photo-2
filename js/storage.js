/**
 * storage.js - IndexedDB pour médias/albums, localStorage pour préférences
 */
const Storage = (function () {
  const DB_NAME = 'eneo-photo-db';
  const DB_VERSION = 1;
  const MEDIA_STORE = 'media';
  const ALBUM_STORE = 'albums';

  let db = null;

  function openDB() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(MEDIA_STORE)) {
          const mediaStore = database.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
          mediaStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          mediaStore.createIndex('albumId', 'albumId', { unique: false });
          mediaStore.createIndex('isDeleted', 'isDeleted', { unique: false });
        }
        if (!database.objectStoreNames.contains(ALBUM_STORE)) {
          database.createObjectStore(ALBUM_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  function tx(storeName, mode = 'readonly') {
    return openDB().then((database) => {
      const transaction = database.transaction(storeName, mode);
      return transaction.objectStore(storeName);
    });
  }

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /* --- Media CRUD --- */

  async function saveMedia(media) {
    const store = await tx(MEDIA_STORE, 'readwrite');
    return promisifyRequest(store.put(media));
  }

  async function getMedia(id) {
    const store = await tx(MEDIA_STORE);
    return promisifyRequest(store.get(id));
  }

  async function getAllMedia() {
    const store = await tx(MEDIA_STORE);
    return promisifyRequest(store.getAll());
  }

  async function updateMedia(id, updates) {
    const existing = await getMedia(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    return saveMedia(updated);
  }

  async function deleteMedia(id) {
    const store = await tx(MEDIA_STORE, 'readwrite');
    return promisifyRequest(store.delete(id));
  }

  /* --- Albums --- */

  async function saveAlbum(album) {
    const store = await tx(ALBUM_STORE, 'readwrite');
    return promisifyRequest(store.put(album));
  }

  async function getAlbum(id) {
    const store = await tx(ALBUM_STORE);
    return promisifyRequest(store.get(id));
  }

  async function getAlbums() {
    const store = await tx(ALBUM_STORE);
    return promisifyRequest(store.getAll());
  }

  async function deleteAlbum(id) {
    const store = await tx(ALBUM_STORE, 'readwrite');
    return promisifyRequest(store.delete(id));
  }

  /* --- localStorage helpers --- */

  function getSetting(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  function setSetting(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getAvatar() {
    return localStorage.getItem('eneo_avatar') || 'assets/default-avatar.svg';
  }

  function setAvatar(dataUrl) {
    localStorage.setItem('eneo_avatar', dataUrl);
  }

  async function getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return est;
    }
    return { usage: 0, quota: 0 };
  }

  return {
    openDB,
    saveMedia,
    getMedia,
    getAllMedia,
    updateMedia,
    deleteMedia,
    saveAlbum,
    getAlbum,
    getAlbums,
    deleteAlbum,
    getSetting,
    setSetting,
    getAvatar,
    setAvatar,
    getStorageEstimate
  };
})();
