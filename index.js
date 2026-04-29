/* ════════════════════════════════════════════════
   FootballPulse — app.js
   Final Draft: Polish + Additional Features
   ─────────────────────────────────────────────
   ✅ Database    : localStorage (read/write/delete)
   ✅ API         : apiFetch with retry + timeout
   ✅ New Feature : Global Search (press / to open)
   ✅ UX          : Skeleton loaders, scroll-to-top,
                    mobile nav, stagger animations,
                    section-aware filter bar
   ════════════════════════════════════════════════ */

const API_KEY = '1eca7010061fbd19130f8eeb7b3ef947'; 
const BASE_URL = 'https://v3.football.api-sports.io';
const HEADERS = { 'x-apisports-key': API_KEY };

// ══════════════════════════════════════════════
//  DATABASE LAYER (localStorage)
// ══════════════════════════════════════════════
const DB_KEY = 'footballpulse_favorites';

function dbGetAll() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
  catch { return []; }
}
function dbSave(item) {
  const all = dbGetAll();
  if (all.find(f => f.id == item.id && f.type === item.type)) return false;
  all.push({ ...item, savedAt: new Date().toISOString() });
  localStorage.setItem(DB_KEY, JSON.stringify(all));
  console.log('💾 Saved:', item.label, '| Total:', all.length);
  return true;
}
function dbRemove(id, type) {
  const updated = dbGetAll().filter(f => !(f.id == id && f.type === type));
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  console.log('🗑️ Removed id=' + id, '| Remaining:', updated.length);
}
function dbIsFav(id, type) {
  return dbGetAll().some(f => f.id == id && f.type === type);
}

// ══════════════════════════════════════════════
//  SEARCH INDEX (in-memory, built from API data)
// ══════════════════════════════════════════════
const searchIndex = { matches: [], teams: [], players: [] };

function indexMatches(fixtures) {
  searchIndex.matches = fixtures.map(f => ({
    id: f.fixture.id,
    type: 'match',
    label: `${f.teams.home.name} vs ${f.teams.away.name}`,
    sub: f.league.name,
    logo: f.teams.home.logo,
    meta: f.league.name,
    keywords: `${f.teams.home.name} ${f.teams.away.name} ${f.league.name}`.toLowerCase()
  }));
}
function indexTeams(data) {
  searchIndex.teams = data.map(({ team }) => ({
    id: team.id, type: 'team', label: team.name, sub: team.country,
    logo: team.logo, meta: team.country,
    keywords: `${team.name} ${team.country}`.toLowerCase()
  }));
}
function indexPlayers(data) {
  searchIndex.players = data.slice(0, 20).map(({ player, statistics }) => ({
    id: player.id, type: 'player', label: player.name,
    sub: `${statistics[0].team.name} · ${player.nationality}`,
    logo: player.photo, meta: statistics[0].team.name,
    keywords: `${player.name} ${statistics[0].team.name} ${player.nationality}`.toLowerCase()
  }));
}

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
let currentSection = 'matches';

function switchSection(name) {
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === name)
  );
  document.querySelectorAll('.content-section').forEach(s =>
    s.classList.toggle('active', s.id === 'section-' + name)
  );
  currentSection = name;
  if (name === 'matches')   loadFixtures();
  if (name === 'standings') loadStandings();
  if (name === 'teams')     loadTeams();
  if (name === 'players')   loadTopScorers();
  if (name === 'favorites') renderFavorites();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link =>
  link.addEventListener('click', () => switchSection(link.dataset.section))
);

document.getElementById('fetchBtn').addEventListener('click', () => {
  if (currentSection === 'matches')   loadFixtures();
  if (currentSection === 'standings') loadStandings();
  if (currentSection === 'teams')     loadTeams();
  if (currentSection === 'players')   loadTopScorers();
});

document.querySelectorAll('.section-tabs .tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.section-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadFixtures(i);
  });
});

// ── HELPERS ─────────────────────────────────────
const getLeague = () => document.getElementById('leagueSelect').value;
const getSeason = () => document.getElementById('seasonSelect').value;
const getDate   = () => document.getElementById('dateInput').value || new Date().toISOString().split('T')[0];

