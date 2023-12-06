<?php

$json = file_get_contents(__DIR__.'/bcd.json');
$obj = json_decode($json, true);
$assoc = ['updated_at' => $obj['info']['updated_at']];
$json = json_encode($assoc, JSON_PRETTY_PRINT);

header('Content-Type: application/json; charset=utf-8');
echo $json, PHP_EOL;
