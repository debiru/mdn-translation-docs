<?php
require_once(__DIR__.'/Util.php');

class BCD {
  public static $result = [];

  public static function dfs($assoc, $bcdKey = '', $parentUrl = '') {
    if (!is_array($assoc)) return;

    if (isset($assoc['__compat'])) {
      $compat = $assoc['__compat'];
      if (empty($parentUrl)) $parentUrl = str_replace('https://developer.mozilla.org/docs/', '/', $compat['mdn_url'] ?? '');

      $support = $compat['support'];
      foreach ($support as $key => $value) {
        if (!array_key_exists('version_added', $value)) $value = $value[0];
        $support[$key] = sprintf('%s%s', isset($value['partial_implementation']) ? '!' : '', $value['version_added']);
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
