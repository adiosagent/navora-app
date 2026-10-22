/* Navora voice assistant — "Hello Navora" wake word + spoken destination / commands.
   Uses the browser's Web Speech API (Google server recognition on Android Chrome). iOS Safari: tap-to-talk only. */
const VA = {
  SR: window.SpeechRecognition || window.webkitSpeechRecognition,
  rec: null, mode: 'idle',      // idle | wake | command | confirm
  enabled: false, pendingDest: null, restartTimer: null, cmdTimer: null, lastWake: 0,
  supported() { return !!window.NATIVE || !!this.SR; },
  lang() { return LANG === 'en-GB' ? 'en-MY' : LANG; },

  // ---- wake word (fuzzy: hello/hey/hi/hai/ok/你好 + navora/novara/nabora/na vora) ----
  WAKE: /(?:\b(hello|hallo|helo|hey|hi|hai|ok|okay)\b|你好|哈囉|哈喽|嗨)[\s,]*(navora|novara|nabora|na vora|navorra|nevora|navoro|那沃拉)\b|\b(navora|novara)\b[\s,]*(hello|hi|hey)/i,
  start() {
    if (!this.supported()) { toast(T('mic_denied')); return; }
    this.enabled = true; localStorage.setItem('nv_wake', '1'); this.listen('wake'); this.bubble('👂 "Hello Navora"', 'idle');
  },
  stop() { this.enabled = false; localStorage.setItem('nv_wake', '0'); this.kill(); this.bubble('', 'hide'); },
  kill() { clearTimeout(this.restartTimer); clearTimeout(this.cmdTimer); if (this.rec) { try { this.rec.onend = null; this.rec.abort(); } catch (e) { } this.rec = null; } },

  listen(mode) {
    this.kill(); this.mode = mode;
    if (window.NATIVE) return this.listenNative(mode);
    const r = new this.SR(); this.rec = r;
    r.lang = this.lang(); r.continuous = mode === 'wake'; r.interimResults = mode === 'wake'; r.maxAlternatives = 3;
    r.onresult = ev => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const alts = [...ev.results[i]].map(a => a.transcript.trim()); const text = alts.join(' | ');
        if (mode === 'wake') { if (this.WAKE.test(text) && Date.now() - this.lastWake > 4000) { this.lastWake = Date.now(); this.onWake(); return; } }
        else if (ev.results[i].isFinal) { this.onCommand(alts); return; }
      }
    };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.enabled = false; this.bubble('🎤 ' + T('mic_denied'), 'warn'); return; } if (mode !== 'wake') { this.bubble('🎤 ' + T('not_understood'), 'warn'); this.backToWake(); } };
    r.onend = () => { if (mode === 'wake' && this.enabled) { this.restartTimer = setTimeout(() => this.listen('wake'), 400); } else if (mode !== 'wake' && this.mode === mode) { this.backToWake(); } };
    try { r.start(); } catch (e) { this.restartTimer = setTimeout(() => this.enabled && this.listen('wake'), 1500); }
    if (mode !== 'wake') this.cmdTimer = setTimeout(() => { if (this.mode === mode) { this.say(T('va_timeout')); this.backToWake(); } }, 9000);
  },
  // Native recognition (Android + iOS). Wake mode = short sessions restarted continuously; command mode = one utterance.
  async listenNative(mode) {
    const self = this; let done = false;
    const finish = alts => { if (done) return; done = true; if (mode === 'wake') { if (alts.some(a => self.WAKE.test(a)) && Date.now() - self.lastWake > 4000) { self.lastWake = Date.now(); self.onWake(); } else if (self.enabled && self.mode === 'wake') { self.restartTimer = setTimeout(() => self.listenNative('wake'), 300); } } else { self.onCommand(alts); } };
    if (!(await NATIVE.requestMic())) { this.enabled = false; this.bubble('🎤 ' + T('mic_denied'), 'warn'); return; }
    this.rec = { abort: () => NATIVE.stopListen(), onend: null };
    NATIVE.listen({ lang: this.lang(), continuous: false,
      onPartial: m => { if (mode === 'wake' && m.some(a => self.WAKE.test(a))) { NATIVE.stopListen(); finish(m); } else if (mode !== 'wake') self.bubble('💬 ' + m[0], 'listen'); },
      onFinal: m => finish(m),
      onEnd: () => { if (!done) { done = true; if (mode === 'wake') { if (self.enabled && self.mode === 'wake') self.restartTimer = setTimeout(() => self.listenNative('wake'), 300); } else if (self.mode === mode) self.backToWake(); } } });
    if (mode !== 'wake') this.cmdTimer = setTimeout(() => { if (this.mode === mode && !done) { NATIVE.stopListen(); } }, 9000);
  },
  backToWake() { this.pendingDest = null; if (this.enabled) this.listen('wake'); else { this.kill(); this.mode = 'idle'; } this.bubble(this.enabled ? '👂 "Hello Navora"' : '', this.enabled ? 'idle' : 'hide'); },

  async onWake() {
    this.kill(); this.chime();
    this.bubble('🎙 ' + T('va_prompt'), 'listen');
    await this.say(T('va_prompt'));
    this.listen('command');
  },
  // tap-to-talk entry (works on iOS too)
  async ask() { if (!this.supported()) { toast('Voice input not supported on this browser'); return; } this.kill(); this.chime(); this.bubble('🎙 ' + T('va_prompt'), 'listen'); await this.say(T('va_prompt')); this.listen('command'); },

  // ---- command parsing ----
  CMDS: [
    [/^(?:\b(stop|end|cancel|batal|berhenti|tamat)\b|停止|结束|取消|停)/i, 'stop'],
    [/(?:^|\s)(go|yes|start|ok|okay|ya|mula|jalan)$|^(出发|好|好的|开始)$/i, 'confirm'],
    [/(avoid|elak|tanpa|skip|no|tak nak|tak mahu|jangan)\s*(the\s*)?(toll|tol)|(toll|tol)s?\s*(avoid|off)|避开.*收费|免.*收费|不要.*收费/i, 'tolls'],
    [/(?:^|\s)(no|nope|tak|tidak)(?:\s|$)|不是|不要|^不$/i, 'deny'],
    [/\b(home|rumah|balik)\b|回家|回去/i, 'home'],
    [/\b(work|office|kerja|pejabat)\b|公司|上班|办公室/i, 'work'],
    [/\b(report|lapor)\b|报告|举报|^报/i, 'report'],
    [/\b(how long|how far|eta|berapa lama|bila sampai|lagi berapa)\b|多久|几点到|什么时候|还有多远/i, 'eta'],
    [/\b(petrol|minyak|fuel|gas station|petronas|shell|petron)\b|加油|油站/i, 'petrol'],
    [/\b(parking|parkir|car park)\b|停车/i, 'parking'],
    [/\b(mute|senyap|diam|quiet)\b|静音|安静/i, 'mute'],
  ],
  DEST: /^(?:(?:please|tolong|sila|navora)\s+)?(?:go to|goto|go|take me to|bring me to|navigate to|navigation to|drive to|directions? to|route to|head to|pergi ke|pergi|bawa saya ke|ke|tuju ke|去|到|导航到|导航去|带我去|我要去)\s+(.+)$/i,

  async onCommand(alts) {
    this.kill();
    const said = alts[0] || ''; this.bubble('💬 ' + said, 'heard');
    let cmd = null; for (const a of alts) { for (const [re, c] of this.CMDS) if (re.test(a)) { cmd = c; break; } if (cmd) break; }
    if (this.mode === 'confirm' && this.pendingDest) {
      if (cmd === 'confirm' || /^(go|yes|ok|ya|mula|好|出发)$/i.test(said)) { const d = this.pendingDest; this.pendingDest = null; await this.say(T('v_start')); startNav(); return this.backToWake(); }
      if (cmd === 'deny' || cmd === 'stop') { this.pendingDest = null; clearRoute(); await this.say(T('va_cancelled')); return this.backToWake(); }
    }
    switch (cmd) {
      case 'stop': if (navState) stopNav(); else clearRoute(); await this.say(T('va_stopped')); return this.backToWake();
      case 'home': case 'work': { const d = places[cmd]; if (!d) { await this.say(T(cmd === 'home' ? 'set_home' : 'set_work')); return this.backToWake(); } return this.routeAndConfirm(d, d.name); }
      case 'report': { const hit = VOICE_MAP.find(([re]) => re.test(said)); if (hit) { sendReport(hit[1]); await this.say(T('reported')); } else await this.say(T('say_report')); return this.backToWake(); }
      case 'tolls': S.tolls = !/(no|tak|tidak|不)/i.test(said); saveS(); $('#tolls').checked = S.tolls; $('#s-tolls').checked = S.tolls; if (activeRoute) await routeTo(activeRoute.dest, destName); await this.say(S.tolls ? T('avoid_tolls') : T('toll')); return this.backToWake();
      case 'eta': if (activeRoute) await this.say(fmtDur(activeRoute.secs) + ', ' + T('arrive') + ' ' + fmtTime(new Date(Date.now() + activeRoute.secs * 1000))); else await this.say(T('va_no_route')); return this.backToWake();
      case 'petrol': if (activeRoute) { searchAlong('petrol station', '⛽'); await this.say('⛽'); } else await this.say(T('va_no_route')); return this.backToWake();
      case 'parking': if (activeRoute) { findParking(); } else await this.say(T('va_no_route')); return this.backToWake();
      case 'mute': S.voice = false; saveS(); $('#btn-mute').textContent = '🔇'; return this.backToWake();
    }
    // destination: try each alternative, strip command words
    for (const a of alts) {
      const m = a.match(this.DEST); const q = (m ? m[1] : a).replace(/\b(please|tolong|now|sekarang|navora|lah)\b/gi, '').replace(/(现在|吧|呗)$/g, '').trim();
      if (q.length < 2) continue;
      const hit = await this.findPlace(q);
      if (hit) return this.routeAndConfirm(hit, hit.name);
    }
    await this.say(T('va_notfound', { q: said })); this.backToWake();
  },
  async findPlace(q) {
    try {
      const r = await tt.services.fuzzySearch({ key: KR.TOMTOM_KEY, query: q, countrySet: 'MY', language: LANG === 'zh-TW' ? 'zh-TW' : 'en-GB', limit: 3, center: myPos ? [myPos.lng, myPos.lat] : undefined, radius: myPos ? 200000 : undefined });
      const p = (r.results || [])[0]; if (!p) return null;
      const [la, ln] = LL(p.position); return { lat: la, lng: ln, name: p.poi ? p.poi.name : p.address.freeformAddress };
    } catch (e) { return null; }
  },
  async routeAndConfirm(d, name) {
    if (!myPos) { await this.say(T('no_gps')); return this.backToWake(); }
    stops = []; $('#search').value = name; await routeTo(d, name);
    if (!activeRoute) { await this.say(T('va_notfound', { q: name })); return this.backToWake(); }
    this.pendingDest = d;
    const msg = T('va_routing', { name, min: fmtDur(activeRoute.secs) });
    this.bubble('🗺 ' + msg, 'heard'); await this.say(msg);
    this.listen('confirm');
  },

  // ---- output ----
  say(t) { if (window.NATIVE) return NATIVE.speak(t, this.lang()).then(() => new Promise(r => setTimeout(r, 300))); return new Promise(res => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = this.lang(); u.rate = 1.05; u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 6000); } catch (e) { res(); } }); },
  chime() { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.15, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25); o.start(); o.stop(ac.currentTime + 0.25); } catch (e) { } },
  bubble(text, state) { let b = $('#va-bubble'); if (!b) { b = document.createElement('div'); b.id = 'va-bubble'; b.onclick = () => VA.ask(); document.body.appendChild(b); } b.textContent = text; b.className = state; }
};
