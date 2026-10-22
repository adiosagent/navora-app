/* Navora native bridge — when running inside the Capacitor app (Android / iOS) this routes voice, GPS, share,
   haptics and screen-wake through native plugins. In a normal browser it does nothing and the web APIs are used. */
(function () {
  const C = window.Capacitor; if (!C || !C.isNativePlatform || !C.isNativePlatform()) { window.NATIVE = null; return; }
  const P = C.Plugins || {};
  const SR = P.SpeechRecognition, TTS = P.TextToSpeech, Geo = P.Geolocation, Share = P.Share, Hap = P.Haptics, KA = P.KeepAwake, Push = P.PushNotifications, SB = P.StatusBar, App = P.App;
  const N = window.NATIVE = { platform: C.getPlatform(), ready: false };
  document.documentElement.classList.add('native', 'native-' + N.platform);

  /* ---- status bar + keep awake ---- */
  try { SB && SB.setStyle({ style: 'DARK' }); SB && SB.setBackgroundColor && SB.setBackgroundColor({ color: '#0a1a4a' }); } catch (e) { }
  N.keepAwake = on => { try { on ? KA.keepAwake() : KA.allowSleep(); } catch (e) { } };

  /* ---- haptics ---- */
  N.vibrate = pattern => { try { Hap.vibrate({ duration: Array.isArray(pattern) ? pattern[0] : (pattern || 200) }); } catch (e) { } };
  navigator.vibrate = N.vibrate;

  /* ---- share ---- */
  N.share = async text => { try { await Share.share({ text }); return true; } catch (e) { return false; } };

  /* ---- geolocation: native watch (works with the screen off while navigating) ---- */
  N.watchPosition = async (ok, err) => {
    try {
      const perm = await Geo.requestPermissions({ permissions: ['location'] });
      if (perm.location === 'denied') { err && err({ code: 1, message: 'denied' }); return null; }
      return await Geo.watchPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }, (pos, e) => { if (e) { err && err(e); return; } ok(pos); });
    } catch (e) { err && err(e); return null; }
  };
  N.getPosition = () => Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
  N.clearWatch = id => { try { Geo.clearWatch({ id }); } catch (e) { } };

  /* ---- text to speech (native voices, works over music / in background) ---- */
  N.speak = async (text, lang) => { try { await TTS.stop(); await TTS.speak({ text, lang: lang || 'en-MY', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' }); } catch (e) { } };
  N.stopSpeak = () => { try { TTS.stop(); } catch (e) { } };

  /* ---- speech recognition (native: Android + iOS; no Chrome beep; iPhone gets "Hello Navora" too) ---- */
  let listening = false, partialHandler = null, finalHandler = null, endHandler = null;
  N.speechSupported = async () => { try { return (await SR.available()).available; } catch (e) { return false; } };
  N.requestMic = async () => { try { const p = await SR.requestPermissions(); return p.speechRecognition === 'granted'; } catch (e) { return false; } };
  N.listen = async ({ lang, continuous, onPartial, onFinal, onEnd }) => {
    partialHandler = onPartial; finalHandler = onFinal; endHandler = onEnd;
    try {
      await SR.removeAllListeners();
      SR.addListener('partialResults', d => { const m = (d && d.matches) || []; if (m.length && partialHandler) partialHandler(m); });
      SR.addListener('listeningState', d => { if (d && d.status === 'stopped') { listening = false; endHandler && endHandler(); } });
      listening = true;
      const res = await SR.start({ language: lang || 'en-MY', maxResults: 3, partialResults: true, popup: false, prompt: '' });
      if (res && res.matches && res.matches.length && finalHandler) finalHandler(res.matches);
      if (!continuous) { listening = false; endHandler && endHandler(); }
    } catch (e) { listening = false; endHandler && endHandler(e); }
  };
  N.stopListen = async () => { try { await SR.stop(); } catch (e) { } listening = false; };
  N.isListening = () => listening;

  /* ---- push (FCM / APNs) ---- */
  N.initPush = async () => {
    try {
      let p = await Push.checkPermissions(); if (p.receive === 'prompt') p = await Push.requestPermissions();
      if (p.receive !== 'granted') return;
      await Push.addListener('registration', t => { localStorage.setItem('nv_fcm', t.value); });
      await Push.addListener('pushNotificationReceived', n => { if (window.toast) toast('⚠️ ' + (n.title || '') + ' ' + (n.body || '')); });
      await Push.addListener('pushNotificationActionPerformed', a => { const d = a.notification && a.notification.data; if (d && d.lat && window.map) map.flyTo({ center: [+d.lng, +d.lat], zoom: 15 }); });
      await Push.register();
    } catch (e) { }
  };

  /* ---- app lifecycle: refresh data when resumed, handle back button ---- */
  try {
    App.addListener('appStateChange', s => { if (s.isActive && window.loadIncidents) { loadIncidents(); loadAlerts(); } });
    App.addListener('backButton', () => { const open = document.querySelector('.sheet:not(.hidden)'); if (open) { open.classList.add('hidden'); return; } if (window.navState) { stopNav(); return; } if (window.activeRoute) { clearRoute(); return; } App.minimizeApp(); });
  } catch (e) { }
  N.ready = true;
})();
