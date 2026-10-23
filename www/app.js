/* Navora PWA v4 — TomTom map + live traffic, search, routing, voice nav (EN/BM/中文), live incidents, speed cameras,
   MET weather warnings, along-route POIs, smart re-route, community reports, emergency & privacy. No account, no tracking. */
let map, myPos = null, myMarker = null, watchId = null, myState = '';
let routes = [], activeIdx = 0, activeRoute = null, routeAlerts = [], destName = '';
let alerts = [], engineAlerts = [], liveIncidents = [], alertMarkers = {}, seenAlertIds = new Set();
let cameras = [], camMarkers = [], camWarned = new Set(), poiMarkers = [];
let metWarnings = [], metShown = false;
let navState = null, lastSpokenStep = {}, lastReroute = 0, rerouteTimer = null, lastStyleReload = Date.now();
const $ = s => document.querySelector(s);
const S = { voice: true, cam: true, showcam: true, tolls: false, chatty: 'all', autonight: true, fuel: 'ron95', cons: 7 };
let places = { home: null, work: null, favs: [], recent: [] }; try { Object.assign(places, JSON.parse(localStorage.getItem('nv_places') || '{}')); } catch (e) { }
const savePlaces = () => localStorage.setItem('nv_places', JSON.stringify(places));
let stops = [], departAt = null, fuelPrices = null, lastSpeedKmh = 0, parkingPrompted = false;
try { Object.assign(S, JSON.parse(localStorage.getItem('nv_settings') || '{}')); } catch (e) { }
const saveS = () => localStorage.setItem('nv_settings', JSON.stringify(S));

const TYPE_ICON = { jam:'🚗', accident:'💥', police:'👮', roadblock:'🚧', flood:'🌊', hazard:'⚠️', closure:'⛔', roadwork:'🔧', weather:'🌧️', event:'📢', camera:'📷', breakdown:'🚘', pothole:'🕳' };
const SEV_COLOR = { 1:'#2ecc71', 2:'#f5a623', 3:'#ff4d4f' };
const LL = p => [+(p.lat ?? p.latitude), +(p.lng ?? p.lon ?? p.longitude)];   // TomTom mixes {lat,lng} and {latitude,longitude}

/* ---------- startup probe: catch key / domain / network problems with a clear message ---------- */
async function probeKey() {
  try {
    const r = await fetch(`https://api.tomtom.com/map/1/tile/basic/main/0/0/0.pbf?key=${KR.TOMTOM_KEY}`);
    if (r.status === 200) return;
    const t = await r.text();
    if (/InvalidReferer/.test(t)) banner(`⚠️ Map key not allowed on ${location.hostname}. Add this domain in my.tomtom.com/keys. <a href="check.html">Run check</a>`);
    else if (r.status === 403 || r.status === 401) banner('⚠️ TomTom key rejected — check TOMTOM_KEY in config.js. <a href="check.html">Run check</a>');
    else if (r.status === 429) banner('⚠️ TomTom daily free quota exceeded — map resumes tomorrow.');
  } catch (e) { banner('⚠️ No internet connection — map needs data to load.'); }
}
function banner(html) { let b = $('#sys-banner'); if (!b) { b = document.createElement('div'); b.id = 'sys-banner'; document.body.appendChild(b); } b.innerHTML = html; b.classList.remove('hidden'); }

/* ---------- map views ---------- */
let view = localStorage.getItem('nv_view') || 'day';
function autoNight() { if (!S.autonight || view === 'sat') return; const h = new Date().getHours(); const want = (h >= 19 || h < 7) ? 'night' : 'day'; if (want !== view) applyView(want); }
const VIEWS = ['day', 'night', 'sat'];
function styleUrl(v, driving) {
  const m = v === 'sat' ? 'basic_street-satellite' : v === 'night' ? ('basic_street-dark' + (driving ? '-driving' : '')) : ('basic_street-light' + (driving ? '-driving' : ''));
  const t = v === 'night' ? 'dark' : 'light';
  return `https://api.tomtom.com/style/1/style/22.2.1-*?map=2/${m}&traffic_incidents=2/incidents_${t}&traffic_flow=2/flow_relative-${t}&poi=2/poi_${t}&key=${KR.TOMTOM_KEY}`;
}
function applyView(v) {
  view = v; localStorage.setItem('nv_view', v);
  $('#btn-view').textContent = v === 'sat' ? '🛰' : v === 'night' ? '🌙' : '☀️';
  document.body.classList.toggle('night', v === 'night');
  map.setStyle(styleUrl(v, !!navState));
}
function cycleView() { applyView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]); }
function ensureRouteLayers() {
  if (map.getSource('routes')) return;
  map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'routes-alt', type: 'line', source: 'routes', filter: ['!=', ['get', 'active'], true], paint: { 'line-color': '#7b8aa8', 'line-width': 6, 'line-opacity': .8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  map.addLayer({ id: 'routes-active', type: 'line', source: 'routes', filter: ['==', ['get', 'active'], true], paint: { 'line-color': view === 'night' ? '#4d8dff' : '#1a5cff', 'line-width': 8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  drawRoutes();
}
function refreshTraffic() {   // force traffic tiles to re-download (TomTom refreshes every ~2 min)
  let hit = 0;
  try { const c = (map.style && (map.style.sourceCaches || map.style._sourceCaches)) || {}; Object.keys(c).forEach(id => { if (/flow|incident|traffic/i.test(id)) { c[id].clearTiles(); c[id].update(map.transform); hit++; } }); if (hit) map.triggerRepaint(); } catch (e) { hit = 0; }
  if (!hit && !navState && Date.now() - lastStyleReload > 300000) { lastStyleReload = Date.now(); map.setStyle(styleUrl(view, false)); }
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyI18n(); bindUI(); setupSearch();
  if (!KR.TOMTOM_KEY || KR.TOMTOM_KEY.startsWith('YOUR_')) toast('TomTom key missing — edit config.js');
  if (typeof tt === 'undefined') { toast('Map failed to load — check your internet connection'); return; }
  try {
    map = tt.map({ key: KR.TOMTOM_KEY, container: 'map', center: [KR.DEFAULT_CENTER.lng, KR.DEFAULT_CENTER.lat], zoom: KR.DEFAULT_ZOOM,
      style: styleUrl(view, false), stylesVisibility: { trafficFlow: true, trafficIncidents: true, poi: true }, dragRotate: false, touchPitch: false });
  } catch (e) { toast('Map error: ' + e.message); return; }
  $('#btn-view').textContent = view === 'sat' ? '🛰' : view === 'night' ? '🌙' : '☀️';
  document.body.classList.toggle('night', view === 'night');
  map.on('style.load', ensureRouteLayers);
  map.on('error', e => { const m = (e && e.error && e.error.message) || ''; if (/403|401|Forbidden|Unauthorized/i.test(m)) toast('Map key rejected — check TOMTOM_KEY in config.js'); });
  map.on('load', () => {
    ensureRouteLayers();
    map.on('click', 'routes-alt', e => selectRoute(e.features[0].properties.idx));
    map.on('moveend', () => { if (!navState) { loadAlerts(); loadIncidents(); } drawCameras(); });
    loadIncidents(); loadCameras();
  });
  probeKey(); renderQuick(); loadFuel(); autoNight(); setInterval(autoNight, 600000);
  if (window.NATIVE) { NATIVE.initPush(); document.body.classList.add('native'); }
  locate(true); loadAlerts(); loadMet();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadIncidents(); loadAlerts(); refreshTraffic(); } });   // refresh when user returns to the app
  setInterval(loadAlerts, KR.ALERT_REFRESH_MS); setInterval(loadIncidents, 60000); setInterval(refreshTraffic, 120000); setInterval(loadMet, 600000);
  if ('serviceWorker' in navigator && !window.NATIVE) navigator.serviceWorker.register('sw.js').catch(() => {});
});

