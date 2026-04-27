/* ════════════════════════════════════════════════
   FootballPulse — app.js
   DRAFT 3: Async JS & API Calls
   Uses fetch() to call API-Football via RapidAPI
   ════════════════════════════════════════════════ */

// ── CONFIG ─────────────────────────────────────
// Replace with your actual RapidAPI key
const API_KEY  = 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';
const HEADERS  = {
  'X-RapidAPI-Key':  API_KEY,
  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
};

// ── STATE ───────────────────────────────────────
let currentSection = 'matches';

// ── NAVIGATION ─────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    const target = link.dataset.section;
    switchSection(target);
  });
});

function switchSection(name) {
  // Update nav
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === name)
  );
  // Update sections
  document.querySelectorAll('.content-section').forEach(s =>
    s.classList.toggle('active', s.id === `section-${name}`)
  );
  currentSection = name;

  // Auto-load data when switching
  if (name === 'matches')   loadFixtures();
  if (name === 'standings') loadStandings();
  if (name === 'teams')     loadTeams();
  if (name === 'players')   loadTopScorers();
  if (name === 'favorites') renderFavorites(); // Draft 4 will populate
}

// ── FETCH BUTTON ────────────────────────────────
document.getElementById('fetchBtn').addEventListener('click', () => {
  if (currentSection === 'matches')   loadFixtures();
  if (currentSection === 'standings') loadStandings();
  if (currentSection === 'teams')     loadTeams();
  if (currentSection === 'players')   loadTopScorers();
});

// ── TABS ────────────────────────────────────────
document.querySelectorAll('.section-tabs .tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.section-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadFixtures(i); // 0=today, 1=upcoming, 2=results
  });
});

// ── HELPERS ─────────────────────────────────────
function getLeague()  { return document.getElementById('leagueSelect').value; }
function getSeason()  { return document.getElementById('seasonSelect').value; }
function getDate()    {
  const d = document.getElementById('dateInput').value;
  return d || new Date().toISOString().split('T')[0];
}

function showLoader(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      LOADING DATA…
    </div>`;
}

function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  el.innerHTML = `<div class="error-msg">⚠️ ${msg}</div>`;
  // Log to console for teacher verification
  console.error('FootballPulse API Error:', msg);
}

// ── FETCH WRAPPER ───────────────────────────────
async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  console.log('📡 Fetching:', url.toString()); // Console log for teacher

  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — ${res.statusText}`);
  }

  const data = await res.json();
  console.log('✅ Response:', data); // Console log for teacher

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data.response;
}

// ══════════════════════════════════════════════
//  FIXTURES
// ══════════════════════════════════════════════
async function loadFixtures(tabIndex = 0) {
  showLoader('fixtures-container');

  // Remove the static placeholder notice
  const notice = document.querySelector('#section-matches .placeholder-notice');
  if (notice) notice.remove();

  try {
    const params = { league: getLeague(), season: getSeason() };

    if (tabIndex === 0) {
      // Today
      params.date = getDate();
    } else if (tabIndex === 1) {
      // Next 7 days upcoming
      params.status = 'NS'; // Not Started
      params.from   = getDate();
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      params.to = next7.toISOString().split('T')[0];
    } else {
      // Results — last 10
      params.status = 'FT-AET-PEN';
      params.last   = 10;
    }

    const fixtures = await apiFetch('fixtures', params);

    if (!fixtures.length) {
      document.getElementById('fixtures-container').innerHTML =
        '<div class="placeholder-notice">No matches found for this date. Try another date or league.</div>';
      return;
    }

    renderFixtures(fixtures);
  } catch (err) {
    showError('fixtures-container', `Could not load fixtures: ${err.message}`);
  }
}

