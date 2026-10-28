<?php
// Geometry helpers + Google geocoding
require_once __DIR__ . '/store.php';

function kr_haversine($lat1, $lng1, $lat2, $lng2) {
  $R = 6371000; $dLat = deg2rad($lat2 - $lat1); $dLng = deg2rad($lng2 - $lng1);
  $a = sin($dLat/2)**2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng/2)**2;
  return 2 * $R * asin(sqrt($a));
}
function kr_in_bbox($lat, $lng, $n, $e, $s, $w) { return $lat <= $n && $lat >= $s && $lng <= $e && $lng >= $w; }

// Decode Google encoded polyline → [[lat,lng],...]
function kr_decode_polyline($str) {
  $pts = []; $i = 0; $lat = 0; $lng = 0; $len = strlen($str);
  while ($i < $len) {
    foreach (['lat', 'lng'] as $k) {
      $shift = 0; $result = 0;
      do { $b = ord($str[$i++]) - 63; $result |= ($b & 0x1f) << $shift; $shift += 5; } while ($b >= 0x20);
      $d = ($result & 1) ? ~($result >> 1) : ($result >> 1);
      if ($k === 'lat') $lat += $d; else $lng += $d;
    }
    $pts[] = [$lat / 1e5, $lng / 1e5];
  }
  return $pts;
}
// Min distance (m) from point to polyline (segment-wise, equirectangular approx — fine for MY)
function kr_dist_to_path($lat, $lng, array $path) {
  $best = INF; $cosLat = cos(deg2rad($lat));
  $px = $lng * $cosLat; $py = $lat;
  for ($i = 0; $i < count($path) - 1; $i++) {
    $ax = $path[$i][1] * $cosLat; $ay = $path[$i][0]; $bx = $path[$i+1][1] * $cosLat; $by = $path[$i+1][0];
    $dx = $bx - $ax; $dy = $by - $ay; $l2 = $dx*$dx + $dy*$dy;
    $t = $l2 ? max(0, min(1, (($px-$ax)*$dx + ($py-$ay)*$dy) / $l2)) : 0;
    $cx = $ax + $t*$dx; $cy = $ay + $t*$dy;
    $d = sqrt(($px-$cx)**2 + ($py-$cy)**2) * 111320;
    if ($d < $best) $best = $d;
  }
  return $best;
}

// Geocode a Malaysian road/place description → [lat,lng] or null. TomTom Search (free tier), Google as optional fallback. Cached.
function kr_geocode($text) {
  if (!$text) return null;
  $key = md5(mb_strtolower(trim($text)));
  $cache = kr_read('geocache');
  if (!empty($cache[$key])) return $cache[$key];   // only successful lookups are cached (a failed key must not poison the cache)
  $cfg = kr_cfg(); $res = null;
  $tk = $cfg['TOMTOM_KEY'];
  if ($tk && !str_starts_with($tk, 'YOUR_')) {
    [$code, $body] = kr_http('https://api.tomtom.com/search/2/geocode/' . rawurlencode($text) . '.json?' . http_build_query(['key' => $tk, 'countrySet' => 'MY', 'limit' => 1, 'language' => 'en-GB']));
    if ($code !== 200) kr_log("geocode HTTP $code: " . substr(preg_replace('/\\s+/', ' ', (string)$body), 0, 120));
    $j = json_decode($body, true); $p = $j['results'][0]['position'] ?? null;
    if ($p) $res = ['lat' => $p['lat'], 'lng' => $p['lon']];
  }
  $gk = $cfg['GOOGLE_SERVER_KEY'] ?? '';
  if (!$res && $gk && !str_starts_with($gk, 'YOUR_')) {
    [$code, $body] = kr_http('https://maps.googleapis.com/maps/api/geocode/json?' . http_build_query(['address' => $text, 'region' => 'my', 'components' => 'country:MY', 'key' => $gk]));
    $j = json_decode($body, true); $loc = $j['results'][0]['geometry']['location'] ?? null;
    if ($loc) $res = ['lat' => $loc['lat'], 'lng' => $loc['lng']];
  }
  if ($res) kr_update('geocache', function ($c) use ($key, $res) { $c[$key] = $res; if (count($c) > 5000) $c = array_slice($c, -4000, null, true); return $c; });
  return $res;
}
