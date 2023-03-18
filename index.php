<?php
function esc_html($str, $flags = ENT_QUOTES) { if (is_null($str)) return null; return htmlspecialchars($str, $flags, 'UTF-8'); }
function output($str) { echo esc_html($str); }
?>
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>MDN翻訳ステータス一覧表</title>
    <link rel="stylesheet" href="style.css" />
    <script src="script.js"></script>
  </head>
  <body>
    <header>
      <h1><a href="/">MDN翻訳ステータス一覧表</a></h1>
      <ul>
        <li>毎日更新しています。1日1回、リポジトリを最新の状態にしてファイルを全スキャンした結果を json に出力しています。
          <ul>
            <li>nth の値はスキャンごとに変動する可能性があります。nth は ID ではないのでご注意ください。</li>
          </ul>
        </li>
        <li>フィルタリングは、ラジオボタンを変更するか、input 内で Enter を押すと実行されます。</li>
        <li>更新履歴：
          <ul class="updates">
            <li>（2022/2/21）初版を公開しました。JSONデータは2月21日時点のスナップショットです。</li>
            <li>（2022/3/27）JSONデータを毎日更新するようにしました。</li>
            <li>（2022/3/30）DOMレンダリングのタイミングを制御して、5秒〜10秒かかっていた処理を1秒程度まで高速化しました。</li>
            <li>（2022/7/24）title の文言が CDATA 扱いになっていて &amp;lt; などと表示されていたので RCDATA 相当の表示に変更しました。</li>
            <li>（2022/7/26）en-tags を追加しました。en-tags のフィルタだけ大文字小文字を区別します（Case-Sensitive）。他のフィルタは Case-Insensitive です。</li>
            <li>（2022/7/31）en-size を追加しました。ソート機能を追加しましたが、Firefox 以外のブラウザだと動作が重いですね。</li>
            <li>（2022/8/3）ページャ機能を追加して動作が軽くなるようにしました。ただ class 構文を使っているので iOS Safari 14 などでは動かなくなってしまいました。<a href="https://mdn-20220731.lavoscore.org/">7/31時点の実装</a>を残しておきます。</li>
            <li>（2022/8/8）ja-updated を追加しました。降順ソートすれば日本語版の更新（反映）状況を確認できます。</li>
            <li>（2022/8/22）(en/ja)-bad-bcd-queries を追加しました。null は query 記述なし、false は記述があるが valid、それ以外は bad な query です。</li>
            <li>（2023/2/2）既に全ファイルの index.md 化が完了しているので html か md かを表す ja-file 列を削除しました。</li>
            <li>（2023/2/2）title を実際の URL アクセスの結果ではなく index.md から抽出するようにしました。</li>
            <li>（2023/2/2）ソースコードを公開しました。<a href="https://github.com/debiru/mdn-translation-docs">https://github.com/debiru/mdn-translation-docs</a></li>
            <li>（2023/3/18）<a href="https://github.com/mdn/mdn/issues/262">en-tags が削除された</a>ので代わりに en-meta を追加しました。title, slug, browser-compat 以外のキーを表示しています。</li>
          </ul>
        </li>
        <li>一覧表の元となる<a href="all.json">JSONデータはこちら</a>です。</li>
        <li>このスクリプトの著者へ連絡したい場合は <a href="https://mozillajp.slack.com">Japanese Mozilla community group の Slack</a> で @debiru_R にメンションするか Twitter の <a href="https://twitter.com/debiru_R">@debiru_R</a> までご連絡ください。</li>
        <li>典型的なクエリ例：<a href="/">クエリリセット</a>、<a href="https://mdn2.lavoscore.org/?regex_meta=%22%28%3F%21page-type%29%28%3F%21spec-urls%29%5B%5E%22%5D*%22%3A">指定したキー以外をmetaに含むページ</a>、<a href="<?php output('?regex_b=glossary&sort=size-asc&filter=not-ja'); ?>">日本語版がないglossary一覧</a>、<a href="<?php output('?not_regex_bcd_ja=%5E%28null%7C%7Cfalse%29%24&regex_bcd_en=%5E%28null%7Cfalse%29%24'); ?>">日本語版が修正可能なBad-BCD-queries一覧</a></li>
      </ul>
    </header>
    <main id="tableWrapper"><table id="table">
      <thead>
        <tr id="labels">
          <th class="count num">#</th>
          <th class="en-nth num">en-nth</th>
          <th class="en-size size">en-size</th>
          <th class="en-meta meta">en-meta</th>
          <th class="en-title title">en-title</th>
          <th class="en-url url">en-url</th>
          <th class="en-query query">en-bad-bcd-queries</th>
          <th class="ja-nth num">ja-nth</th>
          <th class="ja-title title">ja-title</th>
          <th class="ja-url url">ja-url</th>
          <th class="ja-query query">ja-bad-bcd-queries</th>
          <th class="ja-updated date">ja-updated</th>
        </tr>
      </thead>
    </table></main>
  </body>
</html>
