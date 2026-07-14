// ============================================
// THOUFIFY PLAYER - Real Audio Streaming
// ============================================

let audio = null;
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let volume = 70;
let isMuted = false;
// Use shared global songs list populated by app.js
window.songs = window.songs || [];
let songs = window.songs;
let likedSongs = new Set();
let loopInterval = null;
let songStartTime = 0;
const SONG_DURATION = 120; // 2 minutes fixed

// Initialize audio element
function initPlayer() {
  audio = document.getElementById('audioPlayer');
  if (!audio) {
    console.error('Audio element not found!');
    return;
  }

  audio.volume = volume / 100;
  audio.preload = 'metadata';

  // FIX: Loop the song to make it 2 minutes
  audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      updateProgressUI();

      // If song reaches near end, loop it back to start to make it 2 minutes
      const elapsed = Date.now() - songStartTime;
      if (elapsed >= SONG_DURATION * 1000) {
        // 2 minutes reached, go to next song
        nextSong();
      } else if (audio.currentTime >= audio.duration - 0.5) {
        // Loop the short preview back to start
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Loop play failed:', e));
      }
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    console.log('Metadata loaded, duration:', audio.duration);
    document.getElementById('totalTime').textContent = formatTime(SONG_DURATION);
  });

  audio.addEventListener('canplay', () => {
    console.log('Can play now');
    document.getElementById('totalTime').textContent = formatTime(SONG_DURATION);
  });

  audio.addEventListener('error', (e) => {
    console.error('Audio error:', e, audio.error);
    const err = audio.error;
    let msg = 'Error playing song';
    if (err) {
      switch (err.code) {
        case 1: msg = 'Audio download aborted'; break;
        case 2: msg = 'Network error - check connection'; break;
        case 3: msg = 'Audio decoding error'; break;
        case 4: msg = 'Audio format not supported'; break;
      }
    }
    showToast(msg);
    isPlaying = false;
    updatePlayButton();
  });

  audio.addEventListener('waiting', () => {
    showToast('Buffering...');
  });

  audio.addEventListener('playing', () => {
    console.log('Playing!');
    isPlaying = true;
    updatePlayButton();
    updatePlaylistHighlight();
  });

  audio.addEventListener('pause', () => {
    console.log('Paused');
    isPlaying = false;
    updatePlayButton();
    updatePlaylistHighlight();
  });

  console.log('Player initialized');
}

// Load and play a song by index
async function playSong(index) {
  if (!songs.length || index < 0 || index >= songs.length) {
    console.log('Invalid song index:', index, 'songs:', songs.length);
    return;
  }

  currentSongIndex = index;
  const song = songs[index];
  console.log('Playing:', song.title, 'from:', song.file);

  // Reset timer
  songStartTime = Date.now();

  // Use the stream URL from our API
  let songUrl = song.file;

  // Set source and play
  audio.src = songUrl;
  audio.load();

  try {
    await audio.play();
    console.log('Play started successfully');
    isPlaying = true;
    updatePlayButton();
    updatePlayerUI(song);
    updatePlaylistHighlight();
  } catch (err) {
    console.error('Play failed:', err);
    showToast('Click play button to start');
    isPlaying = false;
    updatePlayButton();
  }
}

// Play specific song by ID
async function playSongById(songId) {
  const idx = songs.findIndex(s => s.id === songId);
  if (idx !== -1) {
    console.log('Playing by ID:', songId, 'index:', idx);
    await playSong(idx);
  } else {
    console.log('Song not found:', songId);
  }
}

// Toggle play/pause
async function togglePlay() {
  if (!audio) {
    console.error('Audio not initialized');
    return;
  }

  if (currentSongIndex === -1) {
    console.log('No song selected, playing first');
    if (songs.length > 0) {
      await playSong(0);
    } else {
      showToast('No songs available');
    }
    return;
  }

  if (isPlaying) {
    console.log('Pausing');
    audio.pause();
  } else {
    console.log('Resuming/Playing');
    try {
      await audio.play();
    } catch (err) {
      console.error('Resume failed:', err);
      showToast('Cannot play. Check audio file exists.');
    }
  }
}

// Next song
function nextSong() {
  if (!songs.length) return;
  let next;
  if (isShuffle) {
    next = Math.floor(Math.random() * songs.length);
  } else {
    next = (currentSongIndex + 1) % songs.length;
  }
  console.log('Next song:', next);
  playSong(next);
}

// Previous song
function prevSong() {
  if (!songs.length) return;
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0;
    songStartTime = Date.now();
    updateProgressUI();
  } else {
    const prev = (currentSongIndex - 1 + songs.length) % songs.length;
    playSong(prev);
  }
}

