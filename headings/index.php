<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>MDN - Headings 一覧表</title>
    <link rel="stylesheet" href="style.css" />
    <script src="script.js"></script>
  </head>
  <body>
    <header>
      <h1><a href="/">MDN - Headings 一覧表</a></h1>
      <ul>
        <li><a href="https://mdn.lavoscore.org/">MDN翻訳ステータス一覧表</a>の関連ツールです。
          <ul>
            <li><a href="https://mdn-bcd.lavoscore.org/">BCD一覧表</a></li>
            <li><a href="https://mdn-headings.lavoscore.org/">Headings 一覧表</a></li>
            <li><a href="https://mdn-headings.lavoscore.org/mismatch/">Headings 不一致リスト一覧表</a></li>
          </ul>
        </li>
        <li>英語版と日本語版で見出しの構造（見出しの個数、見出しのレベル）が一致しているページを対象に、見出し語の対応付けを行っています。
          <ul>
            <li>見出しの構造が同じだが英語版と日本語版で内容が異なるページ（追従漏れ）がある場合、不適切な訳語が表示されるケースがあります。</li>
          </ul>
        </li>
        <li>表記揺れのある見出しは、クエリ <a href="https://mdn-headings.lavoscore.org/?not_regex=%5E%5C%5B1%5C%5D"><code>not_regex=^\[1\]</code></a> から参照できます。</li>
      </ul>
    </header>
    <main id="tableWrapper"><table id="table">
      <thead>
        <tr id="labels">
          <th class="count num">#</th>
          <th class="headingKey">見出し文言（英語）</th>
          <th class="headingValues">対応する翻訳文言（日本語）</th>
        </tr>
      </thead>
    </table></main>
  </body>
</html>