function showSkeletons(id, count = 3, height = null) {
  const c = document.getElementById(id);
  c.innerHTML = Array.from({ length: count }, () =>
    `<div class="skeleton-card"${height ? ` style="height:${height}px;border-radius:10px"` : ''}></div>`
  ).join('');
}
function showError(id, msg) {
  document.getElementById(id).innerHTML = `<div class="error-msg">⚠️ ${msg} <button class="btn-outline" style="margin-left:12px;font-size:12px" onclick="location.reload()">Retry</button></div>`;
  console.error('FootballPulse Error:', msg);
}

// ── API FETCH WITH RETRY + TIMEOUT ──────────────
async function apiFetch(endpoint, params = {}, retries = 2) {
  const url = new URL(BASE_URL + '/' + endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  console.log('📡 Fetching:', url.toString());

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.errors && Object.keys(data.errors).length) throw new Error(JSON.stringify(data.errors));
      console.log('✅ Response received (attempt ' + (attempt + 1) + ')');
      return data.response;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying…`, err.message);
      await new Promise(r => setTimeout(r, 800 * (attempt + 1))); // backoff
    }
  }
}

// ══════════════════════════════════════════════
//  FIXTURES
// ══════════════════════════════════════════════
async function loadFixtures(tabIndex = 0) {
  showSkeletons('fixtures-container', 3);
  document.querySelector('#section-matches .placeholder-notice')?.remove();
  try {
    const params = { league: getLeague(), season: getSeason() };
    if (tabIndex === 0)      { params.date = getDate(); }
    else if (tabIndex === 1) { params.status = 'NS'; params.from = getDate(); const n = new Date(); n.setDate(n.getDate()+7); params.to = n.toISOString().split('T')[0]; }
    else                     { params.status = 'FT-AET-PEN'; params.last = 10; }
    const fixtures = await apiFetch('fixtures', params);
    if (!fixtures.length) {
      document.getElementById('fixtures-container').innerHTML = '<div class="placeholder-notice">No matches found for this selection.</div>';
      return;
    }
    indexMatches(fixtures);
    renderFixtures(fixtures);
  } catch (err) { showError('fixtures-container', 'Could not load fixtures: ' + err.message); }
}

function renderFixtures(fixtures) {
  const c = document.getElementById('fixtures-container');
  c.innerHTML = '';
  fixtures.forEach((f, i) => {
    const home = f.teams.home, away = f.teams.away, score = f.goals, status = f.fixture.status;
    const isLive = ['1H','2H','HT','ET','BT','P','INT'].includes(status.short);
    const isFT   = ['FT','AET','PEN'].includes(status.short);
    const isNS   = status.short === 'NS';
    const kickoff = new Date(f.fixture.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const fid = f.fixture.id;
    const saved = dbIsFav(fid, 'match');

    let scoreHTML;
    if (isNS) { scoreHTML = `<span class="kickoff-time">${kickoff}</span>`; }
    else {
      const badge = isLive
        ? `<span class="live-badge">LIVE ${status.elapsed||''}'</span>`
        : `<span class="ft-badge">FT</span>`;
      scoreHTML = `<div class="score-row"><span class="score-value">${score.home??'–'}</span><span class="score-sep">–</span><span class="score-value">${score.away??'–'}</span></div>${badge}`;
    }

    const card = document.createElement('div');
    card.className = 'match-card';
    card.dataset.status = isLive ? 'live' : (isFT ? 'ft' : 'upcoming');
    card.style.animationDelay = (i * 0.05) + 's';
    card.innerHTML = `
      <div class="match-league">${f.league.flag ? `<img src="${f.league.flag}" style="width:14px;height:10px;display:inline;vertical-align:middle;margin-right:4px;" alt="">` : ''}${f.league.name} — ${(f.league.round||'').replace('Regular Season - ','')}</div>
      <div class="match-teams">
        <div class="team"><img src="${home.logo}" class="team-logo" alt="${home.name}" onerror="this.style.display='none'"><span class="team-name">${home.name}</span></div>
        <div class="match-score">${scoreHTML}</div>
        <div class="team away"><img src="${away.logo}" class="team-logo" alt="${away.name}" onerror="this.style.display='none'"><span class="team-name">${away.name}</span></div>
      </div>
      <div class="match-meta">
        <span>🏟 ${f.fixture.venue?.name||'TBD'}</span>
        <button class="btn-fav ${saved?'active':''}" data-id="${fid}" data-type="match" data-label="${home.name} vs ${away.name}" data-logo="${home.logo}" data-meta="${f.league.name}">${saved?'★ Saved':'☆ Save'}</button>
      </div>`;
    card.querySelector('.btn-fav').addEventListener('click', handleFavClick);
    c.appendChild(card);
  });
  console.log('🗓 Fixtures rendered:', fixtures.length);
}

