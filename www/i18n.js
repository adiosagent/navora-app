// Navora UI strings — English / Bahasa Melayu / 中文
const I18N = {
  'en-GB': {
    where_to: 'Where to?', go: 'GO', end: 'End', cancel: 'Cancel', arrive: 'arrive', route_clear: 'route clear', alerts_on_route: 'alert(s) on route',
    traffic: 'traffic', toll: 'Toll', no_toll: 'Toll-free', avoid_tolls: 'Avoid tolls', report_title: 'Report what you see', alerts_title: 'Live alerts near you',
    settings: 'Settings', emergency: 'Emergency', privacy: 'Privacy', voice: 'Voice guidance', cam_alerts: 'Speed camera alerts', show_cams: 'Show cameras on map',
    settings_note: 'Camera locations: OpenStreetMap + community reports. Traffic: TomTom. Weather: MET Malaysia.',
    t_jam: 'Jam', t_accident: 'Accident', t_police: 'Police', t_roadblock: 'Roadblock', t_flood: 'Flood', t_hazard: 'Hazard', t_camera: 'Speed camera', t_breakdown: 'Breakdown', t_pothole: 'Pothole', t_closure: 'Road closed', t_clear: 'Clear now',
    camera_ahead: 'Speed camera ahead', sos_999: 'Police / Ambulance / Fire', sos_plus: 'PLUS highway help', sos_llm: 'Highway Authority', sos_copy: 'Copy my location to share',
    p1: 'No account, no sign-in, no phone number.', p2: 'Your GPS position stays on your phone. It is sent only to TomTom to calculate routes and search — never stored by Navora.',
    p3: 'Reports are anonymous (a random device ID, no personal data). Your location is shared only when you tap a report button.', p4: 'No advertising trackers, no analytics SDKs, no data sold to anyone.',
    p5: 'Built in Malaysia. Data sources: TomTom (traffic, maps), MET Malaysia (weather), OpenStreetMap (cameras), public highway and police feeds.',
    v_start: 'Starting navigation.', v_in: 'In', v_m: 'metres', v_km: 'kilometres', v_then: 'then', v_arrived: 'You have arrived.', v_reroute: 'Rerouting.', v_faster: 'Faster route found, saving {n} minutes. Switching.',
    v_alert: 'Alert on your route.', v_clear_in: 'Expected to clear in', v_camera: 'Speed camera ahead in {d} metres.', v_weather: 'Weather warning for your area.',
    no_alerts: 'No alerts in this area yet.', reported: 'Thanks — report sent', report_fail: 'Report failed', no_gps: 'Waiting for GPS…', found_near: 'along your route', detour: 'detour', min: 'min',
    plan_title:'Plan departure', leave_at:'Leave at', plan_check:'Check ETA', plan_now:'Back to leave now', voice_level:'Voice alerts', vl_all:'All alerts', vl_imp:'Important only', auto_night:'Auto night mode (7pm–7am)', fuel_type:'Fuel', consumption:'Consumption (L/100 km)', home:'Home', work:'Work', set_home:'Set as Home', set_work:'Set as Work', saved:'Saved', add_stop:'Add stop', stops:'stops', fuel_cost:'fuel', est:'est.', parking:'Parking', near_dest:'near destination', say_report:'Say: jam, accident, police, flood, camera…', heard:'Heard', not_understood:'Not understood', listening:'Listening…', fuel_week:'Fuel prices this week', arriving:'Arriving — parking nearby?', leaving_at:'Leaving', v_slow:'Slow down.', recent:'Recent',
    exit:'Exit', fatigue_title:'Are you tired?', fatigue_msg:'You have been driving for {time} without a break. Are you tired? Let\'s take a short break for your safety.', fatigue_rest:'Nearest R&R', fatigue_fuel:'Petrol stop', fatigue_ok:'I\'m fine', fatigue_set:'Break reminder when driving non-stop', fatigue_every:'Remind every', not_here:'Not the place you want?', not_found:'Not found here', open_in:'Open "{app}" to search and navigate there', alt_nav:'Backup navigator (if a place is not found)', va_prompt:'Yes? Where to?', va_routing:'Routing to {name}, {min}. Say GO to start, or NO to cancel.', va_notfound:'Sorry, I could not find {q}.', va_cancelled:'Cancelled.', va_stopped:'Stopped.', va_no_route:'No route yet. Say: go to, and a place.', va_timeout:'Okay, say Hello Navora when you need me.', mic_denied:'Microphone blocked — allow it in browser settings', wake_word:'"Hello Navora" wake word (Android)', va_tip:'Say "Hello Navora" then "go to KLCC", "take me home", "report jam", "how long more", "stop".',
    help:'Help', manual_link:'📖 User manual & why Navora',
    share_text: 'I\'m on my way to {dest}, arriving about {eta}.', copied: 'Location copied', faster: 'Faster route: saves {n} min', new_on_route: 'New on your route'
  },
  'ms-MY': {
    where_to: 'Ke mana?', go: 'PERGI', end: 'Tamat', cancel: 'Batal', arrive: 'tiba', route_clear: 'laluan lancar', alerts_on_route: 'amaran di laluan',
    traffic: 'sesak', toll: 'Tol', no_toll: 'Tanpa tol', avoid_tolls: 'Elak tol', report_title: 'Lapor apa yang anda nampak', alerts_title: 'Amaran langsung berdekatan',
    settings: 'Tetapan', emergency: 'Kecemasan', privacy: 'Privasi', voice: 'Panduan suara', cam_alerts: 'Amaran kamera AES', show_cams: 'Tunjuk kamera di peta',
    settings_note: 'Lokasi kamera: OpenStreetMap + laporan komuniti. Trafik: TomTom. Cuaca: MET Malaysia.',
    t_jam: 'Sesak', t_accident: 'Kemalangan', t_police: 'Polis', t_roadblock: 'Sekatan jalan', t_flood: 'Banjir', t_hazard: 'Bahaya', t_camera: 'Kamera AES', t_breakdown: 'Kereta rosak', t_pothole: 'Lubang jalan', t_closure: 'Jalan ditutup', t_clear: 'Dah lancar',
    camera_ahead: 'Kamera AES di hadapan', sos_999: 'Polis / Ambulans / Bomba', sos_plus: 'Bantuan lebuhraya PLUS', sos_llm: 'Lembaga Lebuhraya', sos_copy: 'Salin lokasi saya untuk dikongsi',
    p1: 'Tiada akaun, tiada log masuk, tiada nombor telefon.', p2: 'Kedudukan GPS anda kekal di telefon anda. Ia dihantar hanya ke TomTom untuk mengira laluan dan carian — tidak disimpan oleh Navora.',
    p3: 'Laporan adalah tanpa nama (ID peranti rawak, tiada data peribadi). Lokasi anda dikongsi hanya apabila anda menekan butang lapor.', p4: 'Tiada penjejak iklan, tiada SDK analitik, tiada data dijual.',
    p5: 'Dibina di Malaysia. Sumber data: TomTom (trafik, peta), MET Malaysia (cuaca), OpenStreetMap (kamera), suapan awam lebuhraya dan polis.',
    v_start: 'Memulakan navigasi.', v_in: 'Dalam', v_m: 'meter', v_km: 'kilometer', v_then: 'kemudian', v_arrived: 'Anda telah tiba.', v_reroute: 'Mencari laluan baru.', v_faster: 'Laluan lebih pantas ditemui, jimat {n} minit. Menukar laluan.',
    v_alert: 'Amaran di laluan anda.', v_clear_in: 'Dijangka lancar dalam', v_camera: 'Kamera AES di hadapan dalam {d} meter.', v_weather: 'Amaran cuaca untuk kawasan anda.',
    no_alerts: 'Tiada amaran di kawasan ini.', reported: 'Terima kasih — laporan dihantar', report_fail: 'Laporan gagal', no_gps: 'Menunggu GPS…', found_near: 'di sepanjang laluan', detour: 'lencongan', min: 'min',
    plan_title:'Rancang perjalanan', leave_at:'Bertolak pada', plan_check:'Semak ETA', plan_now:'Kembali ke bertolak sekarang', voice_level:'Amaran suara', vl_all:'Semua amaran', vl_imp:'Penting sahaja', auto_night:'Mod malam automatik (7pm–7am)', fuel_type:'Minyak', consumption:'Penggunaan (L/100 km)', home:'Rumah', work:'Kerja', set_home:'Tetapkan sebagai Rumah', set_work:'Tetapkan sebagai Kerja', saved:'Disimpan', add_stop:'Tambah hentian', stops:'hentian', fuel_cost:'minyak', est:'angg.', parking:'Parkir', near_dest:'berhampiran destinasi', say_report:'Sebut: sesak, kemalangan, polis, banjir, kamera…', heard:'Didengar', not_understood:'Tidak faham', listening:'Mendengar…', fuel_week:'Harga minyak minggu ini', arriving:'Hampir tiba — cari parkir?', leaving_at:'Bertolak', v_slow:'Perlahankan.', recent:'Terkini',
    exit:'Keluar', fatigue_title:'Anda penat?', fatigue_msg:'Anda telah memandu selama {time} tanpa berhenti. Anda penat? Mari berehat sebentar demi keselamatan anda.', fatigue_rest:'R&R terdekat', fatigue_fuel:'Singgah stesen minyak', fatigue_ok:'Saya okay', fatigue_set:'Peringatan rehat bila memandu tanpa henti', fatigue_every:'Ingatkan setiap', not_here:'Bukan tempat yang anda cari?', not_found:'Tidak dijumpai di sini', open_in:'Buka "{app}" untuk cari dan navigasi', alt_nav:'Navigator sandaran (jika tempat tidak dijumpai)', va_prompt:'Ya? Nak ke mana?', va_routing:'Laluan ke {name}, {min}. Sebut PERGI untuk mula, atau TAK untuk batal.', va_notfound:'Maaf, saya tak jumpa {q}.', va_cancelled:'Dibatalkan.', va_stopped:'Dihentikan.', va_no_route:'Belum ada laluan. Sebut: pergi ke, dan nama tempat.', va_timeout:'Okay, sebut Hello Navora bila perlu.', mic_denied:'Mikrofon disekat — benarkan dalam tetapan pelayar', wake_word:'Kata bangun "Hello Navora" (Android)', va_tip:'Sebut "Hello Navora" kemudian "pergi ke KLCC", "balik rumah", "lapor sesak", "berapa lama", "berhenti".',
    help:'Bantuan', manual_link:'📖 Manual pengguna & kenapa Navora',
    share_text: 'Saya dalam perjalanan ke {dest}, tiba lebih kurang {eta}.', copied: 'Lokasi disalin', faster: 'Laluan lebih pantas: jimat {n} min', new_on_route: 'Baru di laluan anda'
  },
  'zh-TW': {
    where_to: '去哪里？', go: '出发', end: '结束', cancel: '取消', arrive: '到达', route_clear: '路线畅通', alerts_on_route: '个路线警报',
    traffic: '塞车', toll: '收费', no_toll: '免过路费', avoid_tolls: '避开收费站', report_title: '报告路况', alerts_title: '附近实时警报',
    settings: '设置', emergency: '紧急', privacy: '隐私', voice: '语音导航', cam_alerts: '测速相机提醒', show_cams: '地图显示相机',
    settings_note: '相机位置：OpenStreetMap + 社区报告。交通：TomTom。天气：MET Malaysia。',
    t_jam: '塞车', t_accident: '车祸', t_police: '警察', t_roadblock: '路障', t_flood: '水灾', t_hazard: '危险', t_camera: '测速相机', t_breakdown: '车辆故障', t_pothole: '路坑', t_closure: '道路封闭', t_clear: '已畅通',
    camera_ahead: '前方有测速相机', sos_999: '警察 / 救护车 / 消防', sos_plus: 'PLUS 高速公路援助', sos_llm: '大道局', sos_copy: '复制我的位置以分享',
    p1: '无需账号、无需登录、无需手机号码。', p2: '您的GPS位置保留在手机上，仅发送给TomTom用于计算路线和搜索，Navora不储存。',
    p3: '报告是匿名的（随机设备ID，无个人资料）。只有在您点击报告按钮时才会分享位置。', p4: '没有广告追踪器、没有分析SDK、不出售任何数据。',
    p5: '马来西亚制造。数据来源：TomTom（交通、地图）、MET Malaysia（天气）、OpenStreetMap（相机）、公共高速公路和警方信息。',
    v_start: '开始导航。', v_in: '', v_m: '米后', v_km: '公里后', v_then: '然后', v_arrived: '您已到达目的地。', v_reroute: '正在重新规划路线。', v_faster: '发现更快路线，节省{n}分钟，正在切换。',
    v_alert: '您的路线上有警报。', v_clear_in: '预计疏通时间', v_camera: '前方{d}米有测速相机。', v_weather: '您所在地区有天气警报。',
    no_alerts: '此区域暂无警报。', reported: '谢谢 — 报告已发送', report_fail: '报告失败', no_gps: '等待GPS…', found_near: '沿途', detour: '绕行', min: '分钟',
    plan_title:'计划出发', leave_at:'出发时间', plan_check:'查看预计到达', plan_now:'回到现在出发', voice_level:'语音提醒', vl_all:'全部提醒', vl_imp:'仅重要提醒', auto_night:'自动夜间模式 (7pm–7am)', fuel_type:'燃油', consumption:'油耗 (L/100 km)', home:'家', work:'公司', set_home:'设为家', set_work:'设为公司', saved:'已保存', add_stop:'添加途经点', stops:'个途经点', fuel_cost:'油费', est:'约', parking:'停车', near_dest:'目的地附近', say_report:'请说：塞车、车祸、警察、水灾、相机…', heard:'听到', not_understood:'听不懂', listening:'正在听…', fuel_week:'本周油价', arriving:'即将到达 — 找停车位？', leaving_at:'出发', v_slow:'请减速。', recent:'最近',
    exit:'出口', fatigue_title:'累了吗？', fatigue_msg:'您已连续驾驶 {time}。累了吗？为了安全，休息一下吧。', fatigue_rest:'最近的休息站', fatigue_fuel:'加油站', fatigue_ok:'我没事', fatigue_set:'连续驾驶休息提醒', fatigue_every:'每隔提醒', not_here:'不是您要找的地点？', not_found:'此处找不到', open_in:'打开“{app}”搜索并导航', alt_nav:'备用导航（找不到地点时）', va_prompt:'请说，去哪里？', va_routing:'前往{name}，{min}。说出发开始，或说取消。', va_notfound:'抱歉，找不到{q}。', va_cancelled:'已取消。', va_stopped:'已停止。', va_no_route:'还没有路线。请说：去，加地点。', va_timeout:'好的，需要时说 Hello Navora。', mic_denied:'麦克风被阻止 — 请在浏览器设置允许', wake_word:'"Hello Navora" 唤醒词 (Android)', va_tip:'说 "Hello Navora" 然后 "去 KLCC"、"回家"、"报告塞车"、"多久"、"停止"。',
    help:'帮助', manual_link:'📖 使用手册 & 为什么选 Navora',
    share_text: '我正在前往{dest}，大约{eta}到达。', copied: '位置已复制', faster: '更快路线：节省{n}分钟', new_on_route: '路线上有新情况'
  }
};
let LANG = localStorage.getItem('nv_lang') || (navigator.language.startsWith('ms') ? 'ms-MY' : navigator.language.startsWith('zh') ? 'zh-TW' : 'en-GB');
function T(k, vars) { let s = (I18N[LANG] && I18N[LANG][k]) || I18N['en-GB'][k] || k; if (vars) Object.keys(vars).forEach(v => { s = s.replace('{' + v + '}', vars[v]); }); return s; }
function applyI18n() {
  document.querySelectorAll('[data-i]').forEach(el => { el.textContent = T(el.dataset.i); });
  const s = document.getElementById('search'); if (s) s.placeholder = T('where_to');
  document.documentElement.lang = LANG.split('-')[0];
}
