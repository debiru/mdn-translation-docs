(function() {
  'use strict';

  class Util {
    static empty(arg) { return arg == null || arg === ''; }

    static clamp(value, min, max) { return Math.min(Math.max(min, value), max); }

    static JSON = {
      pretty(value) { return JSON.stringify(value, null, 2); },
      prettyCompat(value) { return Util.JSON.pretty(value).replace(/^{\n|\n}$/g, '').replace(/^  /mg, ''); },
    };

    static rcdata2cdata(str) {
      const m = {'&lt;': '<', '&gt;': '>', '&amp;': '&'};
      Object.keys(m).forEach(before => {
        const after = m[before];
        str = str.replaceAll(before, after);
      });
      return str;
    }

    static getCheckedRadioValue(inputs) {
      let checkedRadio = null;
      inputs.forEach(radio => {
        if (radio.checked) checkedRadio = radio;
      });
      return checkedRadio.value;
    }

    static setCheckedRadioValue(inputs, value) {
      inputs.forEach(radio => {
        if (radio.value === value) radio.checked = true;
      });
    }
  }

  class TableManip {
    static #columnClassNames = [];
    static elems = {};

    static getColumnClassNames() {
      if (this.#columnClassNames.length > 0) return this.#columnClassNames;

      const tr = document.getElementById('labels');
      const thList = tr.querySelectorAll('th');
      thList.forEach(th => {
        this.#columnClassNames.push(th.className);
      });
      return this.#columnClassNames;
    }

    static init() {
      this.elems.table = document.getElementById('table');
      this.elems.thead = this.elems.table.querySelector('thead');
      this.elems.tbody = document.createElement('tbody');
      this.elems.table.append(this.elems.tbody);

      this.#createFilterRow();
      Filter.createFilterElements();
    }

    static #createFilterRow() {
      const clsList = this.getColumnClassNames();
      const tr = document.createElement('tr');
      tr.id = 'filters';

      this.elems.filters = {};
      clsList.forEach(cls => {
        const th = document.createElement('th');
        th.className = cls;
        tr.append(th);

        const key = cls.split(/\s+/)[0];
        this.elems.filters[key] = th;
      });
      this.elems.thead.prepend(tr);
    }

    static setRecords(records) {
      this.records = records;
    }

    static updateRows() {
      this.clearRows();

      const fragment = document.createDocumentFragment();
      this.records.forEach(record => {
        fragment.append(record.tr);
      });
      this.elems.tbody.append(fragment);
    }

    static clearRows() {
      this.elems.tbody.innerHTML = '';
    }
  }

  class Filter {
    static radioSorts = { radios: [] };
    static regexFilters = {};
    static radioFilters = {};

    static execFilter(preventResetOffset) {
      this.preFilter();
      this.filter(preventResetOffset);
      this.postFilter();
    }

    static preFilter() {
      Main.fullRecords.forEach(record => {
        record.match = true;
      });
    }

    static postFilter() {
      this.updateCount();
    }

    static updateCount() {
      const cnt = Main.filteredRecords.length;
      TableManip.elems.filters.count.textContent = cnt;
    }

    static createFilterElements() {
      this.radioSorts.en_nth = new RadioSort('en-nth', ['nth ASC', 'nth DESC']);
      this.radioSorts.en_nth.radios[0].setAttribute('checked', 'checked');
      this.radioSorts.en_size = new RadioSort('en-size', ['size ASC', 'size DESC']);
      this.radioSorts.ja_updated = new RadioSort('ja-updated', ['date ASC', 'date DESC']);

      this.regexFilters.en_meta = new RegexFilter('en-meta');
      this.regexFilters.en_title = new RegexFilter('en-title');
      this.regexFilters.en_url = new RegexFilter('en-url');
      this.regexFilters.en_query = new RegexFilter('en-query');
      this.regexFilters.ja_title = new RegexFilter('ja-title');
      this.regexFilters.ja_url = new RegexFilter('ja-url');
      this.regexFilters.ja_query = new RegexFilter('ja-query');

      this.radioFilters.ja_nth = new RadioFilter('ja-nth', ['all', 'ja', 'not ja', 'not en', 'en']);
    }

    static filter(preventResetOffset) {
      this.execRegexFilters();
      this.execRadioFilters();

      Main.filteredRecords = [];
      Main.fullRecords.forEach(record => {
        if (record.match) Main.filteredRecords.push(record);
      });

      if (!preventResetOffset) Main.elems.offset.value = 0;

      Main.sort();
    }

    static execRegexFilters() {
      Object.keys(this.regexFilters).forEach(key => {
        const regexFilter = this.regexFilters[key];
        regexFilter.filterRecords();
      });
    }

    static execRadioFilters() {
      const ja_nth_value = Util.getCheckedRadioValue(this.radioFilters.ja_nth.radios);

      Main.fullRecords.forEach(record => {
        if (ja_nth_value === 'ja') record.updateMatch(record.ja_nth !== '');
        else if (ja_nth_value === 'not-ja') record.updateMatch(record.ja_nth === '');
        else if (ja_nth_value === 'not-en') record.updateMatch(record.en_nth === '');
        else if (ja_nth_value === 'en') record.updateMatch(record.en_nth !== '');
      });
    }
  }

  class RegexFilter {
    elems = {};

    constructor(key, caseSensitive = false) {
      this.key = key;
      this.caseSensitive = caseSensitive;
      this.#createElements();
      this.#bindElements();
    }

    #createElements() {
      this.th = TableManip.elems.filters[this.key];
      this.th.innerHTML = `
        <div class="block">
          <label>正規表現フィルタ<input type="text" data-type="regex"></label>
          <label>AND not<input type="text" data-type="not-regex"></label>
        </div>
      `;
      this.elems.regex = this.th.querySelector('input[data-type="regex"]');
      this.elems.not_regex = this.th.querySelector('input[data-type="not-regex"]');
    }

    #bindElements() {
      const textInputs = this.th.querySelectorAll('input[type="text"]');
      textInputs.forEach(input => {
        input.addEventListener('keyup', evt => {
          if (evt.key === 'Enter') Filter.execFilter();
        });

        input.addEventListener('focusout', () => {
          Filter.execFilter();
        });
      });
    }

    filterRecords() {
      const flag = this.caseSensitive ? '' : 'i';
      const regexp = new RegExp(this.elems.regex.value, flag);
      const not_regexp = new RegExp(this.elems.not_regex.value, flag);
      Main.fullRecords.forEach(record => {
        const key = this.key.replaceAll('-', '_');
        const value = record[key];
        const match = Util.empty(this.elems.regex.value) ? true : regexp.test(value);
        const not_match = Util.empty(this.elems.not_regex.value) ? false : not_regexp.test(value);
        record.updateMatch(match && !not_match);
      });
    }
  }

  class RadioSet {
    radios = [];

    constructor(key, labels, isSort) {
      this.key = key;
      this.labels = labels;
      this.isSort = isSort;
      this.#createElements();
      this.#bindElements();
    }

    #createElements() {
      this.th = TableManip.elems.filters[this.key];
      const div = document.createElement('div');
      div.className = 'group';
      this.labels.forEach(labelStr => {
        const label = document.createElement('label');
        const textNode = document.createTextNode(labelStr);
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = this.isSort ? 'radio-sort' : `radio-${this.key}`;
        input.value = labelStr.toLowerCase().replaceAll(/\s+/g, '-');
        this.radios.push(input);
        label.append(textNode, input);
        div.append(label);
      });
      if (!this.isSort) this.radios[0].setAttribute('checked', 'checked');
      this.th.append(div);
    }

    #bindElements() {
      const radioInputs = this.th.querySelectorAll('input[type="radio"]');
      radioInputs.forEach(input => {
        input.addEventListener('change', () => {
          Filter.execFilter();
        });
      });
    }
  }

  class RadioFilter extends RadioSet {}

  class RadioSort extends RadioSet {
    constructor(key, labels) {
      super(key, labels, true);

      Array.prototype.push.apply(Filter.radioSorts.radios, this.radios);

      const p = document.createElement('p');
      p.textContent = 'Sort:';
      this.th.prepend(p);
    }
  }

  class Record {
    static BASE_URL_EN = 'https://developer.mozilla.org/en-US/docs';
    static BASE_URL_JA = 'https://developer.mozilla.org/ja/docs';
    static BASE_GIT_JA = 'https://github.com/mdn/translated-content/commits/main/files/ja';

    constructor(key, record, data) {
      this.key = key;

      this.en_nth = record.en_nth ?? '';
      this.en_size = record.en_size ?? '';
      this.en_meta = record.en_meta != null ? Util.JSON.prettyCompat(record.en_meta) : '';
      this.en_title = record.en_title ?? '';
      this.en_url = Util.empty(this.en_nth) ? '' : Record.BASE_URL_EN + this.key;

      this.ja_nth = record.ja_nth ?? '';
      this.ja_title = record.ja_title ?? '';
      this.ja_url = Util.empty(this.ja_nth) ? '' : Record.BASE_URL_JA + this.key;
      this.ja_updated = record.ja_updated ?? '';
      this.ja_updated_url = Util.empty(this.ja_nth) ? '' : Record.BASE_GIT_JA + this.key + '/index.md';

      function scanQuery(queries) {
        if (queries === undefined) return '';
        if (queries === null) return 'null';
        if (queries === false) return 'false';
        return queries.join(', ');
      }
      this.en_query = scanQuery(record.en_bad_bcd_queries);
      this.ja_query = scanQuery(record.ja_bad_bcd_queries);

      this.tr = this.#recordRow();
    }

    #recordLink(url, label) {
      if (Util.empty(url)) return '';
      if (label == null) label = url;
      const anchor = document.createElement('a');
      anchor.setAttribute('href', url);
      anchor.append(label);
      return anchor;
    }

    #recordCell(className, ...args) {
      const td = document.createElement('td');
      td.className = className;
      if (args.length > 0) td.append(...args);
      return td;
    }

    #recordRow() {
      const tr = document.createElement('tr');
      const cls = TableManip.getColumnClassNames();
      tr.append(this.#recordCell(cls[0]));
      tr.append(this.#recordCell(cls[1], this.en_nth));
      tr.append(this.#recordCell(cls[2], this.en_size));
      tr.append(this.#recordCell(cls[3], this.en_meta));
      tr.append(this.#recordCell(cls[4], this.en_title));
      tr.append(this.#recordCell(cls[5], this.#recordLink(this.en_url)));
      tr.append(this.#recordCell(cls[6], this.en_query));
      tr.append(this.#recordCell(cls[7], this.ja_nth));
      tr.append(this.#recordCell(cls[8], this.ja_title));
      tr.append(this.#recordCell(cls[9], this.#recordLink(this.ja_url)));
      tr.append(this.#recordCell(cls[10], this.ja_query));
      tr.append(this.#recordCell(cls[11], this.#recordLink(this.ja_updated_url, this.ja_updated)));
      return tr;
    }

    updateMatch(cond) {
      this.match = this.match && cond;
    }
  }

  class FetchManip {
    static elems = {};

    static getHtmlBlock() {
      const progressBlock = document.createElement('div');
      progressBlock.className = 'progressBlock';
      progressBlock.innerHTML = `<span class="label">データ読み込み中：</span>`
        + `<span class="loaded">0</span> / <span class="total">0</span> (<span class="percentage">0</span>%)`;
      this.elems.label = progressBlock.querySelector('.label');
      this.elems.loaded = progressBlock.querySelector('.loaded');
      this.elems.total = progressBlock.querySelector('.total');
      this.elems.percentage = progressBlock.querySelector('.percentage');
      return progressBlock;
    }

    static async fetch(callback) {
      const date_of = await fetch('/date_of_all.json').then(res => res.json());
      const latestDate = date_of.updated_at;

      let jsonData = JSON.parse(localStorage.getItem('json'));
      const currentDate = jsonData?.info?.updated_at;

      if (currentDate === latestDate) {
        this.progressCompleted();
      }
      else {
        jsonData = await fetch('/all.json').then(this.progress).then(res => res.json());

        try {
          localStorage.setItem('json', JSON.stringify(jsonData));
        }
        catch (e) {
          console.error('localStorage: The quota has been exceeded. Disable JSON caching.');
          localStorage.removeItem('json');
          localStorage.removeItem('total');
        }
      }
      callback(jsonData);
    }

    static progress(res) {
      return new Response(new ReadableStream({
        start(controller) {
          const total = parseInt(res.headers.get('Content-Length'), 10);
          let loaded = 0;
          const reader = res.body.getReader();

          async function read() {
            let result = await reader.read();
            while (!result.done) {
              loaded += result.value.byteLength;
              FetchManip.progressUpdate(loaded, total);
              controller.enqueue(result.value);
              result = await reader.read();
            }
            controller.close();
            FetchManip.progressCompleted(total);
          };
          read();
        }
      }));
    }

    static progressUpdate(loaded, total) {
      this.elems.loaded.textContent = loaded;
      this.elems.total.textContent = total;
      const value = (loaded / total) * 100;
      this.elems.percentage.textContent = Math.trunc(value);
    }

    static progressCompleted(total) {
      if (total == null) total = localStorage.getItem('total') ?? 0;
      if (total > 0) localStorage.setItem('total', total);

      this.elems.loaded.textContent = total;
      this.elems.total.textContent = total;
      this.elems.percentage.textContent = 100;

      let str = this.elems.label.textContent;
      str = str.replace(/読み込み中/, '読み込み完了');
      this.elems.label.textContent = str;
    }
  }

  class URLManip {
    static assocToURL(assoc) {
      const url = new URL(location.href);
      const params = url.searchParams;
      Object.keys(assoc).forEach(key => {
        const val = assoc[key];
        let unset = false;
        if (Util.empty(val)) unset = true;
        else if (key === 'limit' && val === Main.elems.limit.getAttribute('value')) unset = true;
        else if (key === 'offset' && val === Main.elems.offset.getAttribute('value')) unset = true;
        else if (key === 'sort' && val === 'nth-asc') unset = true;
        else if (key === 'filter' && val === 'all') unset = true;
        else if (key === 'file' && val === 'all') unset = true;
        unset ? params.delete(key) : params.set(key, val);
      });
      return url;
    }

    static exportQuery() {
      const assoc = {
        limit: Main.elems.limit.value,
        offset: Main.elems.offset.value,
        sort: Util.getCheckedRadioValue(Filter.radioSorts.radios),
        filter: Util.getCheckedRadioValue(Filter.radioFilters.ja_nth.radios),
        regex_meta: Filter.regexFilters.en_meta.elems.regex.value,
        regex_a: Filter.regexFilters.en_title.elems.regex.value,
        regex_b: Filter.regexFilters.en_url.elems.regex.value,
        regex_bcd_en: Filter.regexFilters.en_query.elems.regex.value,
        regex_c: Filter.regexFilters.ja_title.elems.regex.value,
        regex_d: Filter.regexFilters.ja_url.elems.regex.value,
        regex_bcd_ja: Filter.regexFilters.ja_query.elems.regex.value,
        not_regex_meta: Filter.regexFilters.en_meta.elems.not_regex.value,
        not_regex_a: Filter.regexFilters.en_title.elems.not_regex.value,
        not_regex_b: Filter.regexFilters.en_url.elems.not_regex.value,
        not_regex_bcd_en: Filter.regexFilters.en_query.elems.not_regex.value,
        not_regex_c: Filter.regexFilters.ja_title.elems.not_regex.value,
        not_regex_d: Filter.regexFilters.ja_url.elems.not_regex.value,
        not_regex_bcd_ja: Filter.regexFilters.ja_query.elems.not_regex.value,
      };
      return this.assocToURL(assoc);
    }

    static saveQuery() {
      const url = this.exportQuery();
      window.history.replaceState({}, '', url.href.replace(/%2F/g, '/'));
    }

    static loadQuery() {
      const url = new URL(location.href);
      const param = url.searchParams;

      Main.elems.limit.value = param.get('limit') ?? Main.elems.limit.getAttribute('value');
      Main.elems.offset.value = param.get('offset') ?? Main.elems.offset.getAttribute('value');
      Util.setCheckedRadioValue(Filter.radioSorts.en_size.radios, param.get('sort') ?? 'nth-asc');
      Util.setCheckedRadioValue(Filter.radioFilters.ja_nth.radios, param.get('filter') ?? 'all');
      Filter.regexFilters.en_meta.elems.regex.value = param.get('regex_meta');
      Filter.regexFilters.en_title.elems.regex.value = param.get('regex_a');
      Filter.regexFilters.en_url.elems.regex.value = param.get('regex_b');
      Filter.regexFilters.en_query.elems.regex.value = param.get('regex_bcd_en');
      Filter.regexFilters.ja_title.elems.regex.value = param.get('regex_c');
      Filter.regexFilters.ja_url.elems.regex.value = param.get('regex_d');
      Filter.regexFilters.ja_query.elems.regex.value = param.get('regex_bcd_ja');
      Filter.regexFilters.en_meta.elems.not_regex.value = param.get('not_regex_meta');
      Filter.regexFilters.en_title.elems.not_regex.value = param.get('not_regex_a');
      Filter.regexFilters.en_url.elems.not_regex.value = param.get('not_regex_b');
      Filter.regexFilters.en_query.elems.not_regex.value = param.get('not_regex_bcd_en');
      Filter.regexFilters.ja_title.elems.not_regex.value = param.get('not_regex_c');
      Filter.regexFilters.ja_url.elems.not_regex.value = param.get('not_regex_d');
      Filter.regexFilters.ja_query.elems.not_regex.value = param.get('not_regex_bcd_ja');
    }
  }

  class Main {
    static fullRecords = [];
    static filteredRecords = [];
    static pageRecords = [];
    static elems = {};

    static start() {
      window.addEventListener('DOMContentLoaded', () => {
        this.#preFetch();
        FetchManip.fetch(data => this.main(data));
      });
    }

    static #preFetch() {
      TableManip.init();
      this.#createControlWrapper();
      this.elems.controlWrapper.append(FetchManip.getHtmlBlock());
    }

    static #createControlWrapper() {
      this.elems.tableWrapper = document.getElementById('tableWrapper');
      this.elems.controlWrapper = document.createElement('div');
      this.elems.controlWrapper.className = 'controlWrapper';
      this.elems.tableWrapper.prepend(this.elems.controlWrapper);
    }

    static main(data) {
      this.fullRecords = [];
      Object.keys(data.list).forEach(key => {
        this.fullRecords.push(new Record(key, data.list[key], data));
      });

      this.#showPager();
      this.#bindPager();
      URLManip.loadQuery();
      Filter.execFilter(true);
    }

    static #showPager() {
      this.elems.pagerBlock = document.createElement('div');
      this.elems.pagerBlock.className = 'pagerBlock';
      this.elems.pagerBlock.innerHTML = `
        <label class="limit">Limit <input type="text" name="limit" value="1000" /></label>
        <label class="offset">Offset <input type="text" name="offset" value="0" /></label>
        <button type="button" class="show">show</button>
        <button type="button" class="prev">&lt; prev</button>
        <button type="button" class="next">next &gt;</button>
      `;
      this.elems.controlWrapper.append(this.elems.pagerBlock);

      this.elems.limit = this.elems.pagerBlock.querySelector('input[name="limit"]');
      this.elems.offset = this.elems.pagerBlock.querySelector('input[name="offset"]');
      this.elems.showButton = this.elems.pagerBlock.querySelector('.show');
      this.elems.prevButton = this.elems.pagerBlock.querySelector('.prev');
      this.elems.nextButton = this.elems.pagerBlock.querySelector('.next');
    }

    static #bindPager() {
      function doAction() {
        Filter.execFilter(true);
      }

      this.elems.pagerBlock.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('keyup', evt => {
          if (evt.key === 'Enter') doAction();
        })
      });

      this.elems.showButton.addEventListener('click', () => {
        doAction();
      });

      this.elems.prevButton.addEventListener('click', () => {
        this.addOffset(-this.getLimit());
        doAction();
      });

      this.elems.nextButton.addEventListener('click', () => {
        const limit = this.getLimit();
        const offset = this.getOffset();
        if (limit + offset < this.filteredRecords.length) {
          this.addOffset(this.getLimit());
        }
        doAction();
      });
    }

    static showPage() {
      const limit = this.getLimit();
      const offset = this.getOffset();

      this.pageRecords = this.filteredRecords.slice(offset, offset + limit);
      TableManip.setRecords(this.pageRecords);
      TableManip.updateRows();

      const cssValue = `count ${offset}`;
      TableManip.elems.tbody.style.counterSet = cssValue;
      TableManip.elems.tbody.style.counterReset = cssValue; // for Safari
      URLManip.saveQuery();
    }

    static #getValue(elem) {
      const def = Number(elem.getAttribute('value'));
      let value = parseInt(elem.value, 10);
      if (Number.isNaN(value)) value = def;
      return value;
    }

    static getLimit() {
      let value = this.#getValue(this.elems.limit);
      value = Math.max(1, value);
      this.elems.limit.value = value;
      return value;
    }

    static getOffset() {
      let value = this.#getValue(this.elems.offset);
      value = Util.clamp(0, value, Math.max(this.filteredRecords.length - 1, 0));
      this.elems.offset.value = value;
      return value;
    }

    static addOffset(diff) {
      let value = this.#getValue(this.elems.offset) + diff;
      value = Util.clamp(0, value, Math.max(this.filteredRecords.length - 1, 0));
      this.elems.offset.value = value;
    }

    static sort() {
      function nthCompare(a, b, sign) {
        if (a.en_nth !== '' || b.en_nth !== '') {
          if (a.en_nth === '') return 1;
          if (b.en_nth === '') return -1;
          if (a.en_nth < b.en_nth) return sign;
          if (a.en_nth > b.en_nth) return -sign;
        }
        else {
          if (a.ja_nth < b.ja_nth) return sign;
          if (a.ja_nth > b.ja_nth) return -sign;
        }
        return 0;
      }

      function valueCompare(a, b, key, sign) {
        if (a[key] !== '' || b[key] !== '') {
          if (a[key] === '') return 1;
          if (b[key] === '') return -1;
          if (a[key] < b[key]) return sign;
          if (a[key] > b[key]) return -sign;
        }
        return nthCompare(a, b, -1);
      }

      const value = Util.getCheckedRadioValue(Filter.radioSorts.radios);
      if (value === 'nth-asc') this.filteredRecords.sort((a, b) => nthCompare(a, b, -1));
      else if (value === 'nth-desc') this.filteredRecords.sort((a, b) => nthCompare(a, b, 1));
      else if (value === 'size-asc') this.filteredRecords.sort((a, b) => valueCompare(a, b, 'en_size', -1));
      else if (value === 'size-desc') this.filteredRecords.sort((a, b) => valueCompare(a, b, 'en_size', 1));
      else if (value === 'date-asc') this.filteredRecords.sort((a, b) => valueCompare(a, b, 'ja_updated', -1));
      else if (value === 'date-desc') this.filteredRecords.sort((a, b) => valueCompare(a, b, 'ja_updated', 1));

      this.showPage();
    }
  }

  Main.start();
}());
