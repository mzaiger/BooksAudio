"use strict";
const q = it => encodeURIComponent(`${it.title} ${it.author || ''}`.trim());
const L = {
  apple:   it => ({ l:'Apple Books', s:'Apple', d:'books.apple.com', u: it.url }),
  applepod:it => ({ l:'Apple Podcasts', s:'Apple', d:'podcasts.apple.com', u: it.url }),
  amazon:  it => ({ l:'Amazon', s:'Amazon', d:'amazon.com', u:`https://www.amazon.com/s?k=${q(it)}&i=stripbooks` }),
  amazonAu:it => ({ l:'Amazon', s:'Amazon', d:'amazon.com', u:`https://www.amazon.com/s?k=${q(it)}&i=audible` }),
  audible: it => ({ l:'Audible', s:'Audible', d:'audible.com', u:`https://www.audible.com/search?keywords=${q(it)}` }),
  goodreads:it=> ({ l:'Goodreads', s:'Goodreads', d:'goodreads.com', u:`https://www.goodreads.com/search?q=${q(it)}` }),
  gbooks:  it => ({ l:'Google Books', s:'Google', d:'books.google.com', u:`https://www.google.com/books?q=${q(it)}` }),
  spotify: it => ({ l:'Spotify', s:'Spotify', d:'spotify.com', u:`https://open.spotify.com/search/${q(it)}` }),
  ytpod:   it => ({ l:'YouTube', s:'YouTube', d:'youtube.com', u:`https://www.youtube.com/results?search_query=${encodeURIComponent((it.title||'') + ' podcast')}` }),
  amzmusic:it => ({ l:'Amazon Music', s:'Amazon', d:'music.amazon.com', u:`https://music.amazon.com/search/${q(it)}` }),
};
// Every tab shows its links on two lines of two (the full name on wide screens, a short name on phones)
const SOURCES = [
  { k:'books', l:'Books', imgClass:'books', hint:'Position on Apple’s Top Paid Books chart', empty:'books', metricName:'Apple Ranking',
    links:[[L.amazon, L.gbooks], [L.apple, L.goodreads]] },
  { k:'audiobooks', l:'Audio Books', imgClass:'audiobooks', hint:'Position on Apple’s Top Audiobooks chart', empty:'audio books', metricName:'Apple Ranking',
    links:[[L.audible, L.amazonAu], [L.apple, L.spotify]] },
  { k:'podcasts', l:'Podcasts', imgClass:'podcasts', hint:'Position on Apple’s Top Podcasts chart', empty:'podcasts', metricName:'Apple Ranking',
    links:[[L.applepod, L.spotify], [L.ytpod, L.amzmusic]] },
];
const MONTHS = [1, 2, 3, 6, 12, 0];   // 0 = All
const rankTip = () => months ? 'Rank among chart items launched in the last 12 months' : 'Rank on the current top 100 chart';
const $ = id => document.getElementById(id);
const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const pref = (k, f) => { try { return localStorage.getItem(k) ?? f; } catch { return f; } };
const setPref = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };
const fmtDate = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }) : '—';
const span = m => `${m} month${m === 1 ? '' : 's'}`;
const favIco = d => `<img class="ico" src="https://www.google.com/s2/favicons?domain=${esc(d)}&sz=64" alt="" width="20" height="20" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`;
function ago(iso) {
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '—';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  return min < 60 ? `${min}m ago` : min < 1440 ? `${Math.floor(min / 60)}h ago` : `${Math.floor(min / 1440)}d ago`;
}

let source = pref('ba_source', 'books'); if (!SOURCES.some(s => s.k === source)) source = 'books';
let months = parseInt(pref('ba_months', '3'), 10); if (!MONTHS.includes(months)) months = 3;
let layout = pref('ba_layout', 'tile') === 'rows' ? 'rows' : 'tile';
let sort = pref('ba_sort', 'rank') === 'date' ? 'date' : 'rank';
const favs = new Map((() => { try { return Object.entries(JSON.parse(pref('ba_favs', '{}'))); } catch { return []; } })());
const saveFavs = () => setPref('ba_favs', JSON.stringify(Object.fromEntries(favs)));
let lookup = new Map();
const store = {};
const expanded = new Set();
const favKey = it => `${source}:${it.id}`;