function bindUI() {
  $('#btn-locate').onclick = () => locate(true);
  $('#btn-view').onclick = cycleView;
  $('#btn-clear').onclick = clearRoute;
  $('#btn-go').onclick = startNav;
  $('#btn-stop').onclick = stopNav;
  $('#btn-3d').onclick = () => { const p = map.getPitch() > 10 ? 0 : 55; map.easeTo({ pitch: p }); $('#btn-3d').textContent = p ? '2D' : '3D'; };
  $('#btn-mute').onclick = () => { S.voice = !S.voice; saveS(); $('#btn-mute').textContent = S.voice ? '🔊' : '🔇'; $('#s-voice').checked = S.voice; if (!S.voice) speechSynthesis.cancel(); };
  $('#btn-share').onclick = shareEta;
  $('#btn-report').onclick = () => openSheet('#report-sheet');
  $('#report-cancel').onclick = () => closeSheets();
  document.querySelectorAll('.report-grid button').forEach(b => b.onclick = () => sendReport(b.dataset.type));
  document.querySelectorAll('.rc-tools button[data-q]').forEach(b => b.onclick = () => searchAlong(b.dataset.q, b.textContent.trim()));
  $('#btn-menu').onclick = () => { renderFeed(); openSheet('#feed-sheet'); };
  $('#feed-close').onclick = closeSheets;
  $('#m-settings').onclick = () => openSheet('#settings-sheet');
  $('#m-sos').onclick = () => openSheet('#sos-sheet');
  $('#m-privacy').onclick = () => openSheet('#privacy-sheet');
  document.querySelectorAll('.close-sheet').forEach(b => b.onclick = closeSheets);
  $('#sos-loc').onclick = () => { if (!myPos) return toast(T('no_gps')); const t = `https://www.google.com/maps?q=${myPos.lat.toFixed(5)},${myPos.lng.toFixed(5)}`; (navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t)).then(() => toast(T('copied'))).catch(() => {}); };
  // settings
  $('#lang').value = LANG; $('#lang').onchange = e => { LANG = e.target.value; localStorage.setItem('nv_lang', LANG); applyI18n(); if (activeRoute) routeTo(activeRoute.dest, destName); };
  $('#s-voice').checked = S.voice; $('#s-voice').onchange = e => { S.voice = e.target.checked; saveS(); $('#btn-mute').textContent = S.voice ? '🔊' : '🔇'; };
  $('#s-cam').checked = S.cam; $('#s-cam').onchange = e => { S.cam = e.target.checked; saveS(); };
  $('#s-showcam').checked = S.showcam; $('#s-showcam').onchange = e => { S.showcam = e.target.checked; saveS(); drawCameras(); };
  $('#s-tolls').checked = S.tolls; $('#tolls').checked = S.tolls;
  const tollsChange = e => { S.tolls = e.target.checked; saveS(); $('#s-tolls').checked = S.tolls; $('#tolls').checked = S.tolls; if (activeRoute) routeTo(activeRoute.dest, destName); };
  $('#s-tolls').onchange = tollsChange; $('#tolls').onchange = tollsChange;
  $('#btn-mute').textContent = S.voice ? '🔊' : '🔇';
  $('#s-chatty').value = S.chatty; $('#s-chatty').onchange = e => { S.chatty = e.target.value; saveS(); };
  $('#s-autonight').checked = S.autonight; $('#s-autonight').onchange = e => { S.autonight = e.target.checked; saveS(); autoNight(); };
  $('#s-fuel').value = S.fuel; $('#s-fuel').onchange = e => { S.fuel = e.target.value; saveS(); if (activeRoute) showRouteCard(); renderFuel(); };
  $('#s-cons').value = S.cons; $('#s-cons').onchange = e => { S.cons = +e.target.value || 7; saveS(); if (activeRoute) showRouteCard(); };
  $('#btn-plan').onclick = () => { const d = new Date(Date.now() + 3600000); d.setMinutes(0); $('#plan-time').value = d.toISOString().slice(0, 16).replace('T', 'T'); $('#plan-result').textContent = ''; openSheet('#plan-sheet'); };
  $('#plan-go').onclick = async () => { const v = $('#plan-time').value; if (!v || !activeRoute) return; departAt = new Date(v); await routeTo(activeRoute.dest, destName); closeSheets(); };
  $('#plan-now').onclick = async () => { departAt = null; if (activeRoute) await routeTo(activeRoute.dest, destName); closeSheets(); };
  $('#btn-fav').onclick = () => { if (!activeRoute) return; openSheet('#fav-sheet'); };
  $('#btn-parking').onclick = () => findParking();
  $('#btn-mic').onclick = voiceReport;
  $('#btn-talk').onclick = () => VA.ask();
  $('#s-wake').checked = localStorage.getItem('nv_wake') === '1'; $('#s-wake').disabled = !VA.supported();
  $('#s-wake').onchange = e => { e.target.checked ? VA.start() : VA.stop(); };
  if (localStorage.getItem('nv_wake') === '1' && VA.supported()) setTimeout(() => VA.start(), 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && VA.enabled && VA.mode === 'idle') VA.listen('wake'); });
  $('#search').addEventListener('focus', () => { if (!activeRoute) renderQuick(true); });
}
function openSheet(id) { closeSheets(); $(id).classList.remove('hidden'); }
function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); }

/* ---------- search ---------- */
function setupSearch() {
  const inp = $('#search'), box = $('#suggest'); let t;
  inp.addEventListener('input', () => {
    clearTimeout(t); const q = inp.value.trim();
    if (q.length < 3) { box.classList.add('hidden'); return; }
    t = setTimeout(async () => {
      try {
        const res = await searchPlaces(q, 7);
        box.innerHTML = res.map((p, i) => `<div data-i="${i}"><b>${esc(p.name)}</b><small>${esc(p.addr || '')}${p.src === 'osm' ? ' · OSM' : ''}</small></div>`).join('');
        box.classList.toggle('hidden', !res.length);
        box.querySelectorAll('div[data-i]').forEach(d => d.onclick = () => {
          const p = res[+d.dataset.i]; box.classList.add('hidden');
          inp.value = p.name; inp.blur();
          routeTo({ lat: p.lat, lng: p.lng }, p.name);
        });
      } catch (e) { box.classList.add('hidden'); }
    }, 300);
  });
  inp.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 200));
}

