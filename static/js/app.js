// ============================================
// THOUFIFY APP - Main Application Logic
// ============================================

let allSongs = [];
let allPlaylists = {};
let currentTab = 'home';
let currentPlaylistId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Thoufify App loading...');
  await loadData();
  renderHome();
  renderSearch();
  renderLibrary();
  if (typeof initPlayer === 'function') initPlayer();
  console.log('App loaded. Songs:', allSongs.length);
});

// Load data from API
async function loadData() {
  try {
    console.log('Fetching songs...');
    const songsRes = await fetch('/api/songs');
    if (!songsRes.ok) throw new Error('Failed to load songs');
    allSongs = await songsRes.json();
    window.songs = allSongs;
    console.log('Loaded', allSongs.length, 'songs');

    const playlistsRes = await fetch('/api/playlists');
    if (playlistsRes.ok) {
      allPlaylists = await playlistsRes.json();
    }
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('Failed to load music. Refresh page.');
  }
}

// ========== NAVIGATION ==========
function showTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.nav-item').forEach(n => {
      if (n.dataset.tab === tab) n.classList.add('active');
    });
  }

  const searchBox = document.getElementById('searchBox');
  if (searchBox) {
    searchBox.style.display = tab === 'search' ? 'none' : 'flex';
  }

  if (tab === 'home') renderHome();
  if (tab === 'search') renderSearch();
  if (tab === 'library') renderLibrary();
}

function showPlaylist(id) {
  currentPlaylistId = id;
  const pl = allPlaylists[id];
  if (!pl) return;

  const titleEl = document.getElementById('playlistTitle');
  const descEl = document.getElementById('playlistDesc');
  if (titleEl) titleEl.textContent = pl.title;
  if (descEl) descEl.textContent = pl.desc;

  // FIX: Set playlist image with proper fallback
  const artImg = document.getElementById('playlistArtImg');
  if (artImg) {
    if (pl.cover) {
      artImg.src = pl.cover;
      artImg.style.display = 'block';
      artImg.onerror = function () {
        this.style.display = 'none';
        document.getElementById('playlistArt').style.background = 'linear-gradient(135deg, #e50914, #b20710)';
      };
    } else {
      artImg.style.display = 'none';
      document.getElementById('playlistArt').style.background = 'linear-gradient(135deg, #e50914, #b20710)';
    }
  }

  const plSongs = pl.songs.map(sid => allSongs.find(s => s.id === sid)).filter(Boolean);
  songs = plSongs;
  renderPlaylistSongs(plSongs);

  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const playlistTab = document.getElementById('tab-playlist');
  if (playlistTab) playlistTab.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

function historyBack() { window.history.back(); }
function historyForward() { window.history.forward(); }

function setFilter(btn, type) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ========== RENDER HOME ==========
function renderHome() {
  if (!allSongs.length) {
    console.log('No songs to render');
    return;
  }

  const tamil = allSongs.filter(s => s.language === 'tamil').slice(0, 8);
  const hindi = allSongs.filter(s => s.language === 'hindi').slice(0, 8);
  const english = allSongs.filter(s => s.language === 'english').slice(0, 8);
  const malayalam = allSongs.filter(s => s.language === 'malayalam').slice(0, 8);

  const recentCards = document.getElementById('recentCards');
  const madeCards = document.getElementById('madeForYouCards');
  const jumpCards = document.getElementById('jumpBackCards');
  const heroCount = document.getElementById('heroSongCount');

  if (recentCards) recentCards.innerHTML = [...tamil, ...malayalam].slice(0, 8).map((s, i) => createCard(s, i)).join('');
  if (madeCards) madeCards.innerHTML = hindi.map((s, i) => createCard(s, i)).join('');
  if (jumpCards) jumpCards.innerHTML = english.map((s, i) => createCard(s, i)).join('');
  if (heroCount) heroCount.textContent = allSongs.length;
}

function createCard(song, index) {
  const langClass = song.language || 'tamil';
  return `
    <div class="card" onclick="playSongById('${song.id}')">
      <div class="card-img">
        <img src="${song.cover}" alt="${song.title}" loading="lazy" 
          onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#e50914,#b20710)'"
          onload="this.style.display='block'">
        <button class="card-play" onclick="event.stopPropagation();playSongById('${song.id}')">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="card-title">${song.title}</div>
      <div class="card-desc">${song.artist} <span class="lang-badge ${langClass}">${song.language}</span></div>
    </div>
  `;
}

// ========== RENDER SEARCH ==========
function renderSearch() {
  const categories = [
    { name: 'Tamil', color: '#158a08', lang: 'tamil' },
    { name: 'Hindi', color: '#e1118c', lang: 'hindi' },
    { name: 'Malayalam', color: '#0d73ec', lang: 'malayalam' },
    { name: 'English', color: '#e50914', lang: 'english' },
    { name: 'Pop', color: '#bc5900', lang: 'english' },
    { name: 'Hip-Hop', color: '#d84000', lang: 'english' },
    { name: 'Romance', color: '#e1118c', lang: 'hindi' },
    { name: 'Mood', color: '#0d73ec', lang: 'english' },
    { name: 'Rock', color: '#e50914', lang: 'english' },
    { name: 'Jazz', color: '#f6d365', lang: 'english' },
    { name: 'Classical', color: '#667eea', lang: 'tamil' },
    { name: 'Workout', color: '#84fab0', lang: 'hindi' }
  ];

  const browseGrid = document.getElementById('browseGrid');
  if (browseGrid) {
    browseGrid.innerHTML = categories.map(c => `
      <div class="browse-card" style="background:${c.color}" onclick="filterByLang('${c.lang}')">
        <div class="card-title">${c.name}</div>
      </div>
    `).join('');
  }
}

function filterByLang(lang) {
  showTab('search');
  const results = allSongs.filter(s => s.language === lang);
  const resultsDiv = document.getElementById('searchResults');
  const browseDiv = document.getElementById('searchBrowse');
  const listDiv = document.getElementById('searchSongList');

  if (browseDiv) browseDiv.style.display = 'none';
  if (resultsDiv) resultsDiv.style.display = 'block';

  if (listDiv) {
    listDiv.innerHTML = results.map((s, i) => `
      <div class="song-row" onclick="playSongById('${s.id}')">
        <span class="idx">${i + 1}</span>
        <div>
          <div class="s-title">${s.title}</div>
          <div class="s-artist">${s.artist}</div>
        </div>
        <span class="s-album">${s.album}</span>
        <span class="s-date">${s.language}</span>
        <span class="s-dur">${formatTime(s.duration)}</span>
        <button class="dl-btn" data-song-id="${s.id}" onclick="event.stopPropagation();downloadSong('${s.id}', '${s.file}', '${s.cover}')" title="Download">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </button>
      </div>
    `).join('');
  }
}

function handleSearch(query) {
  const resultsDiv = document.getElementById('searchResults');
  const browseDiv = document.getElementById('searchBrowse');
  const listDiv = document.getElementById('searchSongList');

  if (!query.trim()) {
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (browseDiv) browseDiv.style.display = 'block';
    return;
  }

  const q = query.toLowerCase();
  const results = allSongs.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    s.album.toLowerCase().includes(q) ||
    s.language.toLowerCase().includes(q)
  );

  if (browseDiv) browseDiv.style.display = 'none';
  if (resultsDiv) resultsDiv.style.display = 'block';

  if (listDiv) {
    listDiv.innerHTML = results.map((s, i) => `
      <div class="song-row" onclick="playSongById('${s.id}')">
        <span class="idx">${i + 1}</span>
        <div>
          <div class="s-title">${s.title}</div>
          <div class="s-artist">${s.artist}</div>
        </div>
        <span class="s-album">${s.album}</span>
        <span class="s-date">${s.language}</span>
        <span class="s-dur">${formatTime(s.duration)}</span>
        <button class="dl-btn" data-song-id="${s.id}" onclick="event.stopPropagation();downloadSong('${s.id}', '${s.file}', '${s.cover}')" title="Download">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </button>
      </div>
    `).join('');
  }

  setTimeout(checkAllDownloads, 500);
}