async function load(src, force) {
  if (!force && src in store) return store[src];
  try { const r = await fetch(`data/${src}.json`, { cache: force ? 'reload' : 'default' }); store[src] = r.ok ? await r.json() : null; }
  catch { store[src] = null; }
  return store[src];
}

const thumb = it => { const u = safeUrl(it.image); return u ? `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="thumb-fallback">No Image</div>'; };
const linkBtns = (it, S, cls) => S.links.map(g => `<div class="link-line">${g.map(f => f(it)).filter(x => safeUrl(x.u))
  .map(x => `<a class="${cls}" href="${esc(safeUrl(x.u))}" target="_blank" rel="noopener noreferrer" title="${esc(x.l)}">${favIco(x.d)}<span class="lbl"><span class="lf">${esc(x.l)}</span><span class="ls">${esc(x.s)}</span></span> <span>↗</span></a>`).join('')}</div>`).join('');
const sub = it => it.author ? `<p class="author">${esc(it.author)}</p>` : '';

function tileHtml(it, S) {
  const url = safeUrl(it.url), key = favKey(it), open = expanded.has(key);
  return `<article class="card">
    <div class="thumb-wrap ${S.imgClass}">${url ? `<a class="thumb-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${thumb(it)}</a>` : thumb(it)}
      <label class="fav-toggle" title="Favorite"><input type="checkbox" class="fav-input" data-key="${esc(key)}" ${favs.has(key) ? 'checked' : ''}><span class="fav-star">★</span></label>
      ${it.rank ? `<div class="rank-pill" title="${esc(rankTip())}">#${it.rank}</div>` : ''}
    </div>
    <div class="body">
      <p class="title">${esc(it.title)}</p>${sub(it)}
      <p class="desc${open ? '' : ' clamp'}">${esc(it.desc || 'No description provided.')}</p>
      <button class="more" type="button" data-more="${esc(key)}"${open ? '' : ' hidden'}>${open ? 'See less' : 'See more'}</button>
      <div class="links">${linkBtns(it, S, 'open-link')}</div>
      <div class="meta"><span>${esc(fmtDate(it.date))}</span><span><b>Apple #${esc(it.metric)}</b> chart</span></div>
    </div>
  </article>`;
}

function rowHtml(it, S) {
  const url = safeUrl(it.url), key = favKey(it);
  return `<div class="row-item">
    <span class="row-rank" title="${esc(rankTip())}">${it.rank ? '#' + it.rank : '—'}</span>
    <div class="row-thumb">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${thumb(it)}</a>` : thumb(it)}</div>
    <label class="row-fav" title="Favorite"><input type="checkbox" class="fav-input" data-key="${esc(key)}" ${favs.has(key) ? 'checked' : ''}><span class="fav-star">★</span></label>
    <span class="row-title">${esc(it.title)}<small>${esc(it.author || '')}</small></span>
    <span class="row-desc">${esc(it.desc || '—')}</span>
    <span class="row-date">${esc(fmtDate(it.date))}</span>
    <span class="row-metric">Apple #${esc(it.metric)}</span>
    <span class="row-links">${linkBtns(it, S, 'row-link')}</span>
  </div>`;
}

const rowsTableHtml = (list, S) => `<div class="rows-wrap"><div class="rows-table"><div class="rows-header-row"><span>Rank</span><span>Image</span><span></span><span>Name</span><span>Description</span><span>Launched</span><span>${esc(S.metricName)}</span><span>Links</span></div>${list.map(it => rowHtml(it, S)).join('')}</div></div>`;

function favEntries(items) {
  const live = new Map((items || []).map(it => [it.id, it]));
  const out = [];
  favs.forEach(snap => {
    if (snap.src !== source) return;
    const cur = live.get(snap.id);
    out.push(cur ? { ...snap, ...cur, rank: cur.ranks && cur.ranks[months] || 0 } : { ...snap, rank: 0 });
  });
  return out;
}

