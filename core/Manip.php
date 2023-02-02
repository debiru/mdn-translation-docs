<?php
require_once(__DIR__.'/lib/Spyc.php');
require_once(__DIR__.'/Util.php');

class Manip {
  protected $baseDir;
  protected $contentRepoDir;
  protected $translatedRepoDir;
  protected $enDir;
  protected $jaDir;
  protected $allJsonPath;
  protected $bcd;

  protected $debugSkip = false;

  public function __construct() {
    self::init();
  }

  protected function init() {
    // /public_html/core/Manip.php => /public_html
    $this->baseDir = dirname(__DIR__);
    $this->contentRepoDir = Util::concatPath($this->baseDir, 'repo/content');
    $this->translatedRepoDir = Util::concatPath($this->baseDir, 'repo/translated-content');
    $this->enDir = Util::concatPath($this->contentRepoDir, 'files/en-us');
    $this->jaDir = Util::concatPath($this->translatedRepoDir, 'files/ja');
    $this->jsonPath = Util::concatPath($this->baseDir, 'all.json');
    $this->setBCD();
  }

  protected function setBCD() {
    if (!$this->debugSkip) {
      chdir(__DIR__);
      $cmd = Util::mycmd("./browser-compat-data/download.sh");
      Util::myexec($cmd);
    }
    $this->bcd = Util::getJson(__DIR__.'/browser-compat-data/data.json');
  }

  public function generateAllJson() {
    if (!$this->debugSkip) {
      $this->gitPull($this->contentRepoDir);
      $this->gitPull($this->translatedRepoDir);
    }

    $jsonObject = $this->makeJsonObject();
    Util::setJson($this->jsonPath, $jsonObject);
  }

  protected function gitPull($dir) {
    if (!chdir($dir)) {
      throw new Exception(sprintf('[gitPull] chdir failed. (%s)', $dir));
    }

    $cmd = Util::mycmd("git pull");
    if (!Util::myexec($cmd)) {
      throw new Exception(sprintf('[gitPull] git pull failed. (%s)', $dir));
    }

    // 元の場所に戻っておく
    chdir(__DIR__);
  }

  protected function findIndexFile($targetDir) {
    // index.md ファイルのパスをディレクトリベースでソート
    $cmd = Util::mycmd("find %s -name 'index.md' | awk '{print $0, $0}' | perl -pe 's/index.md//' | sort | awk '{print $2}'", $targetDir);
    Util::myexec($cmd, $output);
    if (count($output) === 0) {
      throw new Exception(sprintf('[findIndexFile] find failed. (%s)', $targetDir));
    }
    return $output;
  }

  protected function makeIndexList($targetDir) {
    $output = $this->findIndexFile($targetDir);

    $list = [];
    foreach ($output as $line) {
      $dir = Util::removePrefix(dirname($line), $targetDir);
      $list[$dir] = $line;
    }

    return $list;
  }

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

  protected function makeJsonObject() {
    $en = $this->makeIndexList($this->enDir);
    $ja = $this->makeIndexList($this->jaDir);

    $en_nth = 0;
    $ja_nth = 0;

    $list = [];
    // 英語版が存在するページ
    foreach ($en as $dir => $line) {
      $list[$dir] = $this->makeEnItem($line, $en_nth, $ja_nth);
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

    return $jsonObject;
  }

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
    try {
      return spyc_load($yaml);
    }
    catch (Exception $e) {
      // Front-matter の parse に失敗した場合
      return ['title' => '(YAML parse error)'];
    }
  }

  protected function getFileSize($filePath) {
    return filesize($filePath);
  }

  protected function validateBcdQuery($query) {
    $keys = explode('.', $query);
    $obj = $this->bcd;
    foreach ($keys as $key) {
      if (!isset($obj[$key])) return false;
      $obj = $obj[$key];
    }
    return true;
  }

  protected function parseMetaCompatBrowser($meta) {
    $ret = null;
    $queries = (array)($mata['browser-compat'] ?? null);
    if ($queries) {
      $ret = [];
      foreach ($queries as $query) {
        $valid = $this->validBcdQuery($query);
        if (!$valid) $ret[] = $query;
      }
    }
    return $ret;
  }

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

  protected function makeEnItem($line, &$en_nth, &$ja_nth) {
    $item = [];
    $meta = $this->getFrontMatter($line);

    $item['en_nth'] = ++$en_nth;
    $item['en_title'] = $meta['title'] ?? '(untitled)';
    $item['en_tags'] = $meta['tags'] ?? [];
    $item['en_size'] = $this->getFileSize($line);
    $item['en_bad_bcd_queries'] = $this->getBadBcdQueries($line, $meta);

    return $item;
  }

  protected function makeJaItem($line, &$ja_nth) {
    $item = [];
    $meta = $this->getFrontMatter($line);

    $item['ja_nth'] = ++$ja_nth;
    $item['ja_title'] = $meta['title'] ?? '(untitled)';
    $item['ja_updated'] = $this->getJaUpdated($line);
    $item['ja_bad_bcd_queries'] = $this->getBadBcdQueries($line, $meta);

    return $item;
  }
}
