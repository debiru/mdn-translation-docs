#!/bin/sh

cd $(dirname $0)

curl -fsSL https://unpkg.com/@mdn/browser-compat-data/data.json -o data.json