async function render() {
  const S = SOURCES.find(s => s.k === source), out = $('out');
  const d = await load(source);
  if (S.k !== source) return;
  $('lastUpdated').textContent = d && d.updated ? `Last updated: ${ago(d.updated)}` : 'Last updated: not yet';
  const items = d ? d.items : [];
  let list = items.filter(it => it.ranks && it.ranks[months]).map(it => ({ ...it, rank: it.ranks[months] }));
  list.sort((a, b) => a.rank - b.rank);
  if (sort === 'date') list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.rank - b.rank);
  const favList = favEntries(items);
  lookup = new Map([...favList, ...list].map(it => [favKey(it), it]));
  $('count').textContent = `${list.length} ${S.empty} ${months ? `launched in the last ${span(months)}` : 'on the current chart'} · ${S.hint.toLowerCase()}`;
  const emptyMsg = `<div class="empty" style="grid-column:1 / -1;">${!d || !items.length ? 'No data yet.' : 'Nothing in this window.'}</div>`;
  const head = n => `<div class="fav-box-header"><span class="fav-box-title">★ Favorites<span class="fav-box-count">(${n})</span></span><button class="clear-btn" type="button" data-clear>Clear</button></div>`;
  if (layout === 'rows') {
    const box = favList.length ? `<div class="rows-fav-section">${head(favList.length)}${rowsTableHtml(favList, S)}</div>` : '';
    out.innerHTML = box + (list.length ? rowsTableHtml(list, S) : emptyMsg);
  } else {
    const box = favList.length ? `<div class="fav-box" style="grid-column:span ${Math.min(favList.length, 3)};">${head(favList.length)}<div class="fav-box-items">${favList.map(it => tileHtml(it, S)).join('')}</div></div>` : '';
    out.innerHTML = `<div class="grid">${box}${list.length ? list.map(it => tileHtml(it, S)).join('') : emptyMsg}</div>`;
  }
  fitMore();
}

function fitMore() {
  document.querySelectorAll('.desc.clamp').forEach(p => {
    const b = p.nextElementSibling;
    if (b && b.classList.contains('more')) b.hidden = p.scrollHeight <= p.clientHeight + 1;
  });
}

function renderControls() {
  $('sources').innerHTML = SOURCES.map(s => `<button class="tab-btn${s.k === source ? ' active' : ''}" data-source="${s.k}" title="${esc(s.hint)}">${s.l}</button>`).join('');
  $('tabs').innerHTML = MONTHS.map(m => `<button class="tab-btn${m === months ? ' active' : ''}" data-months="${m}">${m ? span(m) : 'All'}</button>`).join('');
  document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b.dataset.layout === layout));
  document.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('active', b.dataset.sort === sort));
}

function setup() {
  $('sources').addEventListener('click', e => { const b = e.target.closest('[data-source]'); if (!b) return; source = b.dataset.source; setPref('ba_source', source); renderControls(); render(); });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-months]'); if (!b) return; months = parseInt(b.dataset.months, 10); setPref('ba_months', months); renderControls(); render(); });
  document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => { layout = b.dataset.layout; setPref('ba_layout', layout); renderControls(); render(); }));
  document.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { sort = b.dataset.sort; setPref('ba_sort', sort); renderControls(); render(); }));
  $('out').addEventListener('click', e => {
    if (e.target.closest('[data-clear]')) { [...favs].forEach(([k, v]) => { if (v.src === source) favs.delete(k); }); saveFavs(); render(); return; }
    const b = e.target.closest('[data-more]'); if (!b) return;
    const k = b.dataset.more, p = b.previousElementSibling, open = !expanded.has(k);
    open ? expanded.add(k) : expanded.delete(k);
    p.classList.toggle('clamp', !open);
    b.textContent = open ? 'See less' : 'See more';
  });
  $('out').addEventListener('change', e => {
    const i = e.target.closest('.fav-input'); if (!i) return;
    const key = i.dataset.key, it = lookup.get(key);
    if (i.checked && it) { const { rank, ...snap } = it; favs.set(key, { ...snap, src: source }); } else favs.delete(key);
    saveFavs(); render();
  });
  $('refreshBtn').addEventListener('click', async () => {
    const b = $('refreshBtn'); b.disabled = true; b.textContent = 'Refreshing…';
    await load(source, true); await render(); b.disabled = false; b.textContent = 'Refresh';
  });
  document.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.closest('#out') && !t.classList.contains('ico')) {
      const box = document.createElement('div'); box.className = 'thumb-fallback'; box.textContent = 'No Image'; t.replaceWith(box);
    }
  }, true);
  window.addEventListener('resize', fitMore);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMore);
}

(async function init() { setup(); renderControls(); await render(); })();
