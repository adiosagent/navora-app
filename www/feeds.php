<?php
// Feed sources: RSS/Atom + public Telegram channels (via t.me/s/<channel> HTML) + TomTom incidents
require_once __DIR__ . '/store.php';

// Default feed list — editable in data/feeds.json (created on first run). Verify URLs/channel names before relying on them.
function kr_default_feeds() {
  return [
    ['id' => 'bernama',   'kind' => 'rss', 'source' => 'Bernama',        'url' => 'https://www.bernama.com/en/rss/general.xml', 'filter' => 'traffic|jam|highway|accident|lebuhraya|kemalangan|banjir|flood|road|jalan|closure|PLUS|LDP|MRR2|SPRINT|NKVE|ELITE|DUKE|KESAS'],
    ['id' => 'star',      'kind' => 'rss', 'source' => 'The Star',       'url' => 'https://www.thestar.com.my/rss/News/Nation', 'filter' => 'traffic|jam|highway|accident|flood|road|closure|landslide'],
    ['id' => 'nst',       'kind' => 'rss', 'source' => 'NST',            'url' => 'https://www.nst.com.my/news/nation.rss', 'filter' => 'traffic|jam|highway|accident|flood|road|closure|landslide'],
    ['id' => 'hmetro',    'kind' => 'rss', 'source' => 'Harian Metro',   'url' => 'https://www.hmetro.com.my/mutakhir.rss', 'filter' => 'trafik|sesak|lebuhraya|kemalangan|banjir|jalan|ditutup|tanah runtuh'],
    // Public Telegram channels: use the channel username (verify these exist / find the active ones)
    ['id' => 'tg_plus',   'kind' => 'telegram', 'source' => 'PLUS Trafik',  'channel' => 'PLUSTrafik', 'filter' => ''],
    ['id' => 'tg_llm',    'kind' => 'telegram', 'source' => 'LLM Trafik',   'channel' => 'LLMinfotrafik', 'filter' => ''],
    ['id' => 'tg_pdrm',   'kind' => 'telegram', 'source' => 'PDRM Trafik',  'channel' => 'PDRMTrafik', 'filter' => ''],
    ['id' => 'tg_met',    'kind' => 'telegram', 'source' => 'MET Malaysia', 'channel' => 'metmalaysia', 'filter' => 'amaran|warning|ribut|hujan lebat|banjir'],
  ];
}
function kr_feeds() {
  $f = kr_read('feeds', null);
  if ($f === null) { $f = kr_default_feeds(); kr_write('feeds', $f); }
  return $f;
}

// Returns array of ['ref','source','text','url','ts']
function kr_fetch_feed(array $feed) {
  $items = [];
  try {
    if ($feed['kind'] === 'rss') {
      [$code, $body] = kr_http($feed['url']);
      if ($code !== 200 || !$body) return [];
      libxml_use_internal_errors(true);
      $x = simplexml_load_string($body); if (!$x) return [];
      $entries = isset($x->channel->item) ? $x->channel->item : ($x->entry ?? []);
      foreach ($entries as $e) {
        $title = trim((string)$e->title); $desc = trim(strip_tags((string)($e->description ?? $e->summary ?? '')));
        $link = (string)($e->link['href'] ?? $e->link ?? ''); $date = (string)($e->pubDate ?? $e->updated ?? $e->published ?? '');
        $ts = $date ? strtotime($date) : time();
        $items[] = ['ref' => $feed['id'] . ':' . substr(md5($link ?: $title), 0, 10), 'source' => $feed['source'], 'text' => "$title\n$desc", 'url' => $link, 'ts' => $ts ?: time()];
      }
    } elseif ($feed['kind'] === 'telegram') {
      [$code, $body] = kr_http('https://t.me/s/' . $feed['channel']);
      if ($code !== 200 || !$body) return [];
      // Each post: <div class="tgme_widget_message_wrap"> ... data-post="chan/123" ... <div class="tgme_widget_message_text">...</div> ... <time datetime="...">
      if (preg_match_all('/data-post="([^"]+)".*?tgme_widget_message_text[^>]*>(.*?)<\/div>.*?<time[^>]*datetime="([^"]+)"/s', $body, $m, PREG_SET_ORDER)) {
        foreach ($m as $p) {
          $text = trim(html_entity_decode(strip_tags(preg_replace('/<br\s*\/?>/i', "\n", $p[2]))));
          if ($text === '') continue;
          $items[] = ['ref' => $feed['id'] . ':' . substr(md5($p[1]), 0, 10), 'source' => $feed['source'], 'text' => $text, 'url' => 'https://t.me/' . $p[1], 'ts' => strtotime($p[3]) ?: time()];
        }
      }
    }
  } catch (Throwable $t) { kr_log("feed {$feed['id']} error: " . $t->getMessage()); }

  // keyword filter + only last 6 hours
  $cut = time() - 6 * 3600;
  return array_values(array_filter($items, function ($it) use ($feed, $cut) {
    if ($it['ts'] < $cut) return false;
    if (!empty($feed['filter']) && !preg_match('/' . $feed['filter'] . '/iu', $it['text'])) return false;
    return true;
  }));
}

