/* Navora native bridge — when running inside the Capacitor app (Android / iOS) this routes voice, GPS, share,
   haptics and screen-wake through native plugins. In a normal browser it does nothing and the web APIs are used.

   NOTE: the page is loaded from navora.my (remote), so only Capacitor's injected native-bridge exists here —
   there is NO window.Capacitor.Plugins. We talk to the native plugins directly via nativePromise / nativeCallback. */
(function () {
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform() || typeof C.nativePromise !== 'function') { window.NATIVE = null; return; }

  /* ---- minimal plugin proxy over the raw bridge ---- */
  const plugin = name => ({
    name,
    call: (method, opts) => C.nativePromise(name, method, opts || {}),
    callback: (method, opts, cb) => C.nativeCallback(name, method, opts || {}, cb),
    on: (event, cb) => { try { return C.addListener(name, event, cb); } catch (e) { return null; } }
  });
  const SR = plugin('SpeechRecognition'), TTS = plugin('TextToSpeech'), Geo = plugin('Geolocation'), Share = plugin('Share'),
        Hap = plugin('Haptics'), KA = plugin('KeepAwake'), Push = plugin('PushNotifications'), SB = plugin('StatusBar'), App = plugin('App');
  const N = window.NATIVE = { platform: C.getPlatform(), ready: false, bridge: 'raw' };
  document.documentElement.classList.add('native', 'native-' + N.platform);
  const quiet = p => (p && typeof p.catch === 'function') ? p.catch(() => { }) : p;

  /* ---- status bar + keep awake ---- */
  quiet(SB.call('setStyle', { style: 'DARK' })); quiet(SB.call('setBackgroundColor', { color: '#0a1a4a' }));
  N.keepAwake = on => quiet(KA.call(on ? 'keepAwake' : 'allowSleep'));

  /* ---- haptics ---- */
  N.vibrate = pattern => quiet(Hap.call('vibrate', { duration: Array.isArray(pattern) ? pattern[0] : (pattern || 200) }));
  try { navigator.vibrate = N.vibrate; } catch (e) { }

  /* ---- share ---- */
  N.share = async text => { try { await Share.call('share', { text }); return true; } catch (e) { return false; } };

  /* ---- geolocation: native watch (works with the screen off while navigating) ---- */
  const norm = p => (p && p.coords) ? p : null;
  N.requestLocation = async () => {
    try {
      let perm = await Geo.call('checkPermissions');
      if (!perm || perm.location !== 'granted') perm = await Geo.call('requestPermissions', { permissions: ['location'] });
      return !!perm && (perm.location === 'granted' || perm.coarseLocation === 'granted');
    } catch (e) { return false; }
  };
  N.watchPosition = async (ok, err) => {
    const granted = await N.requestLocation();
    if (!granted) { err && err({ code: 1, message: 'denied' }); return null; }
    // quick network fix first, then a continuous high-accuracy watch
    quiet(Geo.call('getCurrentPosition', { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }).then(p => { if (norm(p)) ok(p); }));
    try {
      return Geo.callback('watchPosition', { enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 },
        (pos, e) => { if (e) { err && err(e); return; } if (norm(pos)) ok(pos); });
    } catch (e) { err && err(e); return null; }
  };
  N.getPosition = () => Geo.call('getCurrentPosition', { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  N.clearWatch = id => quiet(Geo.call('clearWatch', { id }));

  /* ---- text to speech (native voices, works over music / in background) ---- */
  N.speak = async (text, lang) => { try { await quiet(TTS.call('stop')); await TTS.call('speak', { text, lang: lang || 'en-MY', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' }); } catch (e) { } };
  N.stopSpeak = () => quiet(TTS.call('stop'));

  /* ---- speech recognition (native: Android + iOS; no Chrome beep; iPhone gets "Hello Navora" too) ---- */
  let listening = false, partialHandler = null, finalHandler = null, endHandler = null, srBound = false;
  N.speechSupported = async () => { try { return !!(await SR.call('available')).available; } catch (e) { return false; } };
  N.requestMic = async () => { try { const p = await SR.call('requestPermissions'); return p.speechRecognition === 'granted'; } catch (e) { return false; } };
  N.listen = async ({ lang, continuous, onPartial, onFinal, onEnd }) => {
    partialHandler = onPartial; finalHandler = onFinal; endHandler = onEnd;
    try {
      if (!srBound) {
        srBound = true;
        SR.on('partialResults', d => { const m = (d && d.matches) || []; if (m.length && partialHandler) partialHandler(m); });
        SR.on('listeningState', d => { if (d && d.status === 'stopped') { listening = false; endHandler && endHandler(); } });
      }
      listening = true;
      const res = await SR.call('start', { language: lang || 'en-MY', maxResults: 3, partialResults: true, popup: false, prompt: '' });
      if (res && res.matches && res.matches.length && finalHandler) finalHandler(res.matches);
      if (!continuous) { listening = false; endHandler && endHandler(); }
    } catch (e) { listening = false; endHandler && endHandler(e); }
  };
  N.stopListen = async () => { await quiet(SR.call('stop')); listening = false; };
  N.isListening = () => listening;

  /* ---- push (FCM / APNs) ---- */
  N.initPush = async () => {
    // FCM needs Firebase (google-services.json) in the native build. Until that is added, calling register() crashes the
    // Android app, so push is disabled here. Route alerts still arrive as in-app toasts while Navora is open.
    if (!window.NATIVE_PUSH_ENABLED) return;
    try {
      let p = await Push.call('checkPermissions'); if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await Push.call('requestPermissions');
      if (p.receive !== 'granted') return;
      Push.on('registration', t => { try { localStorage.setItem('nv_fcm', t.value); } catch (e) { } });
      Push.on('pushNotificationReceived', n => { if (window.toast) toast('⚠️ ' + (n.title || '') + ' ' + (n.body || '')); });
      Push.on('pushNotificationActionPerformed', a => { const d = a.notification && a.notification.data; if (d && d.lat && window.map) map.flyTo({ center: [+d.lng, +d.lat], zoom: 15 }); });
      await Push.call('register');
    } catch (e) { }
  };

  /* ---- app lifecycle: refresh data when resumed, handle back button ---- */
  App.on('appStateChange', s => { if (s && s.isActive && window.loadIncidents) { try { loadIncidents(); loadAlerts(); } catch (e) { } } });
  App.on('backButton', () => {
    const open = document.querySelector('.sheet:not(.hidden)'); if (open) { open.classList.add('hidden'); return; }
    if (window.navState) { stopNav(); return; }
    if (window.activeRoute) { clearRoute(); return; }
    quiet(App.call('minimizeApp'));
  });
  N.ready = true;
})();
