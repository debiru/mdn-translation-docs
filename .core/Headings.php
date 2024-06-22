<?php
require_once(__DIR__.'/Util.php');

class Headings {
  public static $result = [];

  public static function parseFile($filePath) {
    $buf = Util::file_get_contents($filePath);
    $lines = explode(PHP_EOL, $buf);
    $headings = [];
    foreach ($lines as $line) {
      if (preg_match('/^##+/', $line, $m)) {
        $headings[] = ['text' => preg_replace('/^#+\s*/', '', $line), 'level' => strlen($m[0])];
      }
    }
    return $headings;
  }

  public static function parseFiles($enPath, $jaPath, $dir) {
    $enHeadings = self::parseFile($enPath);
    $jaHeadings = self::parseFile($jaPath);
    $len = count($enHeadings);
    if ($len === 0) return null;
    if (array_column($enHeadings, 'level') !== array_column($jaHeadings, 'level')) return ['error' => $dir];
    $enMap = [];
    $jaMap = [];
    for ($i = 0; $i < $len; ++$i) {
      $en = $enHeadings[$i]['text'];
      $ja = $jaHeadings[$i]['text'];
      $enMap[$en] = $ja;
      $jaMap[$ja] = $en;
    }
    return ['en' => $enMap, 'ja' => $jaMap];
  }

  public static function mergeHeadingsCore($objList, $lang) {
    $result = [];
    foreach ($objList as $obj) {
      foreach ($obj[$lang] as $key => $value) {
        $result[$key] ??= [];
        $result[$key][$value] ??= 0;
        ++$result[$key][$value];
      }
    }
    return $result;
  }

  public static function mergeHeadings($objList) {
    $result = [
      'en' => self::mergeHeadingsCore($objList, 'en'),
      'ja' => self::mergeHeadingsCore($objList, 'ja'),
    ];
    return $result;
  }

  public static function getResult($jsonObject, $enDir, $jaDir) {
    $result = [];
    $errors = [];
    foreach ($jsonObject['list'] as $dir => $obj) {
      $hasEn = isset($obj['en_nth']);
      $hasJa = isset($obj['ja_nth']);
      if ($hasEn && $hasJa) {
        $enPath = sprintf('%s%s/index.md', $enDir, $dir);
        $jaPath = sprintf('%s%s/index.md', $jaDir, $dir);
        $ret = self::parseFiles($enPath, $jaPath, $dir);
        if ($ret !== null) {
          if (isset($ret['error'])) {
            $errors[] = $ret['error'];
          }
          else {
            $result[] = $ret;
          }
        }
      }
    }
    $result = self::mergeHeadings($result);
    return [
      'info' => ['updated_at' => Util::strtodate()],
      'data' => [
        'list' => $result['en'],
        'errors' => $errors,
      ],
    ];
  }
}
