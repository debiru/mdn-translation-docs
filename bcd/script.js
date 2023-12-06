(function() {
  'use strict';

  const NS = {
    BASE_URL_EN: 'https://developer.mozilla.org/en-US/docs',
    browsers: ['chrome', 'edge', 'firefox', 'opera', 'safari', 'safari_ios'],
  };
  window.NS = NS;

  const Main = {
    setNS() {
      NS.tableWrapper = document.getElementById('tableWrapper');
      NS.table = document.getElementById('table');
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
    main() {
      Sub.FetchManip.fetch(data => {
        NS.fullRecords = [];
        for (const key of Object.keys(data)) {
          NS.fullRecords.push(Sub.Record.create(key, data[key]));
        }
        Sub.Filter.execFilter();
      });
    },
  };

  const Sub = {
    FetchManip: {
      async fetch(callback) {
        const date_of = await fetch('date_of_bcd.json').then(res => res.json());
        const latestDate = date_of.updated_at;

        let jsonData = JSON.parse(localStorage.getItem('bcd.json'));
        const currentDate = jsonData?.info?.updated_at;

        if (currentDate === latestDate) {
          Sub.FetchManip.progressCompleted();
        }
        else {
          jsonData = await fetch('bcd.json').then(Sub.FetchManip.progress).then(res => res.json());

          try {
            localStorage.setItem('bcd.json', JSON.stringify(jsonData));
          }
          catch (e) {
            console.error('localStorage: The quota has been exceeded. Disable JSON caching.');
            localStorage.removeItem('bcd.json');
            localStorage.removeItem('bcd.total');
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
        if (total == null) total = localStorage.getItem('bcd.total') ?? 0;
        if (total > 0) localStorage.setItem('bcd.total', total);

        NS.progress.loaded.textContent = total;
        NS.progress.total.textContent = total;
        NS.progress.percentage.textContent = 100;

        let str = NS.progress.label.textContent;
        str = str.replace(/読み込み中/, '読み込み完了');
        NS.progress.label.textContent = str;
      },
    },
    Record: {
      create(key, value) {
        const self = {};
        self.key = key;
        self.url = value.url;

        self.support = value.support;
        for (const browser of NS.browsers) {
          self.support[browser] ??= '';
        }
        for (const browser of Object.keys(self.support)) {
          const originalValue = self.support[browser];
          const partialImplementation = /^!/.test(originalValue);
          let value = originalValue.replace(/^!/, '');
          const lte = /^<=/.test(value);
          value = value.replace(/^<=/, '');
          if (value === 'preview') value = 9999;
          if (value === '') value = null;
          const numValue = Util.isInt(value) ? Number(value) : value;
          self.support[browser] = {
            originalValue,
            partialImplementation,
            lte,
            numValue,
          };
        }

        self.tr = Sub.Record.createRow(self);
        return self;
      },
      createRow(self) {
        const tr = document.createElement('tr');
        const cls = Sub.TableManip.getColumnClassNames();
        tr.append(Sub.Record.createCell(null, cls[0]));
        tr.append(Sub.Record.createCell(null, cls[1], self.key));
        tr.append(Sub.Record.createCell(null, cls[2], Sub.Record.link(NS.BASE_URL_EN + self.url, self.url)));
        for (let i = 0; i < NS.browsers.length; ++i) {
          const browserInfo = self.support[NS.browsers[i]];
          tr.append(Sub.Record.createCell(browserInfo, cls[3 + i], browserInfo.originalValue));
        }
        return tr;
      },
      createCell(browserInfo, className, ...args) {
        const td = document.createElement('td');
        td.className = className;
        if (browserInfo != null) {
          td.setAttribute('data-partial-implementation', browserInfo.partialImplementation);
          td.setAttribute('data-lte', browserInfo.lte);
          td.setAttribute('data-value', browserInfo.originalValue);
        }
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
      },
      filter(preventResetOffset) {
        NS.filteredRecords = [];
        for (const record of NS.fullRecords) {
          if (record.match) NS.filteredRecords.push(record);
        }
        if (!preventResetOffset) NS.pager.offset.value = 0;
        // Sub.Filter.sort();
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
