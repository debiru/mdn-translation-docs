<?php
require_once(__DIR__.'/Util.php');

class BCD {
  public static $result = [];

  public static function dfs($assoc, $bcdKey = '', $parentUrl = '') {
    if (!is_array($assoc)) return;

    if (isset($assoc['__compat'])) {
      $compat = $assoc['__compat'];
      if (empty($parentUrl)) $parentUrl = str_replace('https://developer.mozilla.org/docs/', '/', $compat['mdn_url'] ?? '');

      $browsers = ['chrome', 'edge', 'firefox', 'opera', 'safari', 'safari_ios'];
      $support = Util::array_filter_keys($compat['support'], $browsers);
      foreach ($support as $key => $value) {
        if (!array_key_exists('version_added', $value)) $value = $value[0];
        $versionAdded = str_replace('≤', '<=', $value['version_added']);
        $support[$key] = sprintf('%s%s', isset($value['partial_implementation']) ? '!' : '', $versionAdded);
      }

      self::$result[$bcdKey] = ['url' => $parentUrl, 'support' => $support];
    }

    foreach ($assoc as $key => $value) {
      self::dfs($value, $bcdKey === '' ? $key : sprintf('%s.%s', $bcdKey, $key), $parentUrl);
    }
  }

  public static function getResult($bcd) {
    self::dfs($bcd);
    return [
      'info' => ['updated_at' => Util::strtodate()],
      'data' => self::$result,
    ];
  }
}