/* ---------- location ---------- */
function onPos(p, center) {
  if (!p || !p.coords || isNaN(+p.coords.latitude)) return;
  const first = !myPos;
  myPos = { lat: +p.coords.latitude, lng: +p.coords.longitude, heading: p.coords.heading, speed: p.coords.speed };
  drawMe(); if (navState) navTick(); if (!myState) resolveState();
  if (center || first) { try { map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 }); } catch (e) { } }
  if (first && typeof pendingRoute === 'function') { const f = pendingRoute; pendingRoute = null; f(); }
}
let pendingRoute = null;
function locate(center) {
  // 1) Web geolocation (works in browsers AND inside the Capacitor WebView; usually gives a quick network fix)
  if (navigator.geolocation && watchId === null) {
    watchId = navigator.geolocation.watchPosition(p => onPos(p), () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
    navigator.geolocation.getCurrentPosition(p => onPos(p, center), () => {}, { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 });
  }
  // 2) Native GPS via Capacitor in the app (keeps working with the screen off while navigating)
  if (window.NATIVE && !window.nativeWatch) {
    window.nativeWatch = 'pending';
    NATIVE.watchPosition(p => onPos(p), () => {}).then(id => { window.nativeWatch = id || 'failed'; }).catch(() => { window.nativeWatch = 'failed'; });
    NATIVE.getPosition && NATIVE.getPosition().then(p => onPos(p, center)).catch(() => {});
  }
  if (center && myPos) map.flyTo({ center: [myPos.lng, myPos.lat], zoom: 15 });
  if (!myPos) { clearTimeout(window.gpsWarn); window.gpsWarn = setTimeout(() => { if (!myPos) toast('Turn on location (GPS) to use Navora'); }, 25000); }
}
function drawMe() {
  if (!myPos) return;
  if (!myMarker) { const el = document.createElement('div'); el.className = 'me-marker'; myMarker = new tt.Marker({ element: el }).setLngLat([myPos.lng, myPos.lat]).addTo(map); }
  myMarker.setLngLat([myPos.lng, myPos.lat]);
}
async function resolveState() {   // which state am I in → used to pick relevant MET warnings
  myState = '…';
  try { const r = await tt.services.reverseGeocode({ key: KR.TOMTOM_KEY, position: [myPos.lng, myPos.lat] }); myState = (r.addresses[0].address.countrySubdivision || '').replace(/^Wilayah Persekutuan /i, ''); showMet(); } catch (e) { myState = ''; }
}

/* ---------- routing ---------- */
function routeOpts() { return { key: KR.TOMTOM_KEY, travelMode: 'car', traffic: true, computeTravelTimeFor: 'all', avoid: S.tolls ? 'tollRoads' : undefined, sectionType: 'tollRoad' }; }
async function routeTo(dest, name) {
  if (!myPos) { toast(T('no_gps')); pendingRoute = () => routeTo(dest, name); locate(false); return; }
  if (!dest || isNaN(+dest.lat) || isNaN(+dest.lng)) { toast('Could not locate that place'); return; }
  destName = name || destName; clearPois();
  try {
    const locs = [[myPos.lng, myPos.lat], ...stops.map(st => [st.lng, st.lat]), [dest.lng, dest.lat]];
    const r = await tt.services.calculateRoute({ ...routeOpts(), locations: locs, maxAlternatives: stops.length ? 0 : 2, instructionsType: 'text', language: LANG, routeType: 'fastest', departAt: departAt && departAt > new Date() ? departAt.toISOString() : undefined });
    routes = (r.routes || []).map((rt, i) => ({
      idx: i, dest,
      path: rt.legs.flatMap(l => l.points.map(LL)).filter(q => !isNaN(q[0]) && !isNaN(q[1])),
      secs: rt.summary.travelTimeInSeconds, meters: rt.summary.lengthInMeters, delay: rt.summary.trafficDelayInSeconds || 0,
      toll: (rt.sections || []).some(s => s.sectionType === 'TOLL_ROAD'),
      tollMeters: (rt.sections || []).filter(s => s.sectionType === 'TOLL_ROAD').reduce((m, sec) => m + segLen(rt, sec), 0),
      steps: (rt.guidance && rt.guidance.instructions || []).map(s => { const [la, ln] = LL(s.point || {}); return { text: s.combinedMessage || s.message, short: s.message, lat: la, lng: ln, maneuver: s.maneuver || '', offset: s.routeOffsetInMeters || 0, sign: s.signpostText || '' }; }).filter(q => !isNaN(q.lat))
    }));
    if (!routes.length) { toast('No route found'); return; }
    routes.forEach(rt => { rt.alerts = alertsOnRoute(rt); rt.score = rt.secs + rt.alerts.reduce((s, a) => s + (a.severity === 3 ? 900 : a.severity === 2 ? 300 : 60), 0); });
    const best = routes.reduce((b, rt) => rt.score < b.score ? rt : b, routes[0]).idx;
    drawRoutes(); selectRoute(best); camWarned.clear(); parkingPrompted = false;
    addRecent(dest, destName); $('#quick').classList.add('hidden');
    if (!navState) { const b = new tt.LngLatBounds(); routes[best].path.forEach(p => b.extend([p[1], p[0]])); map.fitBounds(b, { padding: { top: 90, bottom: 300, left: 40, right: 40 } }); }
  } catch (e) { toast('Route failed: ' + (e.message || e)); }
}
function segLen(rt, sec) { const pts = rt.legs.flatMap(l => l.points.map(LL)); let m = 0; for (let i = sec.startPointIndex; i < Math.min(sec.endPointIndex, pts.length - 1); i++) m += hav(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); return m; }
function tripCost(rt) {
  if (S.fuel === 'ev') return '';
  const price = fuelPrices && fuelPrices[S.fuel]; if (!price) return '';
  const litres = rt.meters / 1000 * S.cons / 100; return `⛽ RM${(litres * price).toFixed(2)} ${T('fuel_cost')} (${litres.toFixed(1)} L × RM${price})`;
}
function drawRoutes() {
  const fc = { type: 'FeatureCollection', features: routes.map(rt => ({ type: 'Feature', properties: { idx: rt.idx, active: rt.idx === activeIdx }, geometry: { type: 'LineString', coordinates: rt.path.map(p => [p[1], p[0]]) } })) };
  if (map.getSource('routes')) map.getSource('routes').setData(fc);
}
function selectRoute(i) { activeIdx = i; activeRoute = routes[i]; drawRoutes(); showRouteCard(); }
function alertsOnRoute(rt) { return alerts.filter(a => a.lat && a.lng && distToPath(a.lat, a.lng, rt.path) <= KR.ROUTE_ALERT_RADIUS_M); }
function showRouteCard() {
  const rt = activeRoute; routeAlerts = rt.alerts = alertsOnRoute(rt);
  const base = departAt && departAt > new Date() ? departAt.getTime() : Date.now();
  const eta2 = new Date(base + rt.secs * 1000);
  $('#rc-eta').textContent = fmtDur(rt.secs) + ' · ' + T('arrive') + ' ' + fmtTime(eta2) + (departAt && departAt > new Date() ? ' (' + T('leaving_at') + ' ' + fmtTime(departAt) + ')' : '');
  $('#rc-stops').innerHTML = stops.length ? stops.map((st, i) => `<span class="stop-chip">${i + 1}. ${esc(st.name)} <b onclick="removeStop(${i})">✕</b></span>`).join('') : '';
  $('#rc-cost').textContent = [tripCost(rt), rt.tollMeters > 500 ? `🎫 ${(rt.tollMeters / 1000).toFixed(0)} km ${T('toll').toLowerCase()}` : ''].filter(Boolean).join(' · ');
  $('#btn-fav').textContent = isFav(rt.dest) ? '★' : '☆';
  $('#rc-meta').textContent = `${(rt.meters / 1000).toFixed(1)} km · ${destName}` + (rt.delay > 60 ? ` · +${Math.round(rt.delay / 60)} ${T('min')} ${T('traffic')}` : '') + (rt.toll ? ' · 🎫 ' + T('toll') : ' · ' + T('no_toll')) + (routeAlerts.length ? ` · ${routeAlerts.length} ${T('alerts_on_route')}` : ' · ' + T('route_clear'));
  $('#rc-routes').innerHTML = routes.length > 1 ? routes.map(r => `<button class="rt-pill ${r.idx === activeIdx ? 'on' : ''}" onclick="selectRoute(${r.idx})">${fmtDur(r.secs)} · ${(r.meters / 1000).toFixed(0)} km${r.toll ? ' · 🎫' : ''}${r.alerts.length ? ' · ⚠️' + r.alerts.length : ''}</button>`).join('') : '';
  $('#rc-alerts').innerHTML = routeAlerts.map(a => `<div class="alert-chip sev-${a.severity}">${TYPE_ICON[a.type] || '⚠️'} ${esc(a.title)}<small>${esc(a.road || '')} ${a.direction ? '· ' + esc(a.direction) : ''}${a.eta_clear ? ' · ' + esc(a.eta_clear) : ''} · ${esc(a.source)}</small></div>`).join('');
  $('#route-card').classList.remove('hidden');
}
function clearRoute() { routes = []; activeRoute = null; routeAlerts = []; stops = []; departAt = null; drawRoutes(); clearPois(); $('#route-card').classList.add('hidden'); $('#search').value = ''; renderQuick(); }

/* ---------- along-route POIs (petrol, R&R, EV, food, surau, toilets) ---------- */
async function searchAlong(q, label) {
  if (!activeRoute) return; clearPois();
  try {
    const step = Math.max(1, Math.ceil(activeRoute.path.length / 100));
    const pts = activeRoute.path.filter((_, i) => i % step === 0).map(p => [p[1], p[0]]);
    const r = await tt.services.alongRouteSearch({ key: KR.TOMTOM_KEY, query: q, route: pts, maxDetourTime: 600, limit: 10 });
    (r.results || []).forEach(p => {
      const [la, ln] = LL(p.position); const name = (p.poi && p.poi.name) || p.address.freeformAddress;
      const el = document.createElement('div'); el.className = 'poi-marker'; el.textContent = label.slice(0, 2).trim();
      const pop = new tt.Popup({ offset: 18, closeButton: false }).setHTML(`<div class="pop"><b>${esc(name)}</b><br><small>${esc(p.address.freeformAddress || '')}<br>${T('detour')} ~${Math.round((p.detourTime || 0) / 60)} ${T('min')}</small><br><button class="pop-go" onclick="goTo(${la},${ln},'${esc(name).replace(/'/g, '')}')">➜ ${T('go')}</button> <button class="pop-go alt" onclick="addStop(${la},${ln},'${esc(name).replace(/'/g, '')}')">➕ ${T('add_stop')}</button></div>`);
      poiMarkers.push(new tt.Marker({ element: el }).setLngLat([ln, la]).setPopup(pop).addTo(map));
    });
    toast(`${(r.results || []).length} ${label} ${T('found_near')}`);
  } catch (e) { toast('Search failed'); }
}
function clearPois() { poiMarkers.forEach(m => m.remove()); poiMarkers = []; }
window.goTo = (la, ln, name) => { stops = []; routeTo({ lat: la, lng: ln }, name); $('#search').value = name; };
window.addStop = (la, ln, name) => { if (stops.length >= 5 || !activeRoute) return; stops.push({ lat: la, lng: ln, name }); routeTo(activeRoute.dest, destName); toast('➕ ' + name); };
window.removeStop = i => { stops.splice(i, 1); if (activeRoute) routeTo(activeRoute.dest, destName); };

/* ---------- saved places: Home / Work / favourites / recents ---------- */
function samePlace(a, b) { return a && b && hav(a.lat, a.lng, b.lat, b.lng) < 100; }
function isFav(d) { return samePlace(places.home, d) || samePlace(places.work, d) || places.favs.some(f => samePlace(f, d)); }
function addRecent(dest, name) { places.recent = [{ lat: dest.lat, lng: dest.lng, name }, ...places.recent.filter(r => !samePlace(r, dest))].slice(0, 8); savePlaces(); }
function setPlace(kind) {
  if (!activeRoute) return; const d = { lat: activeRoute.dest.lat, lng: activeRoute.dest.lng, name: destName };
  if (kind === 'home') places.home = d; else if (kind === 'work') places.work = d; else if (!places.favs.some(f => samePlace(f, d))) places.favs = [d, ...places.favs].slice(0, 20);
  savePlaces(); closeSheets(); toast('★ ' + T('saved')); $('#btn-fav').textContent = '★';
}
window.setPlace = setPlace;
window.goPlace = (kind, i) => { const d = kind === 'home' ? places.home : kind === 'work' ? places.work : kind === 'fav' ? places.favs[i] : places.recent[i]; if (!d) return; stops = []; $('#search').value = d.name; routeTo(d, d.name); };
window.forgetPlace = (kind, i) => { if (kind === 'home') places.home = null; else if (kind === 'work') places.work = null; else if (kind === 'fav') places.favs.splice(i, 1); else places.recent.splice(i, 1); savePlaces(); renderQuick(true); };
function renderQuick(force) {
  const q = $('#quick'); if (activeRoute || navState) { q.classList.add('hidden'); return; }
  const chips = [];
  chips.push(`<button class="q-chip ${places.home ? '' : 'dim'}" onclick="${places.home ? "goPlace('home')" : "toast('" + T('set_home') + " → ☆')"}">🏠 ${T('home')}</button>`);
  chips.push(`<button class="q-chip ${places.work ? '' : 'dim'}" onclick="${places.work ? "goPlace('work')" : "toast('" + T('set_work') + " → ☆')"}">💼 ${T('work')}</button>`);
  places.favs.slice(0, 4).forEach((f, i) => chips.push(`<button class="q-chip" onclick="goPlace('fav',${i})">★ ${esc(f.name).slice(0, 18)}</button>`));
  places.recent.slice(0, 4).forEach((r, i) => chips.push(`<button class="q-chip rec" onclick="goPlace('recent',${i})">🕘 ${esc(r.name).slice(0, 18)}</button>`));
  q.innerHTML = chips.join(''); q.classList.toggle('hidden', !(force || places.home || places.work || places.favs.length || places.recent.length));
}

/* ---------- fuel prices (data.gov.my, weekly) + trip cost ---------- */
async function loadFuel() {
  try {
    const c = JSON.parse(localStorage.getItem('nv_fuel') || 'null');
    if (c && Date.now() - c.ts < 6 * 3600000) { fuelPrices = c.p; renderFuel(); return; }
    const j = await fetch('https://api.data.gov.my/data-catalogue?id=fuelprice&limit=4&sort=-date').then(r => r.json());
    const lvl = j.find(x => x.series_type === 'level'), chg = j.find(x => x.series_type === 'change_weekly');
    if (lvl) { fuelPrices = { ron95: lvl.ron95, ron97: lvl.ron97, diesel: lvl.diesel, date: lvl.date, chg: chg || {} }; localStorage.setItem('nv_fuel', JSON.stringify({ ts: Date.now(), p: fuelPrices })); renderFuel(); if (activeRoute) showRouteCard(); }
  } catch (e) { }
}
function renderFuel() {
  const b = $('#fuel-box'); if (!fuelPrices) return;
  const arrow = v => v > 0 ? `<i class="up">▲${v.toFixed(2)}</i>` : v < 0 ? `<i class="dn">▼${Math.abs(v).toFixed(2)}</i>` : '';
  b.innerHTML = `<b>⛽ ${T('fuel_week')}</b><small>${fuelPrices.date}</small><div class="fuel-row"><span>RON95 <b>RM${fuelPrices.ron95}</b> ${arrow(fuelPrices.chg.ron95 || 0)}</span><span>RON97 <b>RM${fuelPrices.ron97}</b> ${arrow(fuelPrices.chg.ron97 || 0)}</span><span>Diesel <b>RM${fuelPrices.diesel}</b> ${arrow(fuelPrices.chg.diesel || 0)}</span></div>`;
  b.classList.remove('hidden');
}

/* ---------- parking at destination ---------- */
async function findParking() {
  if (!activeRoute) return; clearPois();
  try {
    const d = activeRoute.dest;
    const r = await tt.services.categorySearch({ key: KR.TOMTOM_KEY, query: 'parking garage', center: [d.lng, d.lat], radius: 800, limit: 8 });
    (r.results || []).forEach(p => {
      const [la, ln] = LL(p.position); const name = (p.poi && p.poi.name) || p.address.freeformAddress;
      const el = document.createElement('div'); el.className = 'poi-marker park'; el.textContent = 'P';
      const pop = new tt.Popup({ offset: 18, closeButton: false }).setHTML(`<div class="pop"><b>${esc(name)}</b><br><small>${esc(p.address.freeformAddress || '')} · ${Math.round(p.dist || 0)} m</small><br><button class="pop-go" onclick="goTo(${la},${ln},'${esc(name).replace(/'/g, '')}')">➜ ${T('go')}</button></div>`);
      poiMarkers.push(new tt.Marker({ element: el }).setLngLat([ln, la]).setPopup(pop).addTo(map));
    });
    toast(`🅿️ ${(r.results || []).length} ${T('parking')} ${T('near_dest')}`);
    if (!navState) map.flyTo({ center: [d.lng, d.lat], zoom: 15 });
  } catch (e) { toast('Search failed'); }
}

/* ---------- hands-free voice reporting ---------- */
const VOICE_MAP = [[/jam|sesak|塞|堵/i, 'jam'], [/accident|kemalangan|crash|车祸|事故/i, 'accident'], [/police|polis|警察/i, 'police'], [/roadblock|sekatan|路障/i, 'roadblock'], [/flood|banjir|水/i, 'flood'], [/camera|kamera|aes|相机|测速/i, 'camera'], [/breakdown|rosak|故障|抛锚/i, 'breakdown'], [/pothole|lubang|坑/i, 'pothole'], [/closed|closure|tutup|封/i, 'closure'], [/hazard|bahaya|危险|object/i, 'hazard'], [/clear|lancar|畅通/i, 'clear']];
function voiceReport() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { toast('Voice input not supported on this browser'); return; }
  const rec = new SR(); rec.lang = LANG === 'en-GB' ? 'en-MY' : LANG; rec.interimResults = false; rec.maxAlternatives = 3;
  toast('🎤 ' + T('listening') + ' ' + T('say_report')); try { speechSynthesis.cancel(); } catch (e) { }
  rec.onresult = ev => { const said = [...ev.results[0]].map(a => a.transcript).join(' '); const hit = VOICE_MAP.find(([re]) => re.test(said)); if (hit) { toast(`🎤 ${T('heard')}: ${said} → ${TYPE_ICON[hit[1]] || '✅'}`); sendReport(hit[1]); } else toast(`🎤 ${T('not_understood')}: ${said}`); };
  rec.onerror = () => toast('🎤 ' + T('not_understood')); rec.start();
}

