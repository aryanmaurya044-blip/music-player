/* script.js
    Main UI & player logic. It reads window.SONGS (provided by songs.js).
*/

// Save original home HTML once DOM is ready

// Force playlists to always be an array
let raw = localStorage.getItem("playlists");

if (!raw || raw === "null" || raw === "undefined") {
    localStorage.setItem("playlists", "[]");
}

try {
    const test = JSON.parse(localStorage.getItem("playlists"));
    if (!Array.isArray(test)) {
        localStorage.setItem("playlists", "[]");
    }
} catch {
    localStorage.setItem("playlists", "[]");
}

window.addEventListener("DOMContentLoaded", () => {
  const main = document.getElementById("mainContent");
  if (main) {
    window.HOME_HTML = main.innerHTML;
  }
});

(() => {
  const SONGS = window.SONGS || [];
  const categoriesEl = document.getElementById('categories');
  const songListEl = document.getElementById('songList');
  const recommendedGrid = document.getElementById('recommendedGrid');
  const queueList = document.getElementById('queueList');
  const suggestionsList = document.getElementById('suggestionsList');
  const searchInput = document.getElementById('searchInput');

  // Player elements
  const audio = new Audio();
  let currentIndex = -1;
  let queue = [];
  const playerCover = document.getElementById('playerCover');
  const playerTitle = document.getElementById('playerTitle');
  const playerArtist = document.getElementById('playerArtist');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progress = document.getElementById('progress');
  const curTime = document.getElementById('curTime');
  const durTime = document.getElementById('durTime');
  const volume = document.getElementById('volume');

  // Helpers
  function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Build categories
  function buildCategories() {
    if (!categoriesEl) return;
    const tagMap = {};
    SONGS.forEach(s => {
      (s.tags || ['other']).forEach(t => {
        if (!tagMap[t]) tagMap[t] = [];
        tagMap[t].push(s);
      });
    });

    const defaultOrder = ['viral', 'hollywood', 'bollywood', 'romantic', 'workout', 'chill', 'pop', 'other'];
    const finalTags = defaultOrder.concat(Object.keys(tagMap).filter(t => !defaultOrder.includes(t)));

    categoriesEl.innerHTML = '';
    finalTags.forEach(tag => {
      if (!tagMap[tag] || tagMap[tag].length === 0) return;
      const col = document.createElement('div');
      col.className = 'card';
      col.innerHTML = `
        <img src="${tagMap[tag][0].cover || 'https://picsum.photos/seed/default/400/400'}" alt="${tag}">
        <div class="title">${tag.charAt(0).toUpperCase() + tag.slice(1)} Hits</div>
        <div class="desc">${tagMap[tag].length} tracks • Curated</div>
      `;
      col.addEventListener('click', () => openCategory(tag));
      categoriesEl.appendChild(col);
    });
  }

  // Category expanded (overlay)
  function openCategory(tag) {
    const songs = SONGS.filter(s => (s.tags || []).includes(tag));
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    document.body.appendChild(overlay);

    const expanded = document.createElement('div');
    expanded.className = 'category-expanded';
    expanded.innerHTML = `
      <button class="back-btn">← Back</button>
      <h3>${tag.charAt(0).toUpperCase() + tag.slice(1)} Hits</h3>
      <div id="categoryContainer"></div>
    `;
    document.body.appendChild(expanded);

    const container = expanded.querySelector('#categoryContainer');
    container.innerHTML = '';

    if (songs.length === 0) {
      container.innerHTML = `<div style="color:var(--muted);padding:10px">No songs found.</div>`;
    } else {
      songs.forEach(s => container.appendChild(createSongRow(s)));
    }

    const closeView = () => {
      expanded.remove();
      overlay.remove();
    };
    // Attach local listener to overlay/button (unobtrusive)
    const backBtn = expanded.querySelector('.back-btn');
    if (backBtn) backBtn.addEventListener('click', closeView);
    overlay.addEventListener('click', closeView);
  }

  // Create Song Row (with 3-dot menu)
  function createSongRow(song) {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const isFav = favorites.includes(song.id);

    const row = document.createElement('div');
    row.className = 'song-row';
    row.innerHTML = `
      <img src="${song.cover || 'https://picsum.photos/seed/default/80/80'}" alt="cover">
      <div class="song-meta">
        <div class="song-title">${song.title}</div>
        <div class="song-artist">${song.artist}</div>
      </div>

      <div class="song-options">
        <button class="song-options-btn">⋮</button>
        <div class="song-menu">
          <button class="add-queue">➕ Add to Queue</button>
          <button class="add-fav">${isFav ? '💔 Remove from Favourites' : '❤️ Add to Favourites'}</button>
          <button class="add-playlist">🎶 Add to Playlist</button>
        </div>
      </div>
    `;

    row.addEventListener('dblclick', () => playSongById(song.id));
    row.addEventListener('click', (e) => {
      if (e.target.closest('.song-options')) return;
      addToQueue(song.id);
    });

    const favBtnMenu = row.querySelector('.add-fav');
    if (favBtnMenu) {
      favBtnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
        if (favs.includes(song.id)) {
          favs = favs.filter(id => id !== song.id);
          favBtnMenu.textContent = '❤️ Add to Favourites';
        } else {
          favs.push(song.id);
          favBtnMenu.textContent = '💔 Remove from Favourites';
        }
        localStorage.setItem('favorites', JSON.stringify(favs));
        const sm = row.querySelector('.song-menu');
        if (sm) sm.classList.remove('active');
      });
    }

    const addQueueBtn = row.querySelector('.add-queue');
    if (addQueueBtn) {
      addQueueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addToQueue(song.id);
        const sm = row.querySelector('.song-menu');
        if (sm) sm.classList.remove('active');
      });
    }

    const addPlaylistBtn = row.querySelector('.add-playlist');
    if (addPlaylistBtn) {
      addPlaylistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const anchor = e.currentTarget;
        if (window.PlaylistAPI && typeof window.PlaylistAPI.openAddToPlaylistPopup === 'function') {
          window.PlaylistAPI.openAddToPlaylistPopup(song.id, anchor);
        }
        const sm = row.querySelector('.song-menu');
        if (sm) sm.classList.remove('active');
      });
    }

    const optionsBtn = row.querySelector('.song-options-btn');
    const menu = row.querySelector('.song-menu');
    if (optionsBtn && menu) {
      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.song-menu.active').forEach(m => {
          if (m !== menu) m.classList.remove('active');
        });
        menu.classList.toggle('active');
      });
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !optionsBtn.contains(e.target)) menu.classList.remove('active');
      });
    }

    return row;
  }

  function renderSongList() {
    if (!songListEl) return;
    songListEl.innerHTML = '';
    SONGS.slice(0, 40).forEach(s => songListEl.appendChild(createSongRow(s)));
  }

  /* Recommended Section */
  function renderRecommended() {
    if (!recommendedGrid) return;
    recommendedGrid.innerHTML = '';

    const picks = SONGS.slice(0, 8);
    picks.forEach(s => {
      const card = document.createElement('div');
      card.className = 'recommended-card';
      card.innerHTML = `
        <div class="rec-cover-wrap">
          <img src="${s.cover}" alt="${s.title}">
          <button class="rec-menu-btn">⋮</button>
          <div class="rec-menu">
            <button class="add-queue">➕ Add to Queue</button>
            <button class="add-fav">❤️ Add to Favourites</button>
          </div>
        </div>
        <div class="rec-info">
          <div class="rec-title">${s.title}</div>
          <div class="rec-artist">${s.artist}</div>
        </div>
      `;

      card.addEventListener('dblclick', () => playSongById(s.id));

      const menu = card.querySelector('.rec-menu');
      const btn = card.querySelector('.rec-menu-btn');

      if (btn && menu) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.rec-menu.active').forEach(m => {
            if (m !== menu) m.classList.remove('active');
          });
          menu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
          if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('active');
        });

        const aq = menu.querySelector('.add-queue');
        if (aq) aq.addEventListener('click', (e) => {
          e.stopPropagation();
          addToQueue(s.id);
          menu.classList.remove('active');
        });

        const af = menu.querySelector('.add-fav');
        if (af) af.addEventListener('click', (e) => {
          e.stopPropagation();
          let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
          if (favs.includes(s.id)) favs = favs.filter(id => id !== s.id);
          else favs.push(s.id);
          localStorage.setItem('favorites', JSON.stringify(favs));
          menu.classList.remove('active');
        });
      }

      recommendedGrid.appendChild(card);
    });
  }

  function renderQueue() {
    if (!queueList) return;
    queueList.innerHTML = '';
    queue.forEach(id => {
      const s = SONGS.find(x => x.id === id);
      if (!s) return;
      const el = document.createElement('div');
      el.className = 'queue-item';
      el.innerHTML = `
        <img src="${s.cover}" style="width:40px;height:40px;border-radius:6px">
        <div style="flex:1">
          <div style="font-weight:600">${s.title}</div>
          <div style="font-size:13px;color:var(--muted)">${s.artist}</div>
        </div>
        <div class="song-options">
          <button class="song-options-btn">⋮</button>
          <div class="song-menu">
            <button class="remove-queue">❌ Remove from Queue</button>
          </div>
        </div>
      `;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.song-options')) return;
        playSongById(s.id);
      });
      const optionsBtn = el.querySelector('.song-options-btn');
      const menu = el.querySelector('.song-menu');
      if (optionsBtn && menu) {
        optionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.song-menu.active').forEach(m => {
            if (m !== menu) m.classList.remove('active');
          });
          menu.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
          if (!menu.contains(e.target) && !optionsBtn.contains(e.target)) menu.classList.remove('active');
        });
        const rem = menu.querySelector('.remove-queue');
        if (rem) rem.addEventListener('click', (e) => {
          e.stopPropagation();
          queue = queue.filter(q => q !== id);
          renderQueue();
        });
      }
      queueList.appendChild(el);
    });
  }

  function renderSuggestions() {
    if (!suggestionsList) return;
    suggestionsList.innerHTML = '';
    SONGS.slice(0, 4).forEach(s => {
      const b = document.createElement('div');
      b.className = 'box';
      b.style.marginBottom = '8px';
      b.appendChild(createSongRow(s));
      suggestionsList.appendChild(b);
    });
  }

  function addToQueue(id) {
    if (!queue.includes(id)) {
      queue.push(id);
      renderQueue();
      // --- Save to recent ---
      let recent = JSON.parse(localStorage.getItem('recent') || '[]');

      // Remove if exists
      recent = recent.filter(r => r !== id);

      // Add to top
      recent.unshift(id);

      // Limit to last 20
      recent = recent.slice(0, 20);

      localStorage.setItem('recent', JSON.stringify(recent));
    }
  }

  function playSongById(id) {
    const idx = SONGS.findIndex(s => s.id === id);
    if (idx === -1) return;
    currentIndex = idx;
    loadCurrentAndPlay();
  }

  function loadCurrentAndPlay() {
    const s = SONGS[currentIndex];
    if (!s) return;
    audio.src = s.src;
    audio.play().catch(() => {});
    updatePlayerUI(s);
    if (playPauseBtn) playPauseBtn.textContent = '❚❚';
  }

  function updatePlayerUI(s) {
    if (playerCover) playerCover.src = s.cover || 'covers/default.jpg';
    if (playerTitle) playerTitle.textContent = s.title;
    if (playerArtist) playerArtist.textContent = s.artist;
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (!audio.src) {
        if (SONGS.length > 0) { playSongById(SONGS[0].id); return; }
        return;
      }
      if (audio.paused) { audio.play(); playPauseBtn.textContent = '❚❚'; }
      else { audio.pause(); playPauseBtn.textContent = '▶'; }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentIndex > 0) currentIndex--;
      else currentIndex = SONGS.length - 1;
      loadCurrentAndPlay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentIndex < SONGS.length - 1) currentIndex++;
      else currentIndex = 0;
      loadCurrentAndPlay();
    });
  }

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    if (progress) progress.value = (audio.currentTime / audio.duration) * 100;
    if (curTime) curTime.textContent = formatTime(audio.currentTime);
    if (durTime) durTime.textContent = formatTime(audio.duration);
  });

  if (progress) {
    progress.addEventListener('input', () => {
      if (!audio.duration) return;
      audio.currentTime = (progress.value / 100) * audio.duration;
    });
  }

  audio.addEventListener('ended', () => {
    if (queue.length > 0) {
      const nextId = queue.shift();
      renderQueue();
      playSongById(nextId);
    } else if (currentIndex < SONGS.length - 1) {
      if (nextBtn) nextBtn.click();
    } else {
      if (playPauseBtn) playPauseBtn.textContent = '▶';
    }
  });

  if (volume) {
    volume.addEventListener('input', () => {
      audio.volume = Number(volume.value);
    });
    audio.volume = Number(volume.value);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderSongList();
        renderSuggestions();
        return;
      }

      const filtered = SONGS.filter(s =>
        (s.title + ' ' + s.artist + ' ' + (s.tags || []).join(' '))
          .toLowerCase()
          .includes(q)
      );

      if (songListEl) {
        songListEl.innerHTML = '';
        filtered.forEach(s => songListEl.appendChild(createSongRow(s)));
      }

      if (suggestionsList) {
        suggestionsList.innerHTML = '';
        filtered.slice(0, 5).forEach(s => {
          const b = document.createElement('div');
          b.className = 'box';
          b.style.marginBottom = '8px';
          b.appendChild(createSongRow(s));
          suggestionsList.appendChild(b);
        });
      }
    });
  }

  function init() {
    buildCategories();
    renderSongList();
    renderRecommended();
    renderSuggestions();
    renderQueue();

    // Playlist button in sidebar - safe attach
    const playlistBtn = document.querySelector('[data-action="playlists"]');
    if (playlistBtn) {
      playlistBtn.addEventListener("click", () => {
        const main = document.getElementById("mainContent");
        if (!main) return;

        // Center content replace
        main.innerHTML = `
          <div class="section-head" style="display:flex;align-items:center;gap:10px;">
            <button id="backHomeBtn" class="link-btn" style="font-size:18px;">← Back</button>
            <h3 style="margin:0;">Your Playlists</h3>
            <button id="createPlaylistBtn" class="link-btn" style="margin-left:auto;">+ Create Playlist</button>
          </div>
          <div id="playlistContainer" class="playlist-container"></div>
        `;

        // Load playlist cards in center
        if (window.PlaylistAPI && typeof window.PlaylistAPI.renderPlaylistsSection === 'function') {
          window.PlaylistAPI.renderPlaylistsSection();
        }

        // Attach create button inside center view
        const createBtn = document.getElementById("createPlaylistBtn");
        if (createBtn) {
          createBtn.addEventListener("click", () => {
            if (window.PlaylistAPI && typeof window.PlaylistAPI.openCreatePlaylistPopup === 'function') {
              window.PlaylistAPI.openCreatePlaylistPopup();
            }
          });
        }
      });
    }

    // Recent button overlay
    const recentBtn = document.querySelector('[data-action="recent"]');
    if (recentBtn) {
      recentBtn.addEventListener("click", () => {
        const recentIds = JSON.parse(localStorage.getItem("recent") || "[]");
        const allSongs = window.SONGS || [];
        const recentSongs = recentIds
          .map(id => allSongs.find(s => s.id === id))
          .filter(x => x);

        // Make overlay
        const overlay = document.createElement("div");
        overlay.id = "overlay";
        document.body.appendChild(overlay);

        // Make expanded window
        const box = document.createElement("div");
        box.className = "category-expanded";
        box.innerHTML = `
          <button class="back-btn">← Back</button>
          <h3>Recently Played</h3>
          <div id="recentContainer"></div>
        `;
        document.body.appendChild(box);

        const cont = box.querySelector("#recentContainer");

        if (recentSongs.length === 0) {
          cont.innerHTML = `<div style="color:var(--muted);padding:10px">No recent songs.</div>`;
        } else {
          recentSongs.forEach(s => cont.appendChild(createSongRow(s)));
        }

        const close = () => {
          overlay.remove();
          box.remove();
        };

        const bb = box.querySelector(".back-btn");
        if (bb) bb.addEventListener('click', close);
        overlay.addEventListener("click", close);
      });
    }
  }

  // Expose some helpers
  window.SB = { playById: playSongById, addToQueue, showQueue: () => console.log(queue) };
  window.playSongById = playSongById;

  // Run init and expose re-init for goHome
  init();
  window.reinitHome = init;

  // Favourites overlay (outside init to ensure available globally)
  const favButton = document.querySelector('[data-action="favourites"]');
  if (favButton) {
    favButton.addEventListener('click', () => {
      const favIds = JSON.parse(localStorage.getItem('favorites') || '[]');
      const favSongs = SONGS.filter(s => favIds.includes(s.id));

      const overlay = document.createElement('div');
      overlay.id = 'overlay';
      document.body.appendChild(overlay);

      const expanded = document.createElement('div');
      expanded.className = 'category-expanded';
      expanded.innerHTML = `
        <button class="back-btn">← Back</button>
        <h3>❤️ Your Favourites</h3>
        <div id="favContainer"></div>
      `;
      document.body.appendChild(expanded);

      const container = expanded.querySelector('#favContainer');
      if (favSongs.length === 0) {
        container.innerHTML = `<div style="color:var(--muted);padding:10px">No favorite songs yet.</div>`;
      } else {
        favSongs.forEach(s => container.appendChild(createSongRow(s)));
      }

      const closeView = () => {
        expanded.remove();
        overlay.remove();
      };
      const backBtn = expanded.querySelector('.back-btn');
      if (backBtn) backBtn.addEventListener('click', closeView);
      overlay.addEventListener('click', closeView);
    });
  }

  // Playlist Module Code (inside the main IIFE for consistent scope)
  (function(){
    // load or init playlists
    let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');

    function savePlaylists() {
      localStorage.setItem('playlists', JSON.stringify(playlists));
    }

    // Render playlist cards inside the playlist section (HTML already present)
    function renderPlaylistsSection() {
      const container = document.getElementById('playlistContainer');
      if (!container) return;
      container.innerHTML = '';

      playlists.forEach(pl => {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        const cover = pl.songs && pl.songs.length ? (pl.songs[0].cover || 'covers/default.jpg') : 'covers/default.jpg';
        card.innerHTML = `
          <img src="${cover}" alt="${pl.name} cover">
          <div class="title">${pl.name}</div>
          <div class="count">${pl.songs.length} songs</div>
        `;
        card.addEventListener('click', () => openPlaylistView(pl.id));
        container.appendChild(card);
      });
    }

    // Create playlist popup (simple modal)
    function openCreatePlaylistPopup(prefillName = '') {
      // remove existing popup if any
      document.querySelectorAll('.playlist-quick-popup, #playlistPopup').forEach(n => n.remove());

      const popup = document.createElement('div');
      popup.id = 'playlistPopup';
      popup.innerHTML = `
        <h3>Create Playlist</h3>
        <input id="playlistNameInput" placeholder="Playlist name" value="${prefillName}">
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button id="cancelPlaylistBtn" style="background:transparent;border:1px solid rgba(255,255,255,0.06);padding:6px 10px;border-radius:8px;color:#fff">Cancel</button>
          <button id="savePlaylistBtn">Create</button>
        </div>
      `;
      document.body.appendChild(popup);

      document.getElementById('cancelPlaylistBtn').addEventListener('click', () => popup.remove());
      document.getElementById('savePlaylistBtn').addEventListener('click', () => {
        const name = document.getElementById('playlistNameInput').value.trim();
        if (!name) { alert('Enter playlist name'); return; }
        playlists.push({ id: Date.now(), name, songs: [] });
        savePlaylists();
        renderPlaylistsSection();
        popup.remove();
      });
    }

    // Small popup anchored to clicked button: choose playlist to add/remove
    function openAddToPlaylistPopup(songId, anchorEl) {
      // remove any old quick popup
      document.querySelectorAll('.playlist-quick-popup').forEach(n => n.remove());

      const rect = (anchorEl && anchorEl.getBoundingClientRect) ? anchorEl.getBoundingClientRect() : { top: 200, left: 200 };
      const p = document.createElement('div');
      p.className = 'playlist-quick-popup';
      p.style.position = 'fixed';
      p.style.minWidth = '220px';
      p.style.background = 'rgba(15,15,15,0.96)';
      p.style.padding = '8px';
      p.style.borderRadius = '10px';
      p.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
      p.style.zIndex = 99999;
      // position near anchor
      p.style.top = (rect.top + window.scrollY + (rect.height || 30) + 8) + 'px';
      p.style.left = Math.max(12, rect.left + window.scrollX - 20) + 'px';

      if (!playlists.length) {
        p.innerHTML = `<div style="color:var(--muted);padding:8px">No playlists yet.</div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button id="createNewFromPopup" style="background:var(--accent);border:none;padding:6px 10px;border-radius:8px;color:#000">Create</button>
          </div>`;
        document.body.appendChild(p);
        document.getElementById('createNewFromPopup').addEventListener('click', () => {
          p.remove();
          openCreatePlaylistPopup();
        });
        setTimeout(()=> document.addEventListener('click', outsideClosePopup), 0);
        return;
      }

      p.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Add to Playlist</div>
          <div class="playlist-list" style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;padding-right:4px"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button id="createNewFromPopup" style="background:transparent;border:1px solid rgba(255,255,255,0.06);padding:6px 10px;border-radius:8px;color:#fff">+ New</button>
          </div>`;
      document.body.appendChild(p);

      const listEl = p.querySelector('.playlist-list');
      playlists.forEach(pl => {
        const inPlaylist = (pl.songs || []).some(s => s.id === songId);
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '6px 8px';
        row.style.borderRadius = '8px';
        row.style.cursor = 'pointer';
        row.style.background = inPlaylist ? 'rgba(255,255,255,0.02)' : 'transparent';
        row.innerHTML = `<div style="display:flex;gap:8px;align-items:center">
                  <div style="width:40px;height:40px;border-radius:6px;overflow:hidden"><img src="${pl.songs && pl.songs[0] ? pl.songs[0].cover : 'covers/default.jpg'}" style="width:100%;height:100%;object-fit:cover"></div>
                  <div>
                    <div style="font-weight:600">${pl.name}</div>
                    <div style="font-size:12px;color:var(--muted)">${pl.songs.length} songs</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="pl-action" data-id="${pl.id}" style="background:transparent;border:1px solid rgba(255,255,255,0.04);padding:6px;border-radius:8px;color:#fff">${inPlaylist ? 'Remove' : 'Add'}</button>
                </div>`;
        listEl.appendChild(row);

        row.querySelector('.pl-action').addEventListener('click', (ev) => {
          ev.stopPropagation();
          const pid = Number(ev.currentTarget.getAttribute('data-id'));
          const playlist = playlists.find(x => x.id === pid);
          if (!playlist) return;
          const songObj = (window.SONGS || []).find(s => s.id === songId);
          if (!songObj) return alert('Song not found');

          const idx = (playlist.songs || []).findIndex(x => x.id === songId);
          if (idx === -1) {
            // add
            playlist.songs = playlist.songs || [];
            playlist.songs.push(songObj);
          } else {
            // remove
            playlist.songs.splice(idx, 1);
          }
          savePlaylists();
          renderPlaylistsSection();
          // update button text and row style
          ev.currentTarget.textContent = (idx === -1) ? 'Remove' : 'Add';
          row.style.background = (idx === -1) ? 'rgba(255,255,255,0.02)' : 'transparent';
        });
      });

      document.getElementById('createNewFromPopup').addEventListener('click', () => {
        p.remove();
        openCreatePlaylistPopup();
      });

      // close when clicking outside
      setTimeout(()=> document.addEventListener('click', outsideClosePopup), 0);

      function outsideClosePopup(e) {
        if (!p.contains(e.target)) {
          p.remove();
          document.removeEventListener('click', outsideClosePopup);
        }
      }
    }

    // Open playlist view (list of songs inside playlist), with remove option
    function openPlaylistView(pid) {
      const pl = playlists.find(x => x.id === pid);
      if (!pl) return;
      const overlay = document.createElement('div');
      overlay.id = 'overlay';
      document.body.appendChild(overlay);

      const expanded = document.createElement('div');
      expanded.className = 'category-expanded';
      expanded.innerHTML = `
        <button class="back-btn">← Back</button>
        <h3>${pl.name}</h3>
        <div id="playlistSongsContainer"></div>
      `;
      document.body.appendChild(expanded);

      const container = expanded.querySelector('#playlistSongsContainer');
      container.innerHTML = '';

      if (!pl.songs || pl.songs.length === 0) {
        container.innerHTML = `<div style="color:var(--muted);padding:10px">Playlist is empty.</div>`;
      } else {
        pl.songs.forEach(s => {
          const r = createSongRow(s);
          // attach remove-from-playlist button into song-menu if available
          const menu = r.querySelector('.song-menu');
          if (menu) {
            const btn = document.createElement('button');
            btn.textContent = 'Remove from Playlist';
            btn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              pl.songs = pl.songs.filter(x => x.id !== s.id);
              savePlaylists();
              renderPlaylistsSection();
              r.remove();
            });
            menu.appendChild(btn);
          } else {
            const rem = document.createElement('button');
            rem.textContent = 'Remove from Playlist';
            rem.addEventListener('click', () => {
              pl.songs = pl.songs.filter(x => x.id !== s.id);
              savePlaylists();
              renderPlaylistsSection();
              r.remove();
            });
            r.appendChild(rem);
          }
          container.appendChild(r);
        });
      }

      const closeView = () => {
        expanded.remove();
        overlay.remove();
      };
      const backBtn = expanded.querySelector('.back-btn');
      if (backBtn) backBtn.addEventListener('click', closeView);
      overlay.addEventListener('click', closeView);
    }

    // expose a few helpers globally (optional)
    window.PlaylistAPI = {
      openCreatePlaylistPopup,
      openAddToPlaylistPopup,
      renderPlaylistsSection
    };

    // connect create playlist button in your UI
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');
    if (createPlaylistBtn) {
      createPlaylistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCreatePlaylistPopup();
        // also show playlistSection (in case hidden)
        const ps = document.getElementById('playlistSection');
        if (ps) ps.style.display = 'block';
      });
    }

    // render initial state if user opens playlistSection
    renderPlaylistsSection();

  })(); // end playlist module

  // Shuffle / Loop controls
  const modeBtn = document.createElement('button');
  modeBtn.id = 'modeBtn';
  modeBtn.className = 'ctrl';
  modeBtn.textContent = '🔀';
  modeBtn.title = 'Shuffle Mode';
  if (nextBtn && nextBtn.parentNode) nextBtn.insertAdjacentElement('afterend', modeBtn);

  let isShuffle = true;
  let isLoop = false;

  modeBtn.addEventListener('click', () => {
    if (isShuffle) {
      isShuffle = false;
      isLoop = true;
      modeBtn.textContent = '🔁';
      modeBtn.title = 'Loop Mode';
      modeBtn.style.color = 'var(--accent)';
    } else {
      isShuffle = true;
      isLoop = false;
      modeBtn.textContent = '🔀';
      modeBtn.title = 'Shuffle Mode';
      modeBtn.style.color = 'var(--accent)';
    }
  });

  // Replace your existing "next" and "audio ended" logic with this:
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (isLoop) {
        loadCurrentAndPlay(); // repeat current song
      } else if (isShuffle) {
        currentIndex = Math.floor(Math.random() * SONGS.length);
        loadCurrentAndPlay();
      } else {
        if (currentIndex < SONGS.length - 1) currentIndex++;
        else currentIndex = 0;
        loadCurrentAndPlay();
      }
    });
  }

  audio.addEventListener('ended', () => {
    if (isLoop) {
      loadCurrentAndPlay();
    } else if (isShuffle) {
      currentIndex = Math.floor(Math.random() * SONGS.length);
      loadCurrentAndPlay();
    } else {
      if (nextBtn) nextBtn.click();
    }
  });

  // Sidebar toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

})(); // end main IIFE

// HOME button: use goHome so it restores and re-initializes properly
const homeBtn = document.getElementById("homeBtn");
if (homeBtn) homeBtn.addEventListener("click", goHome);

// goHome(): restore HTML and re-run init (via window.reinitHome)
function goHome() {
  const main = document.getElementById("mainContent");

  if (!main || !window.HOME_HTML) {
    window.location.reload();
    return;
  }

  main.innerHTML = window.HOME_HTML;

  // Re-run JS bindings (init)
  setTimeout(() => {
    if (typeof window.reinitHome === "function") {
      try { window.reinitHome(); } catch (err) { console.error("reinitHome error:", err); }
    }
  }, 10);
}

// UNIVERSAL BACK BUTTON FIX (handles center back and overlay back)
document.addEventListener("click", function (e) {
    // BACK button in center playlist view
    if (e.target && e.target.id === "backHomeBtn") {
        goHome();
        return;
    }

    // BACK for Favourites / Recent / Category overlays
    if (e.target && e.target.classList.contains("back-btn")) {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.getElementById("overlay");
        const expanded = document.querySelector(".category-expanded");
        if (overlay) overlay.remove();
        if (expanded) expanded.remove();
        return;
    }
});

///////////PROFILE
// 🟢 PROFILE PAGE (center view like playlist)
// -----------------------------
// USER AUTH SYSTEM (LocalStorage)
// -----------------------------

// Check if user is signed in
function isSignedIn() {
    return localStorage.getItem("sbUser") !== null;
}

// Save user data
function signInUser(name, email, phone) {
    const data = { name, email, phone };
    localStorage.setItem("sbUser", JSON.stringify(data));
}

// Get user data
function getUser() {
    return JSON.parse(localStorage.getItem("sbUser") || "{}");
}

// Logout user
function signOutUser() {
    localStorage.removeItem("sbUser");
}


// -----------------------------
// PROFILE PAGE HANDLER
// -----------------------------
const profileBtn = document.querySelector('[data-action="profile"]');

if (profileBtn) {
  profileBtn.addEventListener("click", () => {
    const main = document.getElementById("mainContent");

    // If user not signed in → show sign-in screen
    if (!isSignedIn()) {
      main.innerHTML = `
        <div class="section-head" style="display:flex;align-items:center;gap:10px;">
          <button id="backHomeBtn" class="link-btn" style="font-size:18px;">← Back</button>
          <h3 style="margin:0;">Sign In</h3>
        </div>

        <div class="login-box" style="
          max-width:400px;
          margin:30px auto;
          padding:25px;
          background:rgba(255,255,255,0.03);
          border-radius:15px;
          box-shadow:0 0 20px rgba(0,0,0,0.3);
        ">
          <h2 style="text-align:center;margin-bottom:20px;">Welcome Back</h2>

          <input id="loginName" placeholder="Full Name" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;">
          <input id="loginEmail" placeholder="Email" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;">
          <input id="loginPhone" placeholder="Phone Number" style="width:100%;padding:10px;margin-bottom:15px;border-radius:8px;">

          <button id="loginBtn" style="
            width:100%;padding:10px;background:var(--accent);
            border:none;border-radius:8px;font-weight:600;color:#000;
          ">Sign In</button>
        </div>
      `;

      // Handle login
      const loginBtn = document.getElementById("loginBtn");
      loginBtn.addEventListener("click", () => {
        const name = document.getElementById("loginName").value.trim();
        const email = document.getElementById("loginEmail").value.trim();
        const phone = document.getElementById("loginPhone").value.trim();

        if (!name || !email) {
          alert("Please enter your name and email.");
          return;
        }

        signInUser(name, email, phone);
        alert("Signed in successfully!");
        goHome();
      });

      return;
    }

    // If signed in → show profile page
    const user = getUser();

    main.innerHTML = `
      <div class="section-head" style="display:flex;align-items:center;gap:10px;">
        <button id="backHomeBtn" class="link-btn" style="font-size:18px;">← Back</button>
        <h3 style="margin:0;">Your Profile</h3>
      </div>

      <div class="profile-box" style="
        max-width:450px;
        margin:30px auto;
        padding:25px;
        background:rgba(255,255,255,0.03);
        border-radius:15px;
        text-align:center;
        box-shadow:0 0 20px rgba(0,0,0,0.3);
      ">

        <img src="https://i.pravatar.cc/200?u=${user.email}" 
        style="width:120px;height:120px;border-radius:50%;border:3px solid var(--accent);margin-bottom:15px;">

        <h2 style="margin:10px 0;font-size:25px;">${user.name}</h2>
        <p style="color:#bbb;margin:4px 0;font-size:15px;">${user.email}</p>
        <p style="color:#bbb;margin:4px 0;font-size:15px;">${user.phone || "Not added"}</p>

        <button id="logoutBtn" style="
          margin-top:20px;padding:10px 20px;
          background:#ff3355;border:none;border-radius:8px;
          font-weight:600;color:#fff;
        ">Log Out</button>

      </div>
    `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
      signOutUser();
      alert("Logged out!");
      goHome();
    });
  });
}