// ========== RENDER LIBRARY ==========
function renderLibrary() {
  const playlists = [
    { id: 'tamil', title: 'Tamil Hits 2026', color: 'linear-gradient(135deg,#158a08,#84fab0)' },
    { id: 'hindi', title: 'Hindi Hits 2026', color: 'linear-gradient(135deg,#e1118c,#ff6b9d)' },
    { id: 'malayalam', title: 'Malayalam Hits 2026', color: 'linear-gradient(135deg,#0d73ec,#8fd3f4)' },
    { id: 'english', title: 'English Hits 2026', color: 'linear-gradient(135deg,#e50914,#b20710)' },
    { id: 'liked', title: 'Liked Songs', color: 'linear-gradient(135deg,#e13300,#ff6b6b)' },
    { id: 'workout', title: 'Workout Mix', color: 'linear-gradient(135deg,#667eea,#764ba2)' }
  ];

  const grid = document.getElementById('libraryGrid');
  if (grid) {
    grid.innerHTML = playlists.map(pl => {
      const plData = allPlaylists[pl.id] || {};
      const count = plData.songs ? plData.songs.length : 0;
      const cover = plData.cover || '';
      return `
        <div class="lib-card" onclick="showPlaylist('${pl.id}')">
          <div class="lib-card-img" style="background:${pl.color}">
            <img src="${cover}" alt="${pl.title}" loading="lazy" 
              onerror="this.style.display='none'"
              onload="this.style.display='block'">
          </div>
          <h4>${pl.title}</h4>
          <p>${count} songs</p>
        </div>
      `;
    }).join('');
  }
}

// ========== RENDER PLAYLIST SONGS ==========
function renderPlaylistSongs(songList) {
  const container = document.getElementById('playlistSongs');
  if (!container) return;

  container.innerHTML = songList.map((s, i) => `
    <div class="song-row ${i === currentSongIndex ? 'playing' : ''}" onclick="playSong(${i})">
      <span class="idx">${i === currentSongIndex && isPlaying ? '<div class="equalizer"><span></span><span></span><span></span><span></span></div>' : i + 1}</span>
      <div>
        <div class="s-title">${s.title}</div>
        <div class="s-artist">${s.artist}</div>
      </div>
      <span class="s-album">${s.album}</span>
      <span class="s-date">${s.language}</span>
      <span class="s-dur">${formatTime(s.duration)}</span>
      <button class="dl-btn" data-song-id="${s.id}" onclick="event.stopPropagation();downloadSong('${s.id}', '${s.file}', '${s.cover}')" title="Download for offline">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      </button>
    </div>
  `).join('');

  setTimeout(checkAllDownloads, 500);
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      if (e.ctrlKey || e.metaKey) nextSong();
      break;
    case 'ArrowLeft':
      if (e.ctrlKey || e.metaKey) prevSong();
      break;
    case 'KeyM':
      toggleMute();
      break;
    case 'KeyS':
      toggleShuffle();
      break;
    case 'KeyR':
      toggleRepeat();
      break;
  }
});

// ========== SEARCH INPUT HANDLER ==========
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      showTab('search');
      handleSearch(this.value);
    }
  });
}