/* ---------- navigation ---------- */
function startNav() {
  if (!activeRoute) return;
  navState = { idx: 0 }; lastSpokenStep = {}; camWarned.clear();
  $('#route-card').classList.add('hidden'); $('#topbar').classList.add('hidden'); $('#met-strip').classList.add('hidden');
  $('#nav-banner').classList.remove('hidden');
  map.setStyle(styleUrl(view, true)); map.easeTo({ zoom: 17, pitch: 55 }); $('#btn-3d').textContent = '2D';
  updateNavEta(activeRoute.secs);
  speak(T('v_start') + ' ' + (activeRoute.steps[0] ? activeRoute.steps[0].short : ''));
  navTick();
  if (window.NATIVE) NATIVE.keepAwake(true); else if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
  subscribePush();
  clearInterval(rerouteTimer); rerouteTimer = setInterval(checkFasterRoute, 120000);
}
function navTick() {
  if (!navState || !myPos || !activeRoute) return;
  const steps = activeRoute.steps; if (!steps.length) return;
  map.easeTo({ center: [myPos.lng, myPos.lat], bearing: (myPos.heading != null && !isNaN(myPos.heading)) ? myPos.heading : map.getBearing(), duration: 800 });
  if (navState.idx < steps.length - 1 && hav(myPos.lat, myPos.lng, steps[navState.idx].lat, steps[navState.idx].lng) < 25) navState.idx++;
  const cur = steps[navState.idx], nxt = steps[navState.idx + 1];
  const dist = hav(myPos.lat, myPos.lng, cur.lat, cur.lng);
  $('#nav-dist').textContent = fmtDist(dist);
  if (myPos.speed != null && !isNaN(myPos.speed)) { lastSpeedKmh = Math.round(myPos.speed * 3.6); $('#spd').textContent = lastSpeedKmh; $('#speedo').classList.remove('hidden'); }
  const remain = hav(myPos.lat, myPos.lng, activeRoute.dest.lat, activeRoute.dest.lng);
  if (!parkingPrompted && remain < 600 && steps.length > 1) { parkingPrompted = true; toast('🅿️ ' + T('arriving')); if (S.chatty === 'all') speak(T('arriving')); }
  $('#nav-text').textContent = cur.short + (cur.sign ? ' → ' + cur.sign : '');
  $('#nav-next').textContent = nxt ? (T('v_then') + ' ' + maneuverIcon(nxt.maneuver) + ' ' + nxt.short) : '';
  $('#nav-icon').textContent = maneuverIcon(cur.maneuver);
  // voice: 1 km, 300 m, 60 m
  const key = navState.idx;
  if (dist < 1200 && dist > 900 && !(lastSpokenStep[key] >= 1)) { lastSpokenStep[key] = 1; speak(`${T('v_in')} 1 ${T('v_km')}, ${cur.short}`); }
  else if (dist < 350 && dist > 120 && !(lastSpokenStep[key] >= 2)) { lastSpokenStep[key] = 2; speak(`${T('v_in')} ${Math.round(dist / 50) * 50} ${T('v_m')}, ${cur.short}` + (nxt && nxt.offset - cur.offset < 400 ? `, ${T('v_then')} ${nxt.short}` : '')); }
  else if (dist < 70 && !(lastSpokenStep[key] >= 3)) { lastSpokenStep[key] = 3; speak(cur.short); }
  if (navState.idx === steps.length - 1 && dist < 30) { speak(T('v_arrived')); stopNav(); return; }
  checkCameras();
  if (distToPath(myPos.lat, myPos.lng, activeRoute.path) > 80 && Date.now() - lastReroute > 20000) {
    lastReroute = Date.now(); speak(T('v_reroute')); routeTo(activeRoute.dest, destName).then(() => { if (navState) { navState.idx = 0; lastSpokenStep = {}; } });
  }
}
function updateNavEta(secs) { $('#nav-eta').textContent = fmtDur(secs) + ' · ETA ' + fmtTime(new Date(Date.now() + secs * 1000)); }
async function checkFasterRoute() {   // every 2 min: current route (reconstructed) vs fresh fastest → switch if ≥ 3 min saved
  if (!navState || !myPos || !activeRoute) return;
  try {
    const dest = activeRoute.dest;
    let ni = 0, nd = Infinity; activeRoute.path.forEach((p, i) => { const d = hav(myPos.lat, myPos.lng, p[0], p[1]); if (d < nd) { nd = d; ni = i; } });
    const rem = activeRoute.path.slice(ni); const step = Math.max(1, Math.ceil(rem.length / 150));
    const sup = rem.filter((_, i) => i % step === 0).map(p => [p[1], p[0]]);
    const common = { ...routeOpts(), locations: [[myPos.lng, myPos.lat], [dest.lng, dest.lat]] };
    const [cur, fresh] = await Promise.all([tt.services.calculateRoute({ ...common, supportingPoints: sup }), tt.services.calculateRoute({ ...common, maxAlternatives: 1, routeType: 'fastest' })]);
    const curSecs = cur.routes[0].summary.travelTimeInSeconds;
    const best = fresh.routes.reduce((b, r) => r.summary.travelTimeInSeconds < b.summary.travelTimeInSeconds ? r : b, fresh.routes[0]);
    const saved = curSecs - best.summary.travelTimeInSeconds;
    updateNavEta(curSecs);
    if (saved >= 180) { const n = Math.round(saved / 60); speak(T('v_faster', { n })); toast('🚀 ' + T('faster', { n })); await routeTo(dest, destName); if (navState) { navState.idx = 0; lastSpokenStep = {}; } updateNavEta(activeRoute.secs); }
  } catch (e) { }
}
function stopNav() {
  navState = null; clearInterval(rerouteTimer); if (window.NATIVE) NATIVE.keepAwake(false); map.setStyle(styleUrl(view, false)); map.easeTo({ pitch: 0, bearing: 0 });
  $('#nav-banner').classList.add('hidden'); $('#cam-warn').classList.add('hidden'); $('#speedo').classList.add('hidden'); $('#topbar').classList.remove('hidden'); showMet();
  if (activeRoute) $('#route-card').classList.remove('hidden');
}
function maneuverIcon(m) {
  m = (m || '').toUpperCase();
  if (m.includes('SHARP_LEFT') || m.includes('BEAR_LEFT') || m.includes('LEFT')) return m.includes('BEAR') ? '↖' : '⬅';
  if (m.includes('RIGHT')) return m.includes('BEAR') ? '↗' : '➡';
  if (m.includes('UTURN') || m.includes('U_TURN')) return '↩'; if (m.includes('ROUNDABOUT')) return '🔄';
  if (m.includes('EXIT') || m.includes('RAMP')) return '↗'; if (m.includes('MOTORWAY') || m.includes('MERGE')) return '⤴'; if (m.includes('ARRIVE')) return '🏁'; return '⬆';
}
function speak(t) { if (!S.voice) return; if (window.NATIVE) { NATIVE.speak(t, LANG === 'en-GB' ? 'en-MY' : LANG); return; } try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = LANG === 'en-GB' ? 'en-MY' : LANG; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { } }

