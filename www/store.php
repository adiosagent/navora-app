<?php
// Flat-JSON store with file locking (Hostinger-safe)
function nv_cfg() { static $c; return $c ??= require __DIR__ . '/../api/config.php'; }

function nv_path($name) {
  $dir = nv_cfg()['DATA_DIR'];
  if (!is_dir($dir)) mkdir($dir, 0755, true);
  return "$dir/$name.json";
}
function nv_read($name, $default = []) {
  $p = nv_path($name);
  if (!file_exists($p)) return $default;
  $fh = fopen($p, 'r'); if (!$fh) return $default;
  flock($fh, LOCK_SH); $raw = stream_get_contents($fh); flock($fh, LOCK_UN); fclose($fh);
  $d = json_decode($raw, true);
  return is_array($d) ? $d : $default;
}
function nv_write($name, $data) {
  $p = nv_path($name); $tmp = $p . '.tmp';
  file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
  rename($tmp, $p);
}
// Atomic read-modify-write
function nv_update($name, callable $fn, $default = []) {
  $p = nv_path($name);
  $fh = fopen($p, file_exists($p) ? 'r+' : 'w+');
  flock($fh, LOCK_EX);
  $raw = stream_get_contents($fh);
  $d = json_decode($raw, true); if (!is_array($d)) $d = $default;
  $d = $fn($d);
  ftruncate($fh, 0); rewind($fh);
  fwrite($fh, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($fh); flock($fh, LOCK_UN); fclose($fh);
  return $d;
}
function nv_json($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function nv_http($url, $opts = []) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $opts['timeout'] ?? 20, CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_USERAGENT => 'Navora/1.0 (+https://navora.my)',
    CURLOPT_REFERER => 'https://navora.my/',   // TomTom keys are domain-locked to navora.my; the server identifies itself the same way
    CURLOPT_HTTPHEADER => $opts['headers'] ?? [],
  ]);
  if (isset($opts['post'])) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $opts['post']); }
  $body = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return [$code, $body];
}
function nv_log($msg) {
  $f = nv_cfg()['DATA_DIR'] . '/engine.log';
  file_put_contents($f, date('c') . ' ' . $msg . "\n", FILE_APPEND);
  if (file_exists($f) && filesize($f) > 2_000_000) file_put_contents($f, ''); // rotate
}

/* ---- compatibility aliases: the engine/API code uses the kr_* names, newer helpers are nv_* ---- */
if (!function_exists('kr_cfg'))    { function kr_cfg()                                  { return nv_cfg(); } }
if (!function_exists('kr_path'))   { function kr_path($n)                               { return nv_path($n); } }
if (!function_exists('kr_read'))   { function kr_read($n, $d = [])                      { return nv_read($n, $d); } }
if (!function_exists('kr_write'))  { function kr_write($n, $data)                       { return nv_write($n, $data); } }
if (!function_exists('kr_update')) { function kr_update($n, callable $fn, $d = [])      { return nv_update($n, $fn, $d); } }
if (!function_exists('kr_json'))   { function kr_json($data, $code = 200)               { return nv_json($data, $code); } }
if (!function_exists('kr_http'))   { function kr_http($url, $opts = [])                 { return nv_http($url, $opts); } }
if (!function_exists('kr_log'))    { function kr_log($msg)                              { return nv_log($msg); } }
