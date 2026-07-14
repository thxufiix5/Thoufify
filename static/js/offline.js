// ============================================
// THOUFIFY OFFLINE - IndexedDB + Service Worker
// ============================================

const DB_NAME = 'ThoufifyDB';
const DB_VERSION = 2;
const STORE_SONGS = 'songs';
const STORE_COVERS = 'covers';
const STORE_META = 'metadata';

let db = null;

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_COVERS)) {
        db.createObjectStore(STORE_COVERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };
  });
}

// Download song for offline (via API)
async function downloadSong(songId, audioUrl, coverUrl) {
  try {
    if (!db) await openDB();
    showToast('Downloading...');

    // Download via our API
    const response = await fetch(`/api/stream/${songId}`);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();

    // Store in IndexedDB
    const tx = db.transaction([STORE_SONGS], 'readwrite');
    tx.objectStore(STORE_SONGS).put({
      id: songId,
      blob: blob,
      downloadedAt: Date.now()
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    showToast('Downloaded! Available offline');
    updateDownloadCount();
    updateDownloadButtons(songId, true);
    return true;
  } catch (err) {
    console.error('Download failed:', err);
    showToast('Download failed. Try again.');
    return false;
  }
}

// Download current playing song
async function downloadCurrentSong() {
  if (currentSongIndex === -1 || !songs[currentSongIndex]) {
    showToast('Play a song first');
    return;
  }
  const song = songs[currentSongIndex];
  await downloadSong(song.id, song.file, song.cover);
}

// Get offline song
async function getOfflineSong(songId) {
  try {
    if (!db) await openDB();
    const tx = db.transaction([STORE_SONGS], 'readonly');
    const store = tx.objectStore(STORE_SONGS);
    const request = store.get(songId);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
}

// Check if song is downloaded
async function isDownloaded(songId) {
  const song = await getOfflineSong(songId);
  return song !== null && song !== undefined;
}

// Get all downloaded songs
async function getDownloadedSongs() {
  try {
    if (!db) await openDB();
    const tx = db.transaction([STORE_SONGS], 'readonly');
    const store = tx.objectStore(STORE_SONGS);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}

// Create object URL from blob
function createObjectURL(blob) {
  return URL.createObjectURL(blob);
}

// Update download badge count
async function updateDownloadCount() {
  const songs = await getDownloadedSongs();
  const badge = document.getElementById('likedCount');
  if (badge) badge.textContent = songs.length;
}

// Update download button states
async function updateDownloadButtons(songId, downloaded) {
  document.querySelectorAll('.dl-btn').forEach(btn => {
    if (btn.dataset.songId === songId) {
      btn.classList.toggle('downloaded', downloaded);
    }
  });
}

// Check all downloads and update UI
async function checkAllDownloads() {
  const downloaded = await getDownloadedSongs();
  const ids = new Set(downloaded.map(s => s.id));
  document.querySelectorAll('.dl-btn').forEach(btn => {
    if (ids.has(btn.dataset.songId)) {
      btn.classList.add('downloaded');
    }
  });
  updateDownloadCount();
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Network status
function updateNetworkStatus() {
  const status = document.getElementById('offlineStatus');
  if (!status) return;
  if (navigator.onLine) {
    status.classList.remove('offline');
    status.innerHTML = '<span class="dot"></span><span>Online</span>';
  } else {
    status.classList.add('offline');
    status.innerHTML = '<span class="dot"></span><span>Offline Mode</span>';
  }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Initialize
openDB().then(() => {
  updateDownloadCount();
  updateNetworkStatus();
  setTimeout(checkAllDownloads, 1000);
}).catch(err => {
  console.log('IndexedDB not available:', err);
});