// ══════════════════════════════════════════════
//  STANDINGS
// ══════════════════════════════════════════════
async function loadStandings() {
  const c = document.getElementById('standings-container');
  c.innerHTML = `<div class="loader"><div class="spinner"></div>LOADING STANDINGS…</div>`;
  try {
    const data = await apiFetch('standings', { league: getLeague(), season: getSeason() });
    if (!data?.length || !data[0].league?.standings?.length) {
      c.innerHTML = '<div class="placeholder-notice">No standings available.</div>'; return;
    }
    const rows = data[0].league.standings[0];
    let tbody = '';
    rows.forEach(r => {
      const zone = r.rank <= 4 ? 'champions' : (r.rank >= 18 ? 'relegation' : '');
      const form = (r.form||'').slice(-5).split('').map(ch => {
        const cls = ch==='W'?'form-w':ch==='D'?'form-d':'form-l';
        return `<span class="${cls}">${ch}</span>`;
      }).join('');
      tbody += `<tr class="standing-row ${zone}">
        <td class="pos">${r.rank}</td>
        <td class="club"><img src="${r.team.logo}" alt="${r.team.name}" onerror="this.style.display='none'">${r.team.name}</td>
        <td>${r.all.played}</td><td>${r.all.win}</td><td>${r.all.draw}</td><td>${r.all.lose}</td>
        <td>${r.all.goals.for}</td><td>${r.all.goals.against}</td>
        <td>${r.goalsDiff >= 0 ? '+' : ''}${r.goalsDiff}</td>
        <td class="pts">${r.points}</td>
        <td><div class="form">${form}</div></td>
      </tr>`;
    });
    c.innerHTML = `<div class="table-wrapper"><table class="standings-table">
      <thead><tr><th>#</th><th>Club</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead>
      <tbody>${tbody}</tbody></table></div>
      <div class="table-legend"><div class="leg champions">Champions League</div><div class="leg relegation">Relegation</div></div>`;
    console.log('📊 Standings rendered:', rows.length, 'teams');
  } catch (err) { showError('standings-container', 'Could not load standings: ' + err.message); }
}

// ══════════════════════════════════════════════
//  TEAMS
// ══════════════════════════════════════════════
async function loadTeams() {
  showSkeletons('teams-container', 6, 160);
  document.querySelector('#section-teams .placeholder-notice')?.remove();
  try {
    const data = await apiFetch('teams', { league: getLeague(), season: getSeason() });
    indexTeams(data);
    const c = document.getElementById('teams-container');
    c.innerHTML = '';
    data.forEach(({ team }, i) => {
      const saved = dbIsFav(team.id, 'team');
      const card = document.createElement('div');
      card.className = 'team-card';
      card.style.animationDelay = (i * 0.04) + 's';
      card.innerHTML = `<img src="${team.logo}" alt="${team.name}" onerror="this.style.display='none'"><h3>${team.name}</h3><p>${team.country}</p>
        <button class="btn-fav ${saved?'active':''}" data-id="${team.id}" data-type="team" data-label="${team.name}" data-logo="${team.logo}" data-meta="${team.country}" style="margin-top:4px;">${saved?'★ Saved':'☆ Save'}</button>`;
      card.querySelector('.btn-fav').addEventListener('click', handleFavClick);
      c.appendChild(card);
    });
    document.getElementById('teamSearch').oninput = e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.team-card').forEach(card => {
        card.style.display = card.querySelector('h3').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
    console.log('🛡️ Teams loaded:', data.length);
  } catch (err) { showError('teams-container', 'Could not load teams: ' + err.message); }
}

