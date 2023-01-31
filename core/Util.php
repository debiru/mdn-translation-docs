<?php

class Util {
  const SLASH = '/';

  public static function generateOptions($defaultOptions, $argOptions, $useUnknownOptions = false) {
    if ($argOptions === null) return $defaultOptions;
    if ($useUnknownOptions) return array_merge($defaultOptions, $argOptions);
    $options = [];
    foreach ($defaultOptions as $key => $defaultValue) {
      $options[$key] = array_key_exists($key, $argOptions) ? $argOptions[$key] : $defaultValue;
    }
    return $options;
  }

  public static function mycmd(...$args) {
    $format = array_shift($args);
    foreach ($args as &$arg) {
      $arg = escapeshellarg($arg);
    }
    return vsprintf($format, $args);
  }

  public static function myexec($command, &$output = null, &$return_var = null) {
    exec($command, $output, $return_var);
    return $return_var === 0;
  }

  public static function normalizePathDelimiter($path, $delimiter = self::SLASH) {
    if (empty($delimiter)) return $str;
    $pattern = sprintf('!(:?%s){2,}!', preg_quote($delimiter, '!'));
    return preg_replace($pattern, $delimiter, $path);
  }

  public static function joinStr($array, $delimiter = self::SLASH) {
    return implode($delimiter, array_filter($array));
  }

  public static function concatPath(...$args) {
    return self::normalizePathDelimiter(self::joinStr($args));
  }

  public static function hasPrefix($str, $prefix) {
    return strpos($str, $prefix) === 0;
  }

  public static function hasSuffix($str, $suffix) {
    return self::hasPrefix(strrev($str), strrev($suffix));
  }

  public static function removePrefix($str, $prefix) {
    $retval = $str;
    if (!empty($prefix) && self::hasPrefix($str, $prefix)) {
      $retval = substr($str, strlen($prefix));
    }
    return $retval;
  }

  public static function removeSuffix($str, $suffix) {
    $retval = $str;
    if (!empty($suffix) && self::hasSuffix($str, $suffix)) {
      $retval = strrev(substr(strrev($str), strlen($suffix)));
    }
    return $retval;
  }

  public static function json_encode($object, $pretty = true) {
    if (is_string($object)) $object = self::json_decode($object);
    $options = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
    if ($pretty) $options |= JSON_PRETTY_PRINT;
    $json = json_encode($object, $options);
    $json .= PHP_EOL;
    return $json;
  }

  public static function json_decode($json, $associative = true) {
    if ($json === null) return;
    $object = json_decode($json, $associative, 512, JSON_BIGINT_AS_STRING);
    return $object;
  }

  public static function file_get_contents($filePath, $argOptions = null) {
    $options = self::generateOptions([
      'use_include_path' => false, 'context' => null, 'offset' => 0, 'length' => null,
    ], $argOptions);
    $result = @file_get_contents($filePath, $options['use_include_path'], $options['context'], $options['offset'], $options['length']);
    if ($result === false) $result = null;
    return $result;
  }

  public static function file_put_contents($filePath, $content, $flags = 0) {
    $dirPath = dirname($filePath);
    if (!is_dir($dirPath)) @mkdir($dirPath, 0777, true);
    return false !== @file_put_contents($filePath, $content, $flags);
  }

  public static function getJson($filePath, $associative = true) {
    $json = self::file_get_contents($filePath);
    $assoc = self::json_decode($json, $associative);
    return $assoc;
  }

  public static function setJson($filePath, $object, $pretty = true) {
    $json = self::json_encode($object, $pretty);
    return self::file_put_contents($filePath, $json);
  }

  public static function getJsonMultiLines($filePath, $argKey = null) {
    $lines = preg_split("/\n/", self::file_get_contents($filePath), 0, PREG_SPLIT_NO_EMPTY);
    $assoc = [];
    foreach ($lines as $idx => $line) {
      $value = self::json_decode($line, true);
      $key = $argKey === null ? $idx : $value[$argKey];
      $assoc[$key] = $value;
    }
    return $assoc;
  }

  public static function setJsonAppendOneLine($filePath, $object) {
    $json = self::json_encode($object, false);
    return self::file_put_contents($filePath, $json, FILE_APPEND);
  }

  public static function renderJson($json, $callbackName = null) {
    if ($callbackName === null) $callbackName = '';
    if (!preg_match('/\A[A-Za-z][0-9A-Za-z_]*\z/', $callbackName)) $callbackName = null;
    $useJsonp = $callbackName !== null;
    $json = rtrim($json);

    if ($useJsonp) {
      header('Content-Type: application/javascript; charset=utf-8');
      $jsonp = sprintf('%s(%s);', $callbackName, $json);
      echo $jsonp, PHP_EOL;
    }
    else {
      header('Content-Type: application/json; charset=utf-8');
      echo $json, PHP_EOL;
    }
  }

  public static function strtodate($str = 'now', $format = 'Y-m-d H:i:s') {
    $time = strtotime($str);
    if ($time === false) return null;
    return date($format, $time);
  }
}
