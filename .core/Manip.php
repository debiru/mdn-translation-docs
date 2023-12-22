<?php
require_once(__DIR__.'/vendor/autoload.php');
require_once(__DIR__.'/Util.php');
require_once(__DIR__.'/BCD.php');

use \Symfony\Component\Yaml\Yaml as Yaml;

class Manip {
  protected $baseDir;
  protected $contentRepoDir;
  protected $translatedRepoDir;
  protected $interactiveExamplesRepoDir;
  protected $enDir;
  protected $jaDir;
  protected $allJsonPath;
  protected $bcdJsonPath;
  protected $bcd;
  protected $interactiveExamples;

  protected $debugSkip = false;

  public function __construct() {
    self::init();
  }

  public static function output($str, $newline = true) {
    echo $str;
    if ($newline) echo PHP_EOL;
  }

  /**
   * リポジトリ等のファイル/ディレクトリパスをセットする
   */
  protected function init() {
    // /public_html/core/Manip.php => /public_html
    $this->baseDir = dirname(__DIR__);
    $this->contentRepoDir = Util::concatPath($this->baseDir, '.repo/content');
    $this->translatedRepoDir = Util::concatPath($this->baseDir, '.repo/translated-content');
    $this->interactiveExamplesRepoDir = Util::concatPath($this->baseDir, '.repo/interactive-examples');
    $this->enDir = Util::concatPath($this->contentRepoDir, 'files/en-us');
    $this->jaDir = Util::concatPath($this->translatedRepoDir, 'files/ja');
    $this->allJsonPath = Util::concatPath($this->baseDir, 'all.json');
    $this->bcdJsonPath = Util::concatPath($this->baseDir, 'bcd/bcd.json');
    $this->setBCD();
    $this->setInteractiveExamples();
  }

  /**
   * MDN が公開している Browser-Compat-Data の json ファイルを
   * ダウンロードして $this->bcd に展開する
   */
  protected function setBCD() {
    if (!$this->debugSkip) {
      chdir(__DIR__);
      self::output('[start] Download ./browser-compat-data/data.json');
      $cmd = Util::mycmd("./browser-compat-data/download.sh");
      Util::myexec($cmd);
      self::output('[end] Download ./browser-compat-data/data.json');
    }
    $this->bcd = Util::getJson(__DIR__.'/browser-compat-data/data.json');
  }

  /**
   * interactive-examples リポジトリ内のデータを基に
   * 有効な EmbedInteractiveExample のキーを $this->interactiveExample に展開する
   */
  protected function setInteractiveExamples() {
    $this->interactiveExamples = [];

    $cmd = Util::mycmd("find %s -name 'meta.json'", $this->interactiveExamplesRepoDir);
    Util::myexec($cmd, $output);
    if (count($output) === 0) {
      throw new Exception(sprintf('[find interactiveExamples meta.json] find failed. (%s)', $this->interactiveExamplesRepoDir));
    }
    foreach ($output as $metaFile) {
      $obj = Util::getJson($metaFile);
      if (!isset($obj['pages'])) continue;
      foreach ($obj['pages'] as $page) {
        $key = sprintf('pages/%s/%s', $page['type'], $page['fileName']);
        $this->interactiveExamples[$key] = true;
      }
    }
  }

  /**
   * エントリポイント
   */
  public function generateAllJson() {
    if (!$this->debugSkip) {
      self::output('[start] git pull');
      $this->gitPull($this->contentRepoDir);
      $this->gitPull($this->translatedRepoDir);
      $this->gitPull($this->interactiveExamplesRepoDir);
      self::output('[end] git pull');
    }

    $jsonObject = $this->makeJsonObject();
    Util::setJson($this->allJsonPath, $jsonObject);
    self::output('*** Generated all.json ***');

    $bcdResult = BCD::getResult($this->bcd);
    Util::setJson($this->bcdJsonPath, $bcdResult);
    self::output('*** Generated bcd.json ***');
  }

  /**
   * リポジトリディレクトリ $dir で git pull を実行する
   */
  protected function gitPull($dir) {
    if (!chdir($dir)) {
      throw new Exception(sprintf('[gitPull] chdir failed. (%s)', $dir));
    }

    $cmd = Util::mycmd("git fetch -p");
    if (!Util::myexec($cmd)) {
      throw new Exception(sprintf('[gitPull] git fetch -p failed. (%s)', $dir));
    }

    $cmd = Util::mycmd("git merge origin/main");
    if (!Util::myexec($cmd)) {
      throw new Exception(sprintf('[gitPull] git merge failed. (%s)', $dir));
    }

    // 元の場所に戻っておく
    chdir(__DIR__);
  }

  /**
   * $targetDir に含まれる index.md を全てリストアップする
   */
  protected function findIndexFile($targetDir) {
    // index.md ファイルのパスをディレクトリベースでソートしておく
    $cmd = Util::mycmd("find %s -name 'index.md' | awk '{print $0, $0}' | perl -pe 's/index.md//' | sort | awk '{print $2}'", $targetDir);
    Util::myexec($cmd, $output);
    if (count($output) === 0) {
      throw new Exception(sprintf('[findIndexFile] find failed. (%s)', $targetDir));
    }
    return $output;
  }