// ══════════════════════════════════════════════
//  PLAYERS
// ══════════════════════════════════════════════
async function loadTopScorers() {
  showSkeletons('players-container', 5, 76);
  document.querySelector('#section-players .placeholder-notice')?.remove();
  try {
    const data = await apiFetch('players/topscorers', { league: getLeague(), season: getSeason() });
    indexPlayers(data);
    const c = document.getElementById('players-container');
    c.innerHTML = '';
    data.slice(0, 20).forEach((entry, i) => {
      const p = entry.player, stats = entry.statistics[0];
      const saved = dbIsFav(p.id, 'player');
      const row = document.createElement('div');
      row.className = 'player-row';
      row.style.animationDelay = (i * 0.04) + 's';
      row.innerHTML = `
        <span class="player-rank">${i+1}</span>
        <img class="player-avatar" src="${p.photo}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/48'">
        <div class="player-info"><strong>${p.name}</strong><span>${stats.team.name} · ${p.nationality}</span></div>
        <div class="player-stats">
          <div class="stat-pill"><span>Goals</span><strong>${stats.goals.total??0}</strong></div>
          <div class="stat-pill"><span>Assists</span><strong>${stats.goals.assists??0}</strong></div>
          <div class="stat-pill"><span>Rating</span><strong>${parseFloat(stats.games.rating||0).toFixed(1)}</strong></div>
        </div>
        <button class="btn-fav ${saved?'active':''}" data-id="${p.id}" data-type="player" data-label="${p.name}" data-logo="${p.photo}" data-meta="${stats.team.name}" style="margin-left:8px;">${saved?'★':'☆'}</button>`;
      row.querySelector('.btn-fav').addEventListener('click', handleFavClick);
      c.appendChild(row);
    });
    document.getElementById('playerSearch').oninput = e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.player-row').forEach(row => {
        row.style.display = row.querySelector('strong').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
    console.log('👟 Players loaded:', data.length);
  } catch (err) { showError('players-container', 'Could not load players: ' + err.message); }
}

// ══════════════════════════════════════════════
//  FAVORITES — localStorage Read/Write
// ══════════════════════════════════════════════
function handleFavClick(e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const { id, type, label, logo, meta } = btn.dataset;
  if (dbIsFav(id, type)) {
    dbRemove(id, type);
    btn.classList.remove('active');
    btn.textContent = type === 'player' ? '☆' : '☆ Save';
    showToast('Removed: ' + label);
  } else {
    dbSave({ id, type, label, logo, meta });
    btn.classList.add('active');
    btn.textContent = type === 'player' ? '★' : '★ Saved';
    showToast('Saved: ' + label + ' ⭐');
  }
  if (currentSection === 'favorites') renderFavorites();
}

