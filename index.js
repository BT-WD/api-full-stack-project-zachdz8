/* ════════════════════════════════════════════════
   FootballPulse — app.js
   Step 5: Database Integration via localStorage
   ─────────────────────────────────────────────
   DB Layer : localStorage key = 'footballpulse_favorites'
   Supports : matches, teams, players
   Operations: save, remove, read, isFav
   ════════════════════════════════════════════════ */

const API_KEY  = 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';
const HEADERS  = { 'X-RapidAPI-Key': API_KEY, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' };

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
  console.log('💾 Saved to localStorage:', item.label, '| Total saved:', all.length);
  return true;
}
function dbRemove(id, type) {
  const updated = dbGetAll().filter(f => !(f.id == id && f.type === type));
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  console.log('🗑️ Removed from localStorage id=' + id + ' | Remaining:', updated.length);
}
function dbIsFav(id, type) {
  return dbGetAll().some(f => f.id == id && f.type === type);
}

// ── STATE + NAV ─────────────────────────────────
let currentSection = 'matches';

document.querySelectorAll('.nav-link').forEach(link =>
  link.addEventListener('click', () => switchSection(link.dataset.section))
);

function switchSection(name) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === name));
  document.querySelectorAll('.content-section').forEach(s => s.classList.toggle('active', s.id === 'section-' + name));
  currentSection = name;
  if (name === 'matches')   loadFixtures();
  if (name === 'standings') loadStandings();
  if (name === 'teams')     loadTeams();
  if (name === 'players')   loadTopScorers();
  if (name === 'favorites') renderFavorites();
}

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

function showLoader(id) {
  document.getElementById(id).innerHTML = `<div class="loader"><div class="spinner"></div>LOADING DATA...</div>`;
}
function showError(id, msg) {
  document.getElementById(id).innerHTML = `<div class="error-msg">⚠️ ${msg}</div>`;
  console.error('FootballPulse Error:', msg);
}