// TomTom Traffic Incidents → already-geocoded alerts
/* TomTom incidentDetails allows a bbox of max 10,000 km2 per call, so Malaysia is scanned as regional boxes (~90 km squares) */
function kr_tomtom_boxes() {
  return [
    'Klang Valley'      => [101.25, 2.75, 102.05, 3.45],
    'Seremban–Melaka'   => [101.75, 2.05, 102.55, 2.75],
    'Muar–Segamat'      => [102.40, 1.90, 103.20, 2.60],
    'Johor Bahru'       => [103.30, 1.30, 104.10, 2.00],
    'Perak (Ipoh)'      => [100.80, 4.20, 101.60, 4.90],
    'Perak South'       => [101.00, 3.50, 101.80, 4.20],
    'Penang–Kedah'      => [100.15, 5.10, 100.95, 5.80],
    'Kedah North'       => [100.10, 5.80, 100.90, 6.50],
    'Kuantan'           => [102.90, 3.50, 103.70, 4.20],
    'Kota Bharu'        => [101.90, 5.70, 102.70, 6.40],
    'Kuala Terengganu'  => [102.80, 4.90, 103.60, 5.60],
    'Kuching'           => [110.10, 1.30, 110.90, 2.00],
    'Kota Kinabalu'     => [115.80, 5.60, 116.60, 6.30],
  ];
}
function kr_fetch_tomtom() {
  $cfg = kr_cfg(); $k = $cfg['TOMTOM_KEY'];
  if (!$k || str_starts_with($k, 'YOUR_')) return [];
  $all = []; $errs = 0;
  foreach (kr_tomtom_boxes() as $name => $b) {
    $url = 'https://api.tomtom.com/traffic/services/5/incidentDetails?' . http_build_query([
      'key' => $k, 'bbox' => implode(',', $b),
      'fields' => '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}',
      'language' => 'en-GB', 'timeValidityFilter' => 'present',
    ]);
    [$code, $body] = kr_http($url, ['timeout' => 25]);
    if ($code !== 200) { $errs++; if ($errs <= 2) kr_log("TomTom HTTP $code ($name): " . substr(preg_replace('/\s+/', ' ', (string)$body), 0, 160)); continue; }
    $j = json_decode($body, true);
    foreach ($j['incidents'] ?? [] as $inc) $all[] = $inc;
  }
  $j = ['incidents' => $all]; $out = [];
  // iconCategory: 1 accident,2 fog,3 dangerous conditions,4 rain,5 ice,6 jam,7 lane closed,8 road closed,9 road works,10 wind,11 flooding,14 broken down vehicle
  $typeMap = [1=>'accident',2=>'weather',3=>'hazard',4=>'weather',5=>'weather',6=>'jam',7=>'closure',8=>'closure',9=>'roadwork',10=>'weather',11=>'flood',14=>'hazard'];
  foreach ($j['incidents'] ?? [] as $inc) {
    $p = $inc['properties']; $g = $inc['geometry'];
    $c = $g['type'] === 'Point' ? $g['coordinates'] : ($g['coordinates'][intdiv(count($g['coordinates']), 2)] ?? null);
    if (!$c) continue;
    $type = $typeMap[$p['iconCategory']] ?? 'hazard';
    $mag = (int)($p['magnitudeOfDelay'] ?? 0); // 0 unknown,1 minor,2 moderate,3 major,4 undefined(closure)
    $sev = $mag >= 3 || in_array($p['iconCategory'], [8, 11]) ? 3 : ($mag === 2 ? 2 : 1);
    $desc = $p['events'][0]['description'] ?? ucfirst($type);
    $road = $p['roadNumbers'][0] ?? '';
    $from = $p['from'] ?? ''; $to = $p['to'] ?? '';
    $delay = (int)($p['delay'] ?? 0);
    $out[] = [
      'id' => 'tt_' . substr(md5($p['id']), 0, 12), 'type' => $type, 'severity' => $sev,
      'title' => trim($desc . ($road ? " on $road" : '') . ($from ? " near $from" : '')),
      'road' => $road ?: $from, 'direction' => $to ? "towards $to" : '',
      'lat' => $c[1], 'lng' => $c[0], 'source' => 'TomTom', 'url' => '',
      'eta_clear' => $delay ? round($delay / 60) . ' min delay' : '', 'confidence' => 0.85,
      'ts' => strtotime($p['startTime'] ?? 'now') ?: time(),
      'expires' => !empty($p['endTime']) ? strtotime($p['endTime']) : time() + 90 * 60,
      'confirmations' => 0,
    ];
  }
  return $out;
}
