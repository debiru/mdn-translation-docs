#!/bin/bash

# git 管理下にある指定したディレクトリ内に存在する
# 全てのファイルの最終更新日を取得する

cd $(dirname $0)

if [ $# -ge 1 ]; then
    cd "$1" || exit
else
    echo "Usage: $0 /path/to/repo/dir" && exit
fi

lines=$(git log --pretty=format:%cs --name-only --reverse .)

declare -A map
date=''

IFS=$'\n'
for line in $lines; do
    if [[ $line =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        date="$line"
    else
        map[$line]="$date"
    fi
done

for key in "${!map[@]}"; do
    echo -e "${key}\t${map[${key}]}"
done