function renderFavorites() {
  const c = document.getElementById('favorites-container');
  document.querySelector('#section-favorites .placeholder-notice')?.remove();
  document.querySelector('.db-stats-bar')?.remove();

  const favs = dbGetAll();
  console.log('⭐ Rendering favorites:', favs.length, 'items');

  // Stats bar
  const statsBar = document.createElement('div');
  statsBar.className = 'db-stats-bar';
  statsBar.innerHTML = `
    <span class="db-stat"><strong>${favs.filter(f=>f.type==='match').length}</strong> Matches</span>
    <span class="db-stat"><strong>${favs.filter(f=>f.type==='team').length}</strong> Teams</span>
    <span class="db-stat"><strong>${favs.filter(f=>f.type==='player').length}</strong> Players</span>
    <span class="db-stat db-stat-storage">💾 ${new Blob([localStorage.getItem(DB_KEY)||'']).size} bytes</span>
    ${favs.length ? `<button class="btn-clear-all" id="clearAllBtn">🗑 Clear All</button>` : ''}
  `;
  c.before(statsBar);

  if (favs.length) {
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      if (confirm('Remove all favorites?')) {
        localStorage.removeItem(DB_KEY);
        document.querySelectorAll('.btn-fav.active').forEach(b => {
          b.classList.remove('active');
          b.textContent = b.dataset.type === 'player' ? '☆' : '☆ Save';
        });
        renderFavorites();
        showToast('All favorites cleared');
      }
    });
  }

  if (!favs.length) {
    c.innerHTML = `<div class="empty-favorites"><span>⭐</span><p>No favorites yet!</p><p style="margin-top:8px;font-size:12px;">Click <strong>☆ Save</strong> on any match, team, or player.</p></div>`;
    return;
  }

  const matches = favs.filter(f => f.type === 'match');
  const teams   = favs.filter(f => f.type === 'team');
  const players = favs.filter(f => f.type === 'player');
  let html = '';

  if (matches.length) {
    html += `<h3 style="font-family:var(--font-head);font-size:22px;letter-spacing:.05em;margin:16px 0 12px;color:var(--text-dim)">MATCHES</h3><div class="favorites-grid">`;
    matches.forEach(f => {
      html += `<div class="match-card" style="cursor:default;"><div class="match-league">⚽ ${f.meta}</div><div style="font-family:var(--font-head);font-size:18px;font-weight:700;padding:8px 0;">${f.label}</div><div class="match-meta"><span style="font-size:11px;color:var(--text-muted)">Saved ${new Date(f.savedAt).toLocaleDateString()}</span><button class="btn-fav active" data-id="${f.id}" data-type="${f.type}" data-label="${f.label}" data-logo="${f.logo||''}" data-meta="${f.meta||''}">★ Saved</button></div></div>`;
    });
    html += `</div>`;
  }
  if (teams.length) {
    html += `<h3 style="font-family:var(--font-head);font-size:22px;letter-spacing:.05em;margin:28px 0 12px;color:var(--text-dim)">TEAMS</h3><div class="teams-grid">`;
    teams.forEach(f => {
      html += `<div class="team-card" style="cursor:default;">${f.logo?`<img src="${f.logo}" alt="${f.label}" style="width:72px;height:72px;object-fit:contain;" onerror="this.style.display='none'">`:'<span style="font-size:40px;">🛡️</span>'}<h3>${f.label}</h3><p>${f.meta||''}</p><button class="btn-fav active" data-id="${f.id}" data-type="${f.type}" data-label="${f.label}" data-logo="${f.logo||''}" data-meta="${f.meta||''}" style="margin-top:4px;">★ Saved</button></div>`;
    });
    html += `</div>`;
  }
  if (players.length) {
    html += `<h3 style="font-family:var(--font-head);font-size:22px;letter-spacing:.05em;margin:28px 0 12px;color:var(--text-dim)">PLAYERS</h3><div class="players-list">`;
    players.forEach(f => {
      html += `<div class="player-row" style="cursor:default;"><span class="player-rank">⭐</span>${f.logo?`<img class="player-avatar" src="${f.logo}" alt="${f.label}" onerror="this.src='https://via.placeholder.com/48'">`:'<div class="player-avatar" style="background:var(--bg-3);display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div>'}<div class="player-info"><strong>${f.label}</strong><span>${f.meta||''}</span></div><div style="margin-left:auto;display:flex;align-items:center;gap:10px;"><span style="font-size:11px;color:var(--text-muted)">Saved ${new Date(f.savedAt).toLocaleDateString()}</span><button class="btn-fav active" data-id="${f.id}" data-type="${f.type}" data-label="${f.label}" data-logo="${f.logo||''}" data-meta="${f.meta||''}">★</button></div></div>`;
    });
    html += `</div>`;
  }

  c.innerHTML = html;
  c.querySelectorAll('.btn-fav').forEach(btn => btn.addEventListener('click', handleFavClick));
  console.log('📋 Favorites rendered:', favs.length);
}