  /**
   * ['/games' => '/path/to/public_html/repo/content/files/en-us/games/index.md', ...]
   * $targetDir にある index.md ファイルのリストを上記の形式で返す
   */
  protected function makeIndexList($targetDir) {
    $output = $this->findIndexFile($targetDir);

    $list = [];
    foreach ($output as $line) {
      $dir = Util::removePrefix(dirname($line), $targetDir);
      $list[$dir] = $line;
    }

    return $list;
  }

  /**
   * git log 情報を基にして $this->jaDir に含まれる全ファイルの最終更新日を取得し
   * $filePath の最終更新日を返す
   */
  protected function getJaUpdated($filePath) {
    static $map = [];

    if (empty($map)) {
      chdir(__DIR__);
      $cmd = Util::mycmd("./git-updated-at-files.sh %s", $this->jaDir);
      Util::myexec($cmd, $output);

      foreach ($output as $line) {
        $values = explode(Util::TAB, $line);
        $path = Util::concatPath($this->translatedRepoDir, $values[0]);
        $date = $values[1];
        $map[$path] = $date;
      }
    }

    return $map[$filePath];
  }

  /**
   * メインルーチン
   * makeIndexList を基に all.json を構築する
   */
  protected function makeJsonObject() {
    self::output('[start] makeJsonObject');

    $en = $this->makeIndexList($this->enDir);
    $ja = $this->makeIndexList($this->jaDir);

    $en_nth = 0;
    $ja_nth = 0;

    $list = [];
    // 英語版が存在するページ
    foreach ($en as $dir => $line) {
      $list[$dir] = $this->makeEnItem($line, $en_nth);
      // 更に日本語版も存在するページ
      if (isset($ja[$dir])) {
        $list[$dir] += $this->makeJaItem($ja[$dir], $ja_nth);
        // 参照した日本語ページを削除する
        unset($ja[$dir]);
      }
    }

    // 日本語版のみ存在するページ（削除されなかったページ）
    foreach ($ja as $dir => $line) {
      $list[$dir] = $this->makeJaItem($line, $ja_nth);
    }

    $jsonObject = [];
    $jsonObject['info'] = [
      'en_count' => $en_nth,
      'ja_count' => $ja_nth,
      'ja_only_conut' => count($ja),
      'updated_at' => Util::strtodate(),
    ];
    $jsonObject['list'] = $list;

    self::output('[end] makeJsonObject');

    return $jsonObject;
  }

  /**
   * index.md ファイルの上部の YAML 部分を取り出して
   * YAML parse した結果を返す
   */
  protected function getFrontMatter($filePath) {
    $buf = Util::file_get_contents($filePath);
    $lines = explode(PHP_EOL, $buf);

    $cnt = 0;
    $endIdx = null;
    foreach ($lines as $idx => $line) {
      if ($line === '---') ++$cnt;
      if ($cnt === 2) {
        $endIdx = $idx;
        break;
      }
    }
    if ($cnt !== 2) return '';
    $lines = array_slice($lines, 0, $endIdx);
    array_shift($lines);

    $yaml = implode(PHP_EOL, $lines);
    $result = null;
    try {
      $result = Yaml::parse($yaml);
    }
    catch (Exception $e) {
      $result = ['title' => '(YAML parse error)'];
    }
    return $result;
  }

  /**
   * $filePath のファイルサイズを返す
   */
  protected function getFileSize($filePath) {
    return filesize($filePath);
  }

  /**
   * $this->bcd を基に $query が存在するかどうかを判定する
   */
  protected function validateBcdQuery($query) {
    $keys = explode('.', $query);
    $obj = $this->bcd;
    foreach ($keys as $key) {
      if (!isset($obj[$key])) return false;
      $obj = $obj[$key];
    }
    return true;
  }

  /**
   * Front-matter の browser-compat の値を validate した結果を返す
   * browser-compat の値は文字列または配列である
   */
  protected function parseMetaCompatBrowser($meta) {
    $ret = null;
    $queries = (array)($mata['browser-compat'] ?? []);
    if ($queries) {
      $ret = [];
      foreach ($queries as $query) {
        $valid = $this->validBcdQuery($query);
        if (!$valid) $ret[] = $query;
      }
    }
    return $ret;
  }

  /**
   * index.md 本文にある {{compat}} マクロで使われている
   * $query の値を validate した結果を返す
   */
  protected function parseCompatMacro($buf) {
    $ret = null;
    if (preg_match_all('/{{compat\("([^"]+)"/i', $buf, $m)) {
      $ret = [];
      foreach ($m[1] as $query) {
        $valid = $this->validateBcdQuery($query);
        if (!$valid) $ret[] = $query;
      }
    }
    return $ret;
  }