function renderFixtures(fixtures) {
  const container = document.getElementById('fixtures-container');
  container.innerHTML = '';

  fixtures.forEach(f => {
    const home     = f.teams.home;
    const away     = f.teams.away;
    const score    = f.goals;
    const status   = f.fixture.status;
    const isLive   = ['1H','2H','HT','ET','BT','P','INT'].includes(status.short);
    const isFT     = ['FT','AET','PEN'].includes(status.short);
    const isNS     = status.short === 'NS';
    const elapsed  = status.elapsed;
    const kickoff  = new Date(f.fixture.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    const card = document.createElement('div');
    card.className = 'match-card';
    card.dataset.status   = isLive ? 'live' : (isFT ? 'ft' : 'upcoming');
    card.dataset.fixtureId = f.fixture.id;

    let scoreHTML;
    if (isNS) {
      scoreHTML = `<span class="kickoff-time">${kickoff}</span>`;
    } else {
      const badge = isLive
        ? `<span class="live-badge">LIVE ${elapsed || ''}'</span>`
        : `<span class="ft-badge">FT</span>`;
      scoreHTML = `
        <div class="score-row">
          <span class="score-value">${score.home ?? '–'}</span>
          <span class="score-sep">–</span>
          <span class="score-value">${score.away ?? '–'}</span>
        </div>
        ${badge}`;
    }

    card.innerHTML = `
      <div class="match-league">
        ${f.league.flag ? `<img src="${f.league.flag}" style="width:14px;height:10px;display:inline;vertical-align:middle;margin-right:4px;" alt="">` : ''}
        ${f.league.name} — GW ${f.league.round?.replace('Regular Season - ','')||''}
      </div>
      <div class="match-teams">
        <div class="team">
          <img src="${home.logo}" class="team-logo" alt="${home.name}" onerror="this.style.display='none'">
          <span class="team-name">${home.name}</span>
        </div>
        <div class="match-score">${scoreHTML}</div>
        <div class="team away">
          <img src="${away.logo}" class="team-logo" alt="${away.name}" onerror="this.style.display='none'">
          <span class="team-name">${away.name}</span>
        </div>
      </div>
      <div class="match-meta">
        <span>🏟 ${f.fixture.venue?.name || 'TBD'}</span>
        <button class="btn-fav" data-id="${f.fixture.id}" data-type="match"
          data-label="${home.name} vs ${away.name}">☆ Save</button>
      </div>`;

    // Attach fav listener (will save to localStorage in Draft 4)
    card.querySelector('.btn-fav').addEventListener('click', handleFavClick);
    container.appendChild(card);
  });
}

// ══════════════════════════════════════════════
//  STANDINGS
// ══════════════════════════════════════════════
async function loadStandings() {
  const tbody = document.getElementById('standings-container');
  showLoader('standings-container');

  // Remove static placeholder notice
  const notice = document.querySelector('#section-standings .placeholder-notice');
  if (notice) notice.remove();

  try {
    const data = await apiFetch('standings', {
      league: getLeague(),
      season: getSeason()
    });

    if (!data.length || !data[0].league?.standings) {
      tbody.innerHTML = '<tr><td colspan="11"><div class="placeholder-notice">No standings data found.</div></td></tr>';
      return;
    }

    const table = data[0].league.standings[0];
    renderStandings(table, data[0].league.standings.length);
  } catch (err) {
    showError('standings-container', `Could not load standings: ${err.message}`);
  }
}

function renderStandings(rows, totalGroups) {
  const tbody = document.getElementById('standings-container');
  tbody.innerHTML = '';

  rows.forEach(team => {
    const rank = team.rank;
    let rowClass = '';
    // Champions League zone (top 4 in most leagues)
    if (team.description?.toLowerCase().includes('champions')) rowClass = 'champions';
    if (team.description?.toLowerCase().includes('relegat'))   rowClass = 'relegation';

    // Build form string
    const formBadges = (team.form || '').split('').slice(-5).map(r => {
      const cls = r === 'W' ? 'form-w' : r === 'D' ? 'form-d' : 'form-l';
      return `<span class="${cls}">${r}</span>`;
    }).join('');

    const tr = document.createElement('tr');
    tr.className = `standing-row ${rowClass}`;
    tr.innerHTML = `
      <td class="pos">${rank}</td>
      <td class="club">
        <img src="${team.team.logo}" alt="${team.team.name}" onerror="this.style.display='none'">
        ${team.team.name}
      </td>
      <td>${team.all.played}</td>
      <td>${team.all.win}</td>
      <td>${team.all.draw}</td>
      <td>${team.all.lose}</td>
      <td>${team.all.goals.for}</td>
      <td>${team.all.goals.against}</td>
      <td>${team.goalsDiff > 0 ? '+' : ''}${team.goalsDiff}</td>
      <td class="pts">${team.points}</td>
      <td><div class="form">${formBadges}</div></td>`;
    tbody.appendChild(tr);
  });

  console.log(`📊 Standings loaded: ${rows.length} teams`);
}


//  TEAMS
async function loadTeams() {
  const container = document.getElementById('teams-container');
  showLoader('teams-container');

  const notice = document.querySelector('#section-teams .placeholder-notice');
  if (notice) notice.remove();

  try {
    const data = await apiFetch('teams', {
      league: getLeague(),
      season: getSeason()
    });

    if (!data.length) {
      container.innerHTML = '<div class="placeholder-notice">No teams found.</div>';
      return;
    }

    container.innerHTML = '';
    data.forEach(({ team, venue }) => {
      const card = document.createElement('div');
      card.className = 'team-card';
      card.innerHTML = `
        <img src="${team.logo}" alt="${team.name}" onerror="this.style.display='none'">
        <h3>${team.name}</h3>
        <p>${team.country}</p>`;
      container.appendChild(card);
    });

    console.log(`🛡️ Teams loaded: ${data.length} teams`);

    // Live search filter
    document.getElementById('teamSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.team-card').forEach(card => {
        card.style.display = card.querySelector('h3').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } catch (err) {
    showError('teams-container', `Could not load teams: ${err.message}`);
  }
}

// ══════════════════════════════════════════════
//  TOP SCORERS (Players)
// ══════════════════════════════════════════════
async function loadTopScorers() {
  const container = document.getElementById('players-container');
  showLoader('players-container');

  const notice = document.querySelector('#section-players .placeholder-notice');
  if (notice) notice.remove();

  try {
    const data = await apiFetch('players/topscorers', {
      league: getLeague(),
      season: getSeason()
    });

    if (!data.length) {
      container.innerHTML = '<div class="placeholder-notice">No player data found.</div>';
      return;
    }

    container.innerHTML = '';
    data.slice(0, 20).forEach((entry, i) => {
      const p     = entry.player;
      const stats = entry.statistics[0];
      const row   = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <span class="player-rank">${i + 1}</span>
        <img class="player-avatar" src="${p.photo}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/48'">
        <div class="player-info">
          <strong>${p.name}</strong>
          <span>${stats.team.name} · ${p.nationality}</span>
        </div>
        <div class="player-stats">
          <div class="stat-pill"><span>Goals</span><strong>${stats.goals.total ?? 0}</strong></div>
          <div class="stat-pill"><span>Assists</span><strong>${stats.goals.assists ?? 0}</strong></div>
          <div class="stat-pill"><span>Rating</span><strong>${parseFloat(stats.games.rating || 0).toFixed(1)}</strong></div>
        </div>`;
      container.appendChild(row);
    });

    console.log(`👟 Top scorers loaded: ${data.length} players`);

    // Live search filter
    document.getElementById('playerSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.player-row').forEach(row => {
        row.style.display = row.querySelector('strong').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  } catch (err) {
    showError('players-container', `Could not load players: ${err.message}`);
  }
}

// ── Placeholder for Draft 4's favorites ────────
function handleFavClick(e) {
  const btn = e.currentTarget;
  // Draft 4 will implement localStorage here
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? '★ Saved' : '☆ Save';
  console.log('⭐ Favorite toggled (localStorage coming in Draft 4):', btn.dataset.label);
}

function renderFavorites() {
  // Stub — will be fully implemented in Draft 4
  const container = document.getElementById('favorites-container');
  container.innerHTML = `
    <div class="placeholder-notice">
      <strong>⭐ Favorites coming in Draft 4</strong> — localStorage integration next.
    </div>`;
}

// ── INIT ────────────────────────────────────────
// Set today's date as default
document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];

// Load matches on page load
loadFixtures();

console.log('⚽ FootballPulse Draft 3 initialized — API calls active');