async function apiFetch(endpoint, params = {}) {
  const url = new URL(BASE_URL + '/' + endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  console.log('📡 Fetching:', url.toString());
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  console.log('✅ Response received');
  if (data.errors && Object.keys(data.errors).length) throw new Error(JSON.stringify(data.errors));
  return data.response;
}

// ══════════════════════════════════════════════
//  FIXTURES
// ══════════════════════════════════════════════
async function loadFixtures(tabIndex = 0) {
  showLoader('fixtures-container');
  const notice = document.querySelector('#section-matches .placeholder-notice');
  if (notice) notice.remove();
  try {
    const params = { league: getLeague(), season: getSeason() };
    if (tabIndex === 0) { params.date = getDate(); }
    else if (tabIndex === 1) { params.status = 'NS'; params.from = getDate(); const n = new Date(); n.setDate(n.getDate()+7); params.to = n.toISOString().split('T')[0]; }
    else { params.status = 'FT-AET-PEN'; params.last = 10; }
    const fixtures = await apiFetch('fixtures', params);
    if (!fixtures.length) { document.getElementById('fixtures-container').innerHTML = '<div class="placeholder-notice">No matches found.</div>'; return; }
    renderFixtures(fixtures);
  } catch (err) { showError('fixtures-container', 'Could not load fixtures: ' + err.message); }
}

function renderFixtures(fixtures) {
  const c = document.getElementById('fixtures-container');
  c.innerHTML = '';
  fixtures.forEach(f => {
    const home = f.teams.home, away = f.teams.away, score = f.goals, status = f.fixture.status;
    const isLive = ['1H','2H','HT','ET','BT','P','INT'].includes(status.short);
    const isFT = ['FT','AET','PEN'].includes(status.short);
    const isNS = status.short === 'NS';
    const kickoff = new Date(f.fixture.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const fid = f.fixture.id;
    const saved = dbIsFav(fid, 'match');
    let scoreHTML;
    if (isNS) { scoreHTML = `<span class="kickoff-time">${kickoff}</span>`; }
    else {
      const badge = isLive ? `<span class="live-badge">LIVE ${status.elapsed||''}'</span>` : `<span class="ft-badge">FT</span>`;
      scoreHTML = `<div class="score-row"><span class="score-value">${score.home??'–'}</span><span class="score-sep">–</span><span class="score-value">${score.away??'–'}</span></div>${badge}`;
    }
    const card = document.createElement('div');
    card.className = 'match-card';
    card.dataset.status = isLive ? 'live' : (isFT ? 'ft' : 'upcoming');
    card.innerHTML = `
      <div class="match-league">${f.league.flag?`<img src="${f.league.flag}" style="width:14px;height:10px;display:inline;vertical-align:middle;margin-right:4px;">`:''}${f.league.name} — ${(f.league.round||'').replace('Regular Season - ','')}</div>
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
}

// ══════════════════════════════════════════════
//  STANDINGS
// ══════════════════════════════════════════════
async function loadStandings() {
  showLoader('standings-container');
  const notice = document.querySelector('#section-standings .placeholder-notice');
  if (notice) notice.remove();
  try {
    const data = await apiFetch('standings', { league: getLeague(), season: getSeason() });
    if (!data.length || !data[0].league?.standings) { document.getElementById('standings-container').innerHTML = '<tr><td colspan="11"><div class="placeholder-notice">No standings found.</div></td></tr>'; return; }
    const tbody = document.getElementById('standings-container');
    tbody.innerHTML = '';
    data[0].league.standings[0].forEach(team => {
      let rc = '';
      if (team.description?.toLowerCase().includes('champions')) rc = 'champions';
      if (team.description?.toLowerCase().includes('relegat'))   rc = 'relegation';
      const form = (team.form||'').split('').slice(-5).map(r => `<span class="${r==='W'?'form-w':r==='D'?'form-d':'form-l'}">${r}</span>`).join('');
      const tr = document.createElement('tr');
      tr.className = 'standing-row ' + rc;
      tr.innerHTML = `<td class="pos">${team.rank}</td><td class="club"><img src="${team.team.logo}" alt="${team.team.name}" onerror="this.style.display='none'">${team.team.name}</td><td>${team.all.played}</td><td>${team.all.win}</td><td>${team.all.draw}</td><td>${team.all.lose}</td><td>${team.all.goals.for}</td><td>${team.all.goals.against}</td><td>${team.goalsDiff>0?'+':''}${team.goalsDiff}</td><td class="pts">${team.points}</td><td><div class="form">${form}</div></td>`;
      tbody.appendChild(tr);
    });
    console.log('📊 Standings rendered');
  } catch (err) { showError('standings-container', 'Could not load standings: ' + err.message); }
}

// ══════════════════════════════════════════════
//  TEAMS
// ══════════════════════════════════════════════
async function loadTeams() {
  showLoader('teams-container');
  const notice = document.querySelector('#section-teams .placeholder-notice');
  if (notice) notice.remove();
  try {
    const data = await apiFetch('teams', { league: getLeague(), season: getSeason() });
    const c = document.getElementById('teams-container');
    c.innerHTML = '';
    data.forEach(({ team }) => {
      const saved = dbIsFav(team.id, 'team');
      const card = document.createElement('div');
      card.className = 'team-card';
      card.innerHTML = `<img src="${team.logo}" alt="${team.name}" onerror="this.style.display='none'"><h3>${team.name}</h3><p>${team.country}</p><button class="btn-fav ${saved?'active':''}" data-id="${team.id}" data-type="team" data-label="${team.name}" data-logo="${team.logo}" data-meta="${team.country}" style="margin-top:4px;">${saved?'★ Saved':'☆ Save'}</button>`;
      card.querySelector('.btn-fav').addEventListener('click', handleFavClick);
      c.appendChild(card);
    });
    document.getElementById('teamSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.team-card').forEach(card => {
        card.style.display = card.querySelector('h3').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    console.log('🛡️ Teams loaded:', data.length);
  } catch (err) { showError('teams-container', 'Could not load teams: ' + err.message); }
}

// ══════════════════════════════════════════════
//  PLAYERS
// ══════════════════════════════════════════════
async function loadTopScorers() {
  showLoader('players-container');
  const notice = document.querySelector('#section-players .placeholder-notice');
  if (notice) notice.remove();
  try {
    const data = await apiFetch('players/topscorers', { league: getLeague(), season: getSeason() });
    const c = document.getElementById('players-container');
    c.innerHTML = '';
    data.slice(0, 20).forEach((entry, i) => {
      const p = entry.player, stats = entry.statistics[0];
      const saved = dbIsFav(p.id, 'player');
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `<span class="player-rank">${i+1}</span><img class="player-avatar" src="${p.photo}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/48'"><div class="player-info"><strong>${p.name}</strong><span>${stats.team.name} · ${p.nationality}</span></div><div class="player-stats"><div class="stat-pill"><span>Goals</span><strong>${stats.goals.total??0}</strong></div><div class="stat-pill"><span>Assists</span><strong>${stats.goals.assists??0}</strong></div><div class="stat-pill"><span>Rating</span><strong>${parseFloat(stats.games.rating||0).toFixed(1)}</strong></div></div><button class="btn-fav ${saved?'active':''}" data-id="${p.id}" data-type="player" data-label="${p.name}" data-logo="${p.photo}" data-meta="${stats.team.name}" style="margin-left:8px;">${saved?'★':'☆'}</button>`;
      row.querySelector('.btn-fav').addEventListener('click', handleFavClick);
      c.appendChild(row);
    });
    document.getElementById('playerSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.player-row').forEach(row => {
        row.style.display = row.querySelector('strong').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    console.log('👟 Players loaded:', data.length);
  } catch (err) { showError('players-container', 'Could not load players: ' + err.message); }
}

// ══════════════════════════════════════════════
//  FAVORITES — Read/Write localStorage
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
  const notice = document.querySelector('#section-favorites .placeholder-notice');
  if (notice) notice.remove();
  // Remove previous stats bar if re-rendering
  document.querySelector('.db-stats-bar')?.remove();

  const favs = dbGetAll();
  console.log('⭐ Rendering favorites from localStorage:', favs.length, 'items', favs);

  // Show localStorage stats banner
  const statsBar = document.createElement('div');
  statsBar.className = 'db-stats-bar';
  statsBar.innerHTML = `
    <span class="db-stat"><strong>${favs.filter(f=>f.type==='match').length}</strong> Matches</span>
    <span class="db-stat"><strong>${favs.filter(f=>f.type==='team').length}</strong> Teams</span>
    <span class="db-stat"><strong>${favs.filter(f=>f.type==='player').length}</strong> Players</span>
    <span class="db-stat db-stat-storage">💾 ${new Blob([localStorage.getItem(DB_KEY)||'']).size} bytes in localStorage</span>
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
      html += `<div class="player-row" style="cursor:default;"><span class="player-rank">⭐</span>${f.logo?`<img class="player-avatar" src="${f.logo}" alt="${f.label}" onerror="this.src='https://via.placeholder.com/48'">`:'<div class="player-avatar" style="background:var(--bg-3);display:flex;align-items:center;justify-content:center;">👤</div>'}<div class="player-info"><strong>${f.label}</strong><span>${f.meta||''}</span></div><div style="margin-left:auto;display:flex;align-items:center;gap:10px;"><span style="font-size:11px;color:var(--text-muted)">Saved ${new Date(f.savedAt).toLocaleDateString()}</span><button class="btn-fav active" data-id="${f.id}" data-type="${f.type}" data-label="${f.label}" data-logo="${f.logo||''}" data-meta="${f.meta||''}">★</button></div></div>`;
    });
    html += `</div>`;
  }

  c.innerHTML = html;
  c.querySelectorAll('.btn-fav').forEach(btn => btn.addEventListener('click', handleFavClick));
  console.log('📋 Favorites dashboard rendered:', favs.length, 'items');
}

// ── TOAST ────────────────────────────────────────
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

// ── INIT ─────────────────────────────────────────
document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
loadFixtures();
console.log('⚽ FootballPulse Draft 4 initialized');
console.log('📦 localStorage favorites on load:', dbGetAll());