/* ---------- speed cameras (OpenStreetMap + community) ---------- */
async function loadCameras() {
  try {
    const c = JSON.parse(localStorage.getItem('nv_cams') || 'null');
    if (c && Date.now() - c.ts < 7 * 86400000) { cameras = c.list; drawCameras(); return; }
    const q = '[out:json][timeout:40];area["ISO3166-1"="MY"][admin_level=2]->.a;(node["highway"="speed_camera"](area.a);node["enforcement"="maxspeed"](area.a););out body;';
    const j = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) }).then(r => r.json());
    cameras = (j.elements || []).filter(e => e.lat && e.lon).map(e => ({ id: 'osm' + e.id, lat: e.lat, lng: e.lon, maxspeed: (e.tags && e.tags.maxspeed) || '', src: 'OSM' }));
    localStorage.setItem('nv_cams', JSON.stringify({ ts: Date.now(), list: cameras })); drawCameras();
  } catch (e) { }
}
function allCameras() { return cameras.concat(alerts.filter(a => a.type === 'camera').map(a => ({ id: a.id, lat: a.lat, lng: a.lng, maxspeed: '', src: a.source }))); }
function drawCameras() {
  camMarkers.forEach(m => m.remove()); camMarkers = [];
  if (!S.showcam || !map || map.getZoom() < 11) return;
  const b = map.getBounds();
  allCameras().forEach(c => {
    if (c.lng < b.getWest() || c.lng > b.getEast() || c.lat < b.getSouth() || c.lat > b.getNorth()) return;
    const el = document.createElement('div'); el.className = 'cam-marker'; el.textContent = '📷'; el.title = c.maxspeed ? c.maxspeed + ' km/h' : 'Speed camera';
    camMarkers.push(new tt.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map));
  });
}
function checkCameras() {   // warn once per camera within 600 m ahead along the route
  if (!S.cam || !navState || !activeRoute) { $('#cam-warn').classList.add('hidden'); return; }
  let ni = 0, nd = Infinity; activeRoute.path.forEach((p, i) => { const d = hav(myPos.lat, myPos.lng, p[0], p[1]); if (d < nd) { nd = d; ni = i; } });
  let shown = false;
  for (const c of allCameras()) {
    if (hav(myPos.lat, myPos.lng, c.lat, c.lng) > 700) continue;
    let ci = -1, cd = Infinity; for (let i = ni; i < Math.min(activeRoute.path.length, ni + 400); i++) { const d = hav(c.lat, c.lng, activeRoute.path[i][0], activeRoute.path[i][1]); if (d < cd) { cd = d; ci = i; } }
    if (cd > 40 || ci <= ni) continue;   // not on the road ahead
    let along = 0; for (let i = ni; i < ci; i++) along += hav(activeRoute.path[i][0], activeRoute.path[i][1], activeRoute.path[i + 1][0], activeRoute.path[i + 1][1]);
    if (along > 600) continue;
    $('#cam-dist').textContent = fmtDist(along); $('#cam-warn').classList.remove('hidden'); shown = true;
    if (!camWarned.has(c.id)) { camWarned.add(c.id); const lim = parseInt(c.maxspeed) || 0; speak(T('v_camera', { d: Math.round(along / 50) * 50 }) + (lim && lastSpeedKmh > lim + 5 ? ' ' + T('v_slow') + ' ' + lim : '')); if (navigator.vibrate) navigator.vibrate([150, 80, 150]); }
    break;
  }
  if (!shown) $('#cam-warn').classList.add('hidden');
}

