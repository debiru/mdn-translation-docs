(function() {
  'use strict';

  const NS = {
    regexFilters: {},
  };
  window.NS = NS;

  const Main = {
    setNS() {
      NS.tableWrapper = document.getElementById('tableWrapper');
      NS.table = document.getElementById('table');
      NS.thead = NS.table.querySelector('thead');
      NS.tbody = document.createElement('tbody');
      NS.table.append(NS.tbody);
    },
    controlWrapper() {
      NS.controlWrapper = document.createElement('div');
      NS.controlWrapper.className = 'controlWrapper';
      NS.tableWrapper.prepend(NS.controlWrapper);
    },
    progressBlock() {
      NS.progress = {};
      NS.progress.block = document.createElement('div');
      NS.progress.block.className = 'progressBlock';
      NS.progress.block.innerHTML = `<span class="label">データ読み込み中：</span>`
        + `<span class="loaded">0</span> / <span class="total">0</span> (<span class="percentage">0</span>%)`;
      NS.progress.label = NS.progress.block.querySelector('.label');
      NS.progress.loaded = NS.progress.block.querySelector('.loaded');
      NS.progress.total = NS.progress.block.querySelector('.total');
      NS.progress.percentage = NS.progress.block.querySelector('.percentage');
      NS.controlWrapper.append(NS.progress.block);
    },
    pagerBlock() {
      NS.pager = {};
      NS.pager.block = document.createElement('div');
      NS.pager.block.className = 'pagerBlock';
      NS.pager.block.innerHTML = `
        <label class="limit">Limit <input type="text" name="limit" value="1000" /></label>
        <label class="offset">Offset <input type="text" name="offset" value="0" /></label>
        <button type="button" class="show">show</button>
        <button type="button" class="prev">&lt; prev</button>
        <button type="button" class="next">next &gt;</button>
      `;
      NS.pager.limit = NS.pager.block.querySelector('input[name="limit"]');
      NS.pager.offset = NS.pager.block.querySelector('input[name="offset"]');
      NS.pager.show = NS.pager.block.querySelector('.show');
      NS.pager.prev = NS.pager.block.querySelector('.prev');
      NS.pager.next = NS.pager.block.querySelector('.next');
      NS.controlWrapper.append(NS.pager.block);
    },
    pagerEvent() {
      const doAction = () => Sub.Filter.execFilter(true);

      NS.pager.block.querySelectorAll('input[type="text"]').forEach(input => {
        Util.addEvent(input, 'keyup', evt => {
          if (evt.key === 'Enter') doAction();
        });
      });

      Util.addEvent(NS.pager.show, 'click', () => {
        doAction();
      });

      Util.addEvent(NS.pager.prev, 'click', () => {
        const limit = Sub.Main.getLimit();
        Sub.Main.addOffset(-limit);
        doAction();
      });

      Util.addEvent(NS.pager.next, 'click', () => {
        const limit = Sub.Main.getLimit();
        const offset = Sub.Main.getOffset();
        if (limit + offset < NS.filteredRecords.length) {
          Sub.Main.addOffset(limit);
        }
        doAction();
      });
    },
    filtersRow() {
      const clsList = Sub.TableManip.getColumnClassNames();
      const tr = document.createElement('tr');
      tr.id = 'filters';

      NS.filters = {};
      for (const cls of clsList) {
        const th = document.createElement('th');
        th.className = cls;
        tr.append(th);

        const key = cls.split(/\s+/)[0];
        NS.filters[key] = th;
      }
      NS.thead.prepend(tr);
      Sub.FilterItem.createFilterElements();

      NS.filters.headingValues.append(NS.pager.block);
    },
    main() {
      Sub.FetchManip.fetch(data => {
        NS.fullRecords = [];
        for (const obj of Util.keyValue(data.list)) {
          NS.fullRecords.push(Sub.Record.create(obj.key, obj.value));
        }
        Sub.URLManip.loadQuery();
        Sub.Filter.execFilter(true);
      });
    },
  };

  const Sub = {
    FetchManip: {
      async fetch(callback) {
        const date_of = await fetch('date_of_headings.json').then(res => res.json());
        const latestDate = date_of.updated_at;

        let jsonData = JSON.parse(localStorage.getItem('headings.json'));
        const currentDate = jsonData?.info?.updated_at;

        if (currentDate === latestDate) {
          Sub.FetchManip.progressCompleted();
        }
        else {
          jsonData = await fetch('headings.json').then(Sub.FetchManip.progress).then(res => res.json());

          try {
            localStorage.setItem('headings.json', JSON.stringify(jsonData));
          }
          catch (e) {
            console.error('localStorage: The quota has been exceeded. Disable JSON caching.');
            localStorage.removeItem('headings.json');
            localStorage.removeItem('headings.total');
          }
        }
        callback(jsonData.data);
      },
      progress(res) {
        return new Response(new ReadableStream({
          start(controller) {
            const total = parseInt(res.headers.get('Content-Length'), 10);
            let loaded = 0;
            const reader = res.body.getReader();

            async function read() {
              let result = await reader.read();
              while (!result.done) {
                loaded += result.value.byteLength;
                Sub.FetchManip.progressUpdate(loaded, total);
                controller.enqueue(result.value);
                result = await reader.read();
              }
              controller.close();
              Sub.FetchManip.progressCompleted(total);
            }
            read();
          }
        }));
      },
      progressUpdate(loaded, total) {
        NS.progress.loaded.textContent = loaded;
        NS.progress.total.textContent = total;
        const value = (loaded / total) * 100;
        NS.progress.percentage.textContent = Math.trunc(value);
      },
      progressCompleted(total) {
        if (total == null) total = localStorage.getItem('headings.total') ?? 0;
        if (total > 0) localStorage.setItem('headings.total', total);

        NS.progress.loaded.textContent = total;
        NS.progress.total.textContent = total;
        NS.progress.percentage.textContent = 100;

        let str = NS.progress.label.textContent;
        str = str.replace(/読み込み中/, '読み込み完了');
        NS.progress.label.textContent = str;
      },
    },
    Record: {
      create(key, values) {
        const self = {};
        const valuesCount = Object.keys(values).length;
        self.key = `[${valuesCount}] ${key}`;
        self.values = values;
        self.tr = Sub.Record.createRow(self);
        self.updateMatch = cond => self.match &&= cond;
        return self;
      },
      createRow(self) {
        const tr = document.createElement('tr');
        const cls = Sub.TableManip.getColumnClassNames();
        tr.append(Sub.Record.createCell(cls[0]));

        const fragment = document.createDocumentFragment();
        const span1 = document.createElement('span');
        const span2 = document.createElement('span');
        span1.className = 'valuesKeyCount';
        span2.className = 'headingKeyText';
        const texts = self.key.match(/(\[[^\]]*\])\s*(.*)/);
        span1.textContent = texts[1];
        span2.textContent = texts[2];
        fragment.append(span1, ' ', span2);
        tr.append(Sub.Record.createCell(cls[1], fragment));

        tr.append(Sub.Record.createCell(cls[2], Sub.Record.values(self.values)));
        return tr;
      },
      createCell(className, ...args) {
        const td = document.createElement('td');
        td.className = className;
        if (args.length > 0) td.append(...args);
        return td;
      },
      link(url, label) {
        label ??= url;
        const anchor = document.createElement('a');
        anchor.setAttribute('href', url);
        anchor.textContent = label;
        return anchor;
      },
      values(values) {
        const div = document.createElement('div');
        div.innerHTML = `
          <table class="headingValuesTable">
            <thead><tr><th class="valuesText">文言</th><th class="valuesCount">出現回数</th></tr></thead>
            <tbody></tbody>
          </table>
        `;
        const tbody = div.querySelector('tbody');

        values = Util.keyValue(values).toSorted((a, b) => {
          // ORDER BY value DESC, key ASC
          if (a.value < b.value) return 1;
          if (a.value > b.value) return -1;
          if (a.key < b.key) return -1;
          if (a.key > b.key) return 1;
          return 0;
        });

        for (const obj of values) {
          const tr = document.createElement('tr');
          const td1 = document.createElement('td');
          const td2 = document.createElement('td');
          td1.className = 'valuesText';
          td2.className = 'valuesCount';
          td1.textContent = obj.key;
          td2.textContent = obj.value;
          tr.append(td1, td2);
          tbody.append(tr);
        }

        const result = values.length === 1 ? values[0].key : div;

        return result;
      },
    },
    TableManip: {
      getColumnClassNames() {
        NS.columnClassNames ??= [];
        if (NS.columnClassNames.length > 0) return NS.columnClassNames;
        const tr = document.getElementById('labels');
        const thList = tr.querySelectorAll('th');
        for (const th of thList) {
          NS.columnClassNames.push(th.className);
        }
        return NS.columnClassNames;
      },
      setRecords(records) {
        const trList = records.map(record => record.tr);
        NS.tbody.replaceChildren(...trList);
      },
    },
    Filter: {
      execFilter(preventResetOffset) {
        Sub.Filter.preFilter();
        Sub.Filter.filter(preventResetOffset);
        Sub.Filter.postFilter();
      },
      preFilter() {
        for (const record of NS.fullRecords) {
          record.match = true;
        }
      },
      postFilter() {
        NS.filters.count.textContent = NS.filteredRecords.length;
      },
      filter(preventResetOffset) {
        Sub.FilterItem.execRegexFilters();

        NS.filteredRecords = [];
        for (const record of NS.fullRecords) {
          if (record.match) NS.filteredRecords.push(record);
        }
        if (!preventResetOffset) NS.pager.offset.value = 0;
        Sub.Filter.showPage();
      },
      showPage() {
        const limit = Sub.Main.getLimit();
        const offset = Sub.Main.getOffset();
        NS.pageRecords = NS.filteredRecords.slice(offset, offset + limit);
        Sub.TableManip.setRecords(NS.pageRecords);

        const cssValue = `count ${offset}`;
        NS.tbody.style.counterSet = cssValue;
        NS.tbody.style.counterReset = cssValue; // for Safari
        Sub.URLManip.saveQuery();
      },
    },
    FilterItem: {
      createFilterElements() {
        Sub.RegexFilter.create('headingKey');
      },
      execRegexFilters() {
        for (const key of Object.keys(NS.regexFilters)) {
          Sub.RegexFilter.filterRecords(key);
        }
      },
    },
    RegexFilter: {
      create(key) {
        Sub.RegexFilter.createElements(key);
        Sub.RegexFilter.bindElements(key)
      },
      createElements(key) {
        const th = NS.filters[key];
        const html = `
          <div class="block">
            <label>正規表現フィルタ<input type="text" data-type="regex"></label>
            <label>AND not<input type="text" data-type="not-regex"></label>
          </div>
        `;
        th.insertAdjacentHTML('beforeend', html);
        const regex = th.querySelector('input[data-type="regex"]');
        const not_regex = th.querySelector('input[data-type="not-regex"]');
        NS.regexFilters[key] = {regex, not_regex};
      },
      bindElements(key) {
        const th = NS.filters[key];
        const doAction = () => Sub.Filter.execFilter();
        const textInputs = th.querySelectorAll('input[data-type="regex"], input[data-type="not-regex"]');
        for (const input of textInputs) {
          Util.addEvent(input, 'keyup', evt => {
            if (evt.key === 'Enter') doAction();
          });

          Util.addEvent(input, 'focusout', () => {
            doAction();
          });
        }
      },
      filterRecords(key) {
        const elems = NS.regexFilters[key];
        const regexp = new RegExp(elems.regex.value, 'smi');
        const not_regexp = new RegExp(elems.not_regex.value, 'smi');
        const recordKeyMap = { headingKey: 'key' };
        NS.fullRecords.forEach(record => {
          const value = record[recordKeyMap[key]];
          const match = Util.empty(elems.regex.value) ? true : regexp.test(value);
          const not_match = Util.empty(elems.not_regex.value) ? false : not_regexp.test(value);
          record.updateMatch(match && !not_match);
        });
      },
    },
    URLManip: {
      assocToURL(assoc) {
        const url = new URL(location.href);
        const params = url.searchParams;
        for (const key of Object.keys(assoc)) {
          const val = assoc[key];
          let unset = false;
          if (Util.empty(val)) unset = true;
          else if (key === 'limit' && val === NS.pager.limit.getAttribute('value')) unset = true;
          else if (key === 'offset' && val === NS.pager.offset.getAttribute('value')) unset = true;
          unset ? params.delete(key) : params.set(key, val);
        }
        return url;
      },
      exportQuery() {
        const assoc = {
          limit: NS.pager.limit.value,
          offset: NS.pager.offset.value,
          regex: NS.regexFilters.headingKey.regex.value,
          not_regex: NS.regexFilters.headingKey.not_regex.value,
        };
        return Sub.URLManip.assocToURL(assoc);
      },
      saveQuery() {
        const url = Sub.URLManip.exportQuery();
        window.history.replaceState({}, '', url.href.replace(/%2F/g, '/'));
      },
      loadQuery() {
        const url = new URL(location.href);
        const param = url.searchParams;

        NS.pager.limit.value = param.get('limit') ?? NS.pager.limit.getAttribute('value');
        NS.pager.offset.value = param.get('offset') ?? NS.pager.offset.getAttribute('value');
        NS.regexFilters.headingKey.regex.value = param.get('regex');
        NS.regexFilters.headingKey.not_regex.value = param.get('not_regex');
      },
    },
    Main: {
      getValue(elem) {
        const def = Number(elem.getAttribute('value'));
        let value = parseInt(elem.value, 10);
        if (Number.isNaN(value)) value = def;
        return value;
      },
      getLimit() {
        let value = Sub.Main.getValue(NS.pager.limit);
        value = Math.max(1, value);
        NS.pager.limit.value = value;
        return value;
      },
      getOffset() {
        let value = Sub.Main.getValue(NS.pager.offset);
        value = Util.clamp(0, value, Math.max(NS.filteredRecords.length - 1, 0));
        NS.pager.offset.value = value;
        return value;
      },
      addOffset(diff) {
        let value = Sub.Main.getValue(NS.pager.offset) + diff;
        value = Util.clamp(0, value, Math.max(NS.filteredRecords.length - 1, 0));
        NS.pager.offset.value = value;
      },
    },
  };

  const Util = {
    keyValue(obj) {
      const result = [];
      const keys = Object.keys(obj).toSorted();
      for (const key of keys) {
        result.push({key, value: obj[key]});
      }
      return result;
    },
    isInt(arg) {
      return String(arg) === String(Number(arg));
    },
    clamp(min, value, max) {
      return Math.min(Math.max(min, value), max);
    },
    execObjectRoutine(obj) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') obj[key]();
      });
    },
    empty(arg) {
      return arg == null || arg === '' || arg === false;
    },
    delegateEvent(selector, type, listener, options) {
      if (options == null) options = false;
      document.addEventListener(type, evt => {
        for (let elem = evt.target; elem && elem !== document; elem = elem.parentNode) {
          if (elem.matches(selector)) return listener.call(elem, evt);
        }
      }, options);
    },
    addEvent(elem, type, listener, options) {
      if (Util.empty(elem)) return null;
      if (options == null) options = false;
      elem.addEventListener(type, evt => { listener.call(elem, evt); }, options);
    },
    triggerEvent(elem, type, options) {
      if (Util.empty(elem)) return null;
      const event = new Event(type, options);
      elem.dispatchEvent(event);
    },
    sprintf(format, ...args) {
      let p = 0;
      return format.replace(/%./g, function(m) {
        if (m === '%%') return '%';
        if (m === '%s') return args[p++];
        return m;
      });
    },
  };

  Util.addEvent(document, 'DOMContentLoaded', () => { Util.execObjectRoutine(Main); });
}());