// Seek
function seek(e) {
  if (!audio) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

  // Calculate new position within the 2-minute window
  const newElapsed = pct * SONG_DURATION;
  songStartTime = Date.now() - (newElapsed * 1000);

  // Also seek within the actual audio
  if (audio.duration && !isNaN(audio.duration)) {
    audio.currentTime = (pct * SONG_DURATION) % audio.duration;
  }

  updateProgressUI();
}

// Update progress UI - shows progress within the 2-minute window
function updateProgressUI() {
  if (!audio) return;

  const elapsed = Math.min((Date.now() - songStartTime) / 1000, SONG_DURATION);
  const pct = (elapsed / SONG_DURATION) * 100;

  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = pct + '%';

  document.getElementById('currTime').textContent = formatTime(elapsed);
}

// Volume
function setVolume(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  volume = Math.round(pct * 100);
  if (audio) audio.volume = pct;
  document.getElementById('volumeFill').style.width = volume + '%';
  isMuted = false;
  updateMuteIcon();
}

function toggleMute() {
  if (!audio) return;
  isMuted = !isMuted;
  audio.muted = isMuted;
  document.getElementById('volumeFill').style.width = isMuted ? '0%' : volume + '%';
  updateMuteIcon();
}

function updateMuteIcon() {
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  btn.innerHTML = isMuted
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
}

// Toggle controls
function toggleShuffle() {
  isShuffle = !isShuffle;
  const btn = document.getElementById('shuffleBtn');
  if (btn) btn.style.color = isShuffle ? '#e50914' : '#b3b3b3';
  showToast(isShuffle ? 'Shuffle ON' : 'Shuffle OFF');
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  const btn = document.getElementById('repeatBtn');
  if (btn) btn.style.color = isRepeat ? '#e50914' : '#b3b3b3';
  showToast(isRepeat ? 'Repeat ON' : 'Repeat OFF');
}

// Update UI
function updatePlayButton() {
  const btn = document.getElementById('playBtn');
  const heroBtn = document.getElementById('heroPlayBtn');
  const icon = isPlaying
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  if (btn) btn.innerHTML = icon;
  if (heroBtn) heroBtn.innerHTML = icon;
}

function updatePlayerUI(song) {
  const titleEl = document.getElementById('playerTitle');
  const artistEl = document.getElementById('playerArtist');

  if (titleEl) titleEl.textContent = song.title;
  if (artistEl) artistEl.textContent = song.artist;

  // FIX: Proper image handling with fallback
  const artImg = document.getElementById('playerArtImg');
  const artDiv = document.getElementById('playerArt');
  if (artImg && song.cover) {
    artImg.src = song.cover;
    artImg.style.display = 'block';
    artImg.onerror = function () {
      this.style.display = 'none';
      if (artDiv) artDiv.style.background = 'linear-gradient(135deg, #e50914, #b20710)';
    };
    artImg.onload = function () {
      this.style.display = 'block';
    };
  }

  const likeBtn = document.getElementById('playerLikeBtn');
  if (likeBtn) likeBtn.classList.toggle('liked', likedSongs.has(song.id));

  const dlStatus = document.getElementById('dlStatus');
  if (dlStatus) dlStatus.textContent = '';
}

function updatePlaylistHighlight() {
  document.querySelectorAll('.song-row').forEach((row, i) => {
    row.classList.toggle('playing', i === currentSongIndex);
    const idx = row.querySelector('.idx');
    if (idx) {
      if (i === currentSongIndex && isPlaying) {
        idx.innerHTML = '<div class="equalizer"><span></span><span></span><span></span><span></span></div>';
      } else {
        idx.textContent = i + 1;
      }
    }
  });
}

// Like functions
function togglePlayerLike() {
  if (currentSongIndex === -1 || !songs[currentSongIndex]) return;
  const song = songs[currentSongIndex];
  if (likedSongs.has(song.id)) likedSongs.delete(song.id);
  else likedSongs.add(song.id);
  const btn = document.getElementById('playerLikeBtn');
  if (btn) btn.classList.toggle('liked');
}

function toggleHeroLike() {
  const btn = document.getElementById('heroLikeBtn');
  if (btn) btn.classList.toggle('liked');
}

function togglePlaylistLike() {
  const btn = document.querySelector('.playlist-actions .btn-heart-large');
  if (btn) btn.classList.toggle('liked');
}

// Play entire playlist
function playPlaylist(playlistId) {
  if (songs.length > 0) {
    playSong(0);
  }
}

function playCurrentPlaylist() {
  if (songs.length > 0) {
    playSong(0);
  }
}

// Format time
function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlayer);
} else {
  initPlayer();
}