/* ---------- MET Malaysia weather warnings (data.gov.my) ---------- */
async function loadMet() {
  try {
    const j = await fetch('https://api.data.gov.my/weather/warning?limit=20').then(r => r.json());
    const now = Date.now();
    metWarnings = (j || []).filter(w => Date.parse(w.valid_from) <= now + 6 * 3600000 && Date.parse(w.valid_to) >= now).map(w => ({
      title: LANG === 'ms-MY' ? (w.heading_bm || w.heading_en) : (w.heading_en || w.heading_bm), text: LANG === 'ms-MY' ? (w.text_bm || w.text_en) : (w.text_en || w.text_bm),
      to: w.valid_to, issued: w.warning_issue && w.warning_issue.issued
    }));
    showMet();
  } catch (e) { }
}
function showMet() {
  const strip = $('#met-strip');
  const mine = metWarnings.filter(w => myState && myState !== '…' && new RegExp(myState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(w.text + ' ' + w.title));
  const rain = mine.filter(w => /rain|hujan|thunder|ribut|storm|flood|banjir/i.test(w.title + w.text));
  if (rain.length && !navState) { strip.textContent = '⛈ ' + rain[0].title + ' — ' + myState; strip.classList.remove('hidden'); if (!metShown) { metShown = true; speak(T('v_weather')); } }
  else strip.classList.add('hidden');
  $('#met-list').innerHTML = metWarnings.slice(0, 5).map(w => `<div class="met-item${mine.includes(w) ? ' mine' : ''}">⛈ <b>${esc(w.title)}</b><small>${esc(String(w.text).slice(0, 220))}…</small></div>`).join('');
}

/* ---------- live TomTom incidents (viewport, every 60 s) ---------- */
const TT_TYPE = { 1:'accident', 2:'weather', 3:'hazard', 4:'weather', 5:'weather', 6:'jam', 7:'closure', 8:'closure', 9:'roadwork', 10:'weather', 11:'flood', 14:'breakdown' };
async function loadIncidents() {
  if (!map || !map.getBounds) return;
  try {
    const b = map.getBounds(); const pad = navState ? 0.6 : 0.25;
    const bbox = [b.getWest() - pad, b.getSouth() - pad, b.getEast() + pad, b.getNorth() + pad].map(x => x.toFixed(4)).join(',');
    const u = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${KR.TOMTOM_KEY}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},from,to,delay,roadNumbers,startTime,endTime}}}&language=en-GB&timeValidityFilter=present`;
    const j = await fetch(u).then(r => r.json());
    const now = Date.now() / 1000, z = map.getZoom();
    liveIncidents = (j.incidents || []).map(inc => {
      const p = inc.properties, g = inc.geometry;
      const c = g.type === 'Point' ? g.coordinates : g.coordinates[Math.floor(g.coordinates.length / 2)];
      const type = TT_TYPE[p.iconCategory] || 'hazard', mag = p.magnitudeOfDelay || 0;
      const sev = (mag >= 3 || [8, 11, 1].includes(p.iconCategory)) ? 3 : mag === 2 ? 2 : 1;
      const desc = (p.events && p.events[0] && p.events[0].description) || type;
      return { id: 'tt_' + p.id, type, severity: sev, title: desc + (p.roadNumbers && p.roadNumbers[0] ? ' on ' + p.roadNumbers[0] : '') + (p.from ? ' near ' + p.from : ''),
        road: (p.roadNumbers && p.roadNumbers[0]) || p.from || '', direction: p.to ? 'towards ' + p.to : '', lat: c[1], lng: c[0], source: 'TomTom Live',
        eta_clear: p.delay ? '+' + Math.round(p.delay / 60) + ' ' + T('min') : '', ts: p.startTime ? Date.parse(p.startTime) / 1000 : now, confirmations: 0, minor: p.iconCategory === 9 && mag === 0 };
    }).filter(a => !a.minor || z >= 13);
    mergeAlerts();
  } catch (e) { }
}
function mergeAlerts() {
  const seen = new Set(); alerts = [];
  [...engineAlerts, ...liveIncidents].forEach(a => { if (!seen.has(a.id)) { seen.add(a.id); alerts.push(a); } });
  drawAlerts(); drawCameras();
  if (activeRoute) {
    alertsOnRoute(activeRoute).forEach(a => { if (!seenAlertIds.has(a.id)) { seenAlertIds.add(a.id); if (seenAlertIds.size > 1 && a.severity >= 2) notifyAlert(a); } });
    if (!navState) showRouteCard();
  }
  alerts.forEach(a => seenAlertIds.add(a.id));
}

/* ---------- engine alerts (news / Telegram / community via PHP) ---------- */
async function loadAlerts() {
  try {
    const b = map && map.getBounds ? map.getBounds() : null;
    const q = b ? `?n=${b.getNorth()}&e=${b.getEast()}&s=${b.getSouth()}&w=${b.getWest()}` : '';
    const data = await fetch(KR.API_BASE + 'alerts.php' + q, { cache: 'no-store' }).then(r => r.json());
    engineAlerts = (data.alerts || []).filter(a => !String(a.id).startsWith('tt_'));
    mergeAlerts();
  } catch (e) { }
}
function drawAlerts() {
  const keep = new Set();
  alerts.forEach(a => {
    if (!a.lat || !a.lng || a.type === 'camera') return; keep.add(a.id);
    if (alertMarkers[a.id]) return;
    const el = document.createElement('div'); el.className = 'alert-marker'; el.style.background = SEV_COLOR[a.severity] || '#f5a623'; el.textContent = TYPE_ICON[a.type] || '⚠️';
    const popup = new tt.Popup({ offset: 18, closeButton: false }).setHTML(`<div class="pop"><b>${esc(a.title)}</b><br>${esc(a.road || '')} ${a.direction ? '· ' + esc(a.direction) : ''}<br><small>${esc(a.source)} · ${timeAgo(a.ts)}${a.eta_clear ? ' · ' + esc(a.eta_clear) : ''}${a.confirmations ? ' · 👍' + a.confirmations : ''}</small></div>`);
    alertMarkers[a.id] = new tt.Marker({ element: el }).setLngLat([a.lng, a.lat]).setPopup(popup).addTo(map);
  });
  Object.keys(alertMarkers).forEach(id => { if (!keep.has(id)) { alertMarkers[id].remove(); delete alertMarkers[id]; } });
}
function notifyAlert(a) {
  if (S.chatty === 'important' && a.severity < 3) { toast(`${TYPE_ICON[a.type] || '⚠️'} ${a.title}`); return; }
  toast(`${TYPE_ICON[a.type] || '⚠️'} ${T('new_on_route')}: ${a.title}`);
  speak(T('v_alert') + ' ' + a.title + (a.eta_clear ? '. ' + T('v_clear_in') + ' ' + a.eta_clear : ''));
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function renderFeed() {
  const list = [...alerts].sort((x, y) => y.ts - x.ts).slice(0, 60);
  $('#feed-list').innerHTML = list.length ? list.map(a => `<div class="feed-item sev-${a.severity}" onclick="focusAlert('${a.id}')">${TYPE_ICON[a.type] || '⚠️'} ${esc(a.title)}<small>${esc(a.road || '')} ${a.direction ? '· ' + esc(a.direction) : ''} · ${esc(a.source)} · ${timeAgo(a.ts)}</small></div>`).join('') : `<p class="muted">${T('no_alerts')}</p>`;
  showMet();
}
window.focusAlert = id => { const a = alerts.find(x => x.id === id); if (a) { map.flyTo({ center: [a.lng, a.lat], zoom: 15 }); closeSheets(); } };
window.selectRoute = selectRoute;

/* ---------- community reports ---------- */
async function sendReport(type) {
  closeSheets();
  if (!myPos) { toast(T('no_gps')); return; }
  try {
    const j = await fetch(KR.API_BASE + 'report.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, lat: myPos.lat, lng: myPos.lng, heading: myPos.heading, device: deviceId() }) }).then(r => r.json());
    toast(j.ok ? T('reported') + ' ✅' : T('report_fail'));
    loadAlerts();
  } catch (e) { toast(T('report_fail')); }
}
function deviceId() { let d = localStorage.getItem('nv_dev'); if (!d) { d = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('nv_dev', d); } return d; }

/* ---------- share ETA ---------- */
function shareEta() {
  if (!activeRoute) return;
  const eta = fmtTime(new Date(Date.now() + activeRoute.secs * 1000));
  const text = T('share_text', { dest: destName, eta }) + ` 📍 https://www.google.com/maps?q=${activeRoute.dest.lat.toFixed(5)},${activeRoute.dest.lng.toFixed(5)}`;
  if (window.NATIVE) { NATIVE.share(text); return; }
  (navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text).then(() => toast(T('copied')))).catch(() => {});
}