// ══════════════════════════════════════════════
//  GLOBAL SEARCH — NEW FEATURE
// ══════════════════════════════════════════════
const searchOverlay   = document.getElementById('searchOverlay');
const searchInput     = document.getElementById('globalSearchInput');
const searchResults   = document.getElementById('searchResults');
const searchMeta      = document.getElementById('searchMeta');
const searchTrigger   = document.getElementById('searchTrigger');
const searchCloseBtn  = document.getElementById('searchCloseBtn');

let searchDebounce;

function openSearch() {
  searchOverlay.classList.add('open');
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchMeta.textContent = 'Start typing to search across all data';
  setTimeout(() => searchInput.focus(), 50);
}
function closeSearch() {
  searchOverlay.classList.remove('open');
  searchInput.blur();
}

searchTrigger.addEventListener('click', openSearch);
searchCloseBtn.addEventListener('click', closeSearch);
searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });

// Press "/" to open search
document.addEventListener('keydown', e => {
  if (e.key === '/' && !searchOverlay.classList.contains('open') && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault(); openSearch();
  }
  if (e.key === 'Escape') closeSearch();
});

function highlight(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<span class="search-highlight">$1</span>');
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runSearch, 200);
});

function runSearch() {
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) {
    searchResults.innerHTML = '';
    searchMeta.textContent = 'Start typing to search across all data';
    return;
  }

  const allItems = [
    ...searchIndex.matches,
    ...searchIndex.teams,
    ...searchIndex.players
  ];
  const results = allItems.filter(item => item.keywords.includes(q));

  const matchHits   = results.filter(r => r.type === 'match');
  const teamHits    = results.filter(r => r.type === 'team');
  const playerHits  = results.filter(r => r.type === 'player');
  const total = results.length;

  searchMeta.textContent = total
    ? `${total} result${total !== 1 ? 's' : ''} for "${q}"`
    : `No results for "${q}"`;

  if (!total) {
    searchResults.innerHTML = `<div class="search-empty">No matches, teams, or players found.<br><span style="font-size:12px;color:var(--text-muted)">Try loading data first (click Load Data), then search.</span></div>`;
    return;
  }

  let html = '';
  const renderGroup = (label, items, typeClass) => {
    if (!items.length) return;
    html += `<div class="search-result-group"><div class="search-result-group-label">${label}</div>`;
    items.slice(0, 6).forEach(item => {
      const isSaved = dbIsFav(item.id, item.type);
      html += `
        <div class="search-result-item" data-section="${item.type === 'match' ? 'matches' : item.type === 'team' ? 'teams' : 'players'}">
          <img src="${item.logo}" alt="${item.label}" onerror="this.style.display='none'">
          <div style="flex:1;min-width:0;">
            <div class="search-result-title">${highlight(item.label, q)}</div>
            <div class="search-result-sub">${item.sub}</div>
          </div>
          ${isSaved ? '<span style="color:var(--warn);font-size:14px" title="In favorites">★</span>' : ''}
          <span class="search-result-badge ${typeClass}">${typeClass}</span>
        </div>`;
    });
    html += `</div>`;
  };

  renderGroup('Matches', matchHits, 'match');
  renderGroup('Teams', teamHits, 'team');
  renderGroup('Players', playerHits, 'player');

  searchResults.innerHTML = html;
  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      switchSection(item.dataset.section);
      closeSearch();
    });
  });
}

// ══════════════════════════════════════════════
//  SCROLL-TO-TOP BUTTON
// ══════════════════════════════════════════════
const scrollTopBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });
scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
function showToast(msg) {
  document.querySelectorAll('.fp-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'fp-toast';
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--bg-3);border:1px solid var(--accent);color:var(--text);padding:12px 20px;border-radius:var(--radius);font-family:var(--font-head);font-size:14px;font-weight:600;letter-spacing:.05em;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:fpSlide .25s ease;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2500);
}
const sty = document.createElement('style');
sty.textContent = '@keyframes fpSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
document.head.appendChild(sty);

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
loadFixtures();
console.log('⚽ FootballPulse — Final Draft initialized');
console.log('📦 localStorage favorites on load:', dbGetAll());
console.log('💡 Tip: Press "/" to open Global Search');