  /**
   * index.md の Front-matter または本文中の $query について
   * invalid なものの具体値を配列にして返す
   */
  protected function getBadBcdQueries($line, $meta) {
    $buf = Util::file_get_contents($line);

    $retMeta = $this->parseMetaCompatBrowser($meta);
    $retMacro = $this->parseCompatMacro($buf);
    $isNull = $retMeta === null && $retMacro === null;

    $ret = [];
    if ($retMeta) $ret += $retMeta;
    if ($retMacro) $ret += $retMacro;

    if (count($ret) === 0) return $isNull ? null : false;
    return $ret;
  }

  /**
   * $this->interactiveExamples を基に $key が存在するかどうかを判定する
   */
  protected function validateInteractiveExample($key) {
    return isset($this->interactiveExamples[$key]);
  }

  /**
   * index.md の本文中の EmbedInteractiveExample の $key について
   * invalid なものの具体値を配列にして返す
   */
  protected function getBadInteractiveExamples($line) {
    $buf = Util::file_get_contents($line);

    $ret = null;
    if (preg_match_all('/{{EmbedInteractiveExample\("([^"]+)"/i', $buf, $m)) {
      $ret = [];
      foreach ($m[1] as $key) {
        $valid = $this->validateInteractiveExample($key);
        if (!$valid) $ret[] = $key;
      }
    }
    if ($ret === null) return null;
    if (count($ret) === 0) return false;
    return $ret;
  }

  /**
   * $ids を基に $key が存在するかどうかを判定する
   */
  protected function validateLiveSample($key, $ids, $headingLevel, $hasCode, $hasContentH3) {
    if (isset($ids[strtolower($key)])) return true;
    if ($hasCode) return true;
    if ($hasContentH3 === false && $headingLevel >= 4) return false;
    if ($headingLevel <= 4) return true;
    return false;
  }

  /**
   * index.md の本文中の EmbedLiveSample の $key について
   * invalid なものの具体値を配列にして返す
   */
  protected function getBadLiveSamples($filePath) {
    $buf = Util::file_get_contents($filePath);

    $ids = [];
    if (preg_match_all('/^#+\s*([^\n]+)/m', $buf, $m)) {
      foreach ($m[1] as $heading) {
        $id = preg_replace('/ /', '_', strtolower($heading));
        $id = preg_replace('/[\(\):]/', '', $id);
        $ids[$id] = true;
      }
    }
    if (preg_match_all('/\sid="([^"]+)"/', $buf, $m)) {
      foreach ($m[1] as $id) {
        $ids[strtolower($id)] = true;
      }
    }

    $ret = null;
    $lines = explode(PHP_EOL, $buf);
    $headingLevel = 0;
    $hasHtml = false;
    $hasCss = false;
    $hasContentH3 = false;
    foreach ($lines as $line) {
      if (preg_match('/^(##+)/', $line, $m)) {
        $level = strlen($m[1]);
        if ($headingLevel > $level) $hasContentH3 = false;
        $headingLevel = $level;
        $hasHtml = false;
        $hasCss = false;
      }
      elseif ($headingLevel === 3) {
        if (preg_match('/\S.*/', $line, $m)) {
          $hasContentH3 = true;
        }
      }
      if (preg_match('/^```html/', $line, $m)) {
        $hasHtml = true;
      }
      if (preg_match('/^```css/', $line, $m)) {
        $hasCss = true;
      }
      if (preg_match_all('/{{\s*EmbedLiveSample\([\'"]([^\'"]+)/i', $line, $m)) {
        if ($ret === null) $ret = [];
        foreach ($m[1] as $key) {
          $valid = $this->validateLiveSample($key, $ids, $headingLevel, $hasHtml && $hasCss, $hasContentH3);
          if (!$valid) $ret[] = $key;
        }
      }
    }
    if ($ret === null) return null;
    if (count($ret) === 0) return false;
    return $ret;
  }

  /**
   * 英語記事の情報を連想配列にして返す
   */
  protected function makeEnItem($line, &$en_nth) {
    $item = [];
    $meta = $this->getFrontMatter($line);

    $item['en_nth'] = ++$en_nth;
    $item['en_title'] = $meta['title'] ?? '(untitled)';
    $item['en_size'] = $this->getFileSize($line);
    $item['en_bad_bcd_queries'] = $this->getBadBcdQueries($line, $meta);
    $item['en_bad_interactive_examples'] = $this->getBadInteractiveExamples($line);

    unset($meta['title']);
    unset($meta['slug']);
    unset($meta['browser-compat']);
    if (count($meta) > 0) $item['en_meta'] = $meta;

    return $item;
  }

  /**
   * 日本語記事の情報を連想配列にして返す
   */
  protected function makeJaItem($line, &$ja_nth) {
    $item = [];
    $meta = $this->getFrontMatter($line);

    $item['ja_nth'] = ++$ja_nth;
    $item['ja_title'] = $meta['title'] ?? '(untitled)';
    $item['ja_updated'] = $this->getJaUpdated($line);
    $item['ja_bad_bcd_queries'] = $this->getBadBcdQueries($line, $meta);
    $item['ja_bad_interactive_examples'] = $this->getBadInteractiveExamples($line);
    $item['ja_bad_live_samples'] = $this->getBadLiveSamples($line);

    return $item;
  }
}