/* ---------- push subscription (route-matched) ---------- */
async function subscribePush() {
  const tok = localStorage.getItem('nv_fcm'); if (!tok || !activeRoute) return;
  try { await fetch(KR.API_BASE + 'subscribe.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tok, path: activeRoute.path.filter((_, i) => i % 5 === 0), minutes: Math.ceil(activeRoute.secs / 60) + 30 }) }); } catch (e) { }
}

/* ---------- geometry & helpers ---------- */
function hav(a1, o1, a2, o2) { const R = 6371000, dA = (a2 - a1) * Math.PI / 180, dO = (o2 - o1) * Math.PI / 180; const x = Math.sin(dA / 2) ** 2 + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dO / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
function distToPath(lat, lng, path) {
  const c = Math.cos(lat * Math.PI / 180), px = lng * c, py = lat; let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i][1] * c, ay = path[i][0], bx = path[i + 1][1] * c, by = path[i + 1][0], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111320; if (d < best) best = d;
  }
  return best;
}
let toastTimer;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 6000); }

/* ---------- place search: TomTom + OpenStreetMap (Photon) merged — small resorts, kampungs, clinics, schools ---------- */
const _srchCache = new Map(); let _photonCtl = null;
function _norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-鿿 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
async function searchPlaces(q, limit) {
  q = String(q || '').trim(); limit = limit || 6;
  const key = _norm(q) + '|' + (myPos ? (myPos.lat.toFixed(1) + ',' + myPos.lng.toFixed(1)) : '') + '|' + LANG;
  if (_srchCache.has(key)) return _srchCache.get(key).slice(0, limit);
  const center = myPos || { lat: 3.14, lng: 101.69 };   // KL when no fix yet
  const tomtom = tt.services.fuzzySearch({ key: KR.TOMTOM_KEY, query: q, countrySet: 'MY', language: LANG === 'zh-TW' ? 'zh-TW' : 'en-GB', typeahead: true, limit: 10, center: [center.lng, center.lat] })
    .then(r => (r.results || []).map(p => { const [la, ln] = LL(p.position); return { lat: la, lng: ln, name: p.poi ? p.poi.name : (p.address.freeformAddress || ''), addr: p.address.freeformAddress || '', src: 'tt', kind: p.type }; }))
    .catch(() => []);
  if (_photonCtl) _photonCtl.abort(); _photonCtl = new AbortController();
  const photon = fetch('https://photon.komoot.io/api/?limit=10&lang=en&lat=' + center.lat + '&lon=' + center.lng + '&q=' + encodeURIComponent(q), { signal: _photonCtl.signal })
    .then(r => r.json()).then(j => (j.features || []).filter(f => f.properties.countrycode === 'MY' && f.properties.name).map(f => {
      const p = f.properties; const [ln, la] = f.geometry.coordinates;
      const addr = [p.street && p.housenumber ? p.housenumber + ' ' + p.street : p.street, p.district, p.city || p.county, p.postcode, p.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      return { lat: +la, lng: +ln, name: p.name, addr, src: 'osm', kind: p.osm_value || p.type };
    })).catch(() => []);
  const [a, b] = await Promise.all([tomtom, photon]);
  if (!a.length && !b.length) { try { const j = await (await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=my&limit=8&q=' + encodeURIComponent(q))).json(); b.push(...j.map(x => ({ lat: +x.lat, lng: +x.lon, name: (x.display_name || '').split(',')[0], addr: (x.display_name || '').split(',').slice(1, 5).join(',').trim(), src: 'osm', kind: x.type }))); } catch (e) { } }
  const all = [...a, ...b].filter(x => !isNaN(x.lat) && !isNaN(x.lng));
  // de-duplicate (same name-ish within 300 m)
  const out = [];
  for (const x of all) { if (!out.some(y => hav(x.lat, x.lng, y.lat, y.lng) < 300 && (_norm(y.name).includes(_norm(x.name).slice(0, 12)) || _norm(x.name).includes(_norm(y.name).slice(0, 12))))) out.push(x); }
  // rank: name match quality first, then distance from me
  const nq = _norm(q), words = nq.split(' ').filter(Boolean);
  const score = x => { const n = _norm(x.name); let s = 0; if (n === nq) s += 100; else if (n.startsWith(nq)) s += 60; else if (n.includes(nq)) s += 40; s += words.filter(w => n.includes(w)).length * 8; if (/residential|street|unclassified|tertiary|primary|secondary/.test(x.kind || '') && !/jalan|lorong|persiaran|lebuh/.test(nq)) s -= 25; if (x.src === 'tt' && x.kind === 'POI') s += 5; const d = myPos ? hav(myPos.lat, myPos.lng, x.lat, x.lng) : 0; s -= Math.min(30, d / 10000); return s; };
  out.sort((p1, p2) => score(p2) - score(p1));
  _srchCache.set(key, out); if (_srchCache.size > 200) _srchCache.delete(_srchCache.keys().next().value);
  return out.slice(0, limit);
}
window.searchPlaces = searchPlaces;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function timeAgo(ts) { const m = Math.round((Date.now() / 1000 - ts) / 60); return m < 1 ? 'now' : m < 60 ? m + 'm' : Math.round(m / 60) + 'h'; }
function fmtDur(s) { const m = Math.round(s / 60); return m < 60 ? m + ' ' + T('min') : Math.floor(m / 60) + ' h ' + (m % 60) + ' ' + T('min'); }
function fmtDist(d) { return d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.max(10, Math.round(d / 10) * 10) + ' m'; }
function fmtTime(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
