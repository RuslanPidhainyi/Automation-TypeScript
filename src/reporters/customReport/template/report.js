/*
 * The custom report's page script, inlined by customReporter.ts after the run's
 * data (ReportData in reportModel.ts). No framework and no fetch, so the page
 * works opened from disk as well as served. The filters live in the URL hash:
 * a filtered view can be bookmarked or sent.
 */
(function () {
  'use strict';

  const data = JSON.parse(document.getElementById('report-data').textContent);
  const tests = data.tests;
  const byKey = new Map(tests.map((test) => [test.key, test]));
  const groupOfTag = new Map(data.tagGroups.flatMap((group) => group.tags.map((tag) => [tag, group.name])));
  const $ = (selector) => document.querySelector(selector);

  const STATUSES = [
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'skipped', label: 'Skipped' },
  ];
  const RUN_LABELS = { passed: 'Run passed', failed: 'Run failed', timedout: 'Run timed out', interrupted: 'Run interrupted' };

  const idOf = (test) => (test.id === null ? Number.MAX_SAFE_INTEGER : test.id);
  const rankOf = (test) => (test.status === 'failed' ? 0 : test.flaky ? 1 : test.status === 'skipped' ? 2 : 3);
  const byId = (a, b) => idOf(a) - idOf(b) || data.projects.indexOf(a.project) - data.projects.indexOf(b.project);
  const SORTS = {
    id: { label: 'Sort by ID', compare: byId },
    status: { label: 'Failed first', compare: (a, b) => rankOf(a) - rankOf(b) || byId(a, b) },
    duration: { label: 'Slowest first', compare: (a, b) => b.durationMs - a.durationMs || byId(a, b) },
    file: { label: 'Sort by file path', compare: (a, b) => a.file.localeCompare(b.file) || a.line - b.line || byId(a, b) },
  };

  const icon = (paths) =>
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    passed: icon('<path d="M4 8.5l2.5 2.5L12 5.5"/>'),
    failed: icon('<path d="M5 5l6 6M11 5l-6 6"/>'),
    skipped: icon('<path d="M5 8h6"/>'),
    flaky: icon('<path d="M8 4.5v4M8 11.5v.01"/>'),
    copy: icon('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/>'),
    image: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.25"/><path d="M14.5 10.5l-3.5-3.5-7.5 6.5"/>'),
    trace: icon('<path d="M1.5 8h3l2-5 3 10 2-5h3"/>'),
    terminal: icon('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4.5 6.5l2 1.5-2 1.5M8.5 10h3"/>'),
  };

  // ---- Formatting ----

  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const linkify = (text) => esc(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  const displayTitle = (test) => test.title.replace(/^\[ID:\s*\d+\]\s*/, '');
  const kindOf = (test) => (test.flaky ? 'flaky' : test.status);
  const dot = (kind) => `<span class="dot dot--${kind}">${ICONS[kind]}</span>`;

  function percent(count, total) {
    if (!total || !count) return '0%';
    const value = (count / total) * 100;
    if (value < 0.1) return '<0.1%';
    if (count < total && value > 99.9) return '>99.9%';
    return `${value.toFixed(1).replace(/\.0$/, '')}%`;
  }

  function formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
    return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
  }

  function statusLabel(test) {
    if (test.status === 'failed') return test.lastAttempt === 'timedOut' ? 'Timed out' : 'Failed';
    if (test.status === 'skipped') return test.lastAttempt === 'notRun' ? 'Did not run' : 'Skipped';
    return test.flaky ? 'Flaky' : 'Passed';
  }

  function countOf(list) {
    const counts = { total: list.length, passed: 0, failed: 0, skipped: 0, flaky: 0 };
    for (const test of list) {
      counts[test.status] += 1;
      if (test.flaky) counts.flaky += 1;
    }
    return counts;
  }

  // ---- Filter state, kept in the URL hash ----

  const state = { query: '', statuses: new Set(), tags: new Set(), feature: '', project: '', sort: 'id' };

  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const list = (name) => (params.get(name) || '').split(',').filter(Boolean);
    state.query = params.get('q') || '';
    state.statuses = new Set(list('status').filter((value) => STATUSES.some((status) => status.value === value)));
    state.tags = new Set(list('tags').filter((tag) => groupOfTag.has(tag)));
    state.feature = data.features.includes(params.get('feature')) ? params.get('feature') : '';
    state.project = data.projects.includes(params.get('project')) ? params.get('project') : '';
    state.sort = Object.prototype.hasOwnProperty.call(SORTS, params.get('sort')) ? params.get('sort') : 'id';
  }

  function writeHash() {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.statuses.size) params.set('status', [...state.statuses].join(','));
    if (state.tags.size) params.set('tags', [...state.tags].join(','));
    if (state.feature) params.set('feature', state.feature);
    if (state.project) params.set('project', state.project);
    if (state.sort !== 'id') params.set('sort', state.sort);
    const hash = params.toString();
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
  }

  const hasFilters = () => Boolean(state.query || state.statuses.size || state.tags.size || state.feature || state.project);

  /**
   * A query of numbers only (`62`, `@62`, `ID: 62`, `62, 63`) finds those IDs exactly.
   * Anything else is looked for in the spec path - which holds the file name - and
   * in the title. A pasted absolute path matches too, and one ending in `:line`
   * finds the test declared on that line.
   */
  function parseQuery(raw) {
    const text = raw.trim().toLowerCase().replace(/\\/g, '/');
    if (!text) return null;
    const tokens = text.replace(/[[\]]/g, ' ').replace(/\bid\s*:?/g, ' ').split(/[\s,;]+/).filter(Boolean);
    const ids = tokens.map((token) => /^[@#]?(\d+)$/.exec(token));
    if (ids.length && ids.every(Boolean)) return { ids: new Set(ids.map((match) => Number(match[1]))) };
    const location = /^(.+?):(\d+)(?::\d+)?$/.exec(text);
    return { text, path: location ? location[1] : text, line: location ? Number(location[2]) : null };
  }

  function currentFilter() {
    const tagsByGroup = new Map();
    for (const tag of state.tags) {
      const group = groupOfTag.get(tag);
      tagsByGroup.set(group, [...(tagsByGroup.get(group) || []), tag]);
    }
    return { query: parseQuery(state.query), tagsByGroup };
  }

  function matchesQuery(test, query) {
    if (!query) return true;
    if (query.ids) return query.ids.has(test.id);
    const file = test.file.toLowerCase();
    const inFile = file.includes(query.path) || query.path.endsWith(file);
    if (query.line !== null) return inFile && test.line === query.line;
    return inFile || test.title.toLowerCase().includes(query.text);
  }

  /** Tags of one group are alternatives, the groups narrow each other down. `ignore` leaves out one filter - for its own chip counts. */
  function matches(test, filter, ignore = {}) {
    if (!ignore.status && state.statuses.size && !state.statuses.has(test.status)) return false;
    for (const [group, wanted] of filter.tagsByGroup) {
      if (group !== ignore.group && !wanted.some((tag) => test.tags.includes(tag))) return false;
    }
    if (state.feature && test.feature !== state.feature) return false;
    if (state.project && test.project !== state.project) return false;
    return matchesQuery(test, filter.query);
  }

  // ---- Statistics ----

  function stackBar(counts, name) {
    const summary = STATUSES.map((status) => `${status.label} ${counts[status.value]} (${percent(counts[status.value], counts.total)})`);
    const segments = STATUSES.filter((status) => counts[status.value] > 0).map((status) => {
      const tip = `${name} · ${status.label}: ${counts[status.value]} of ${counts.total} (${percent(counts[status.value], counts.total)})`;
      return `<span class="bar-segment bar-segment--${status.value}" style="flex-grow:${counts[status.value]}" data-tip="${esc(tip)}"></span>`;
    });
    return `<div class="bar" role="img" aria-label="${esc(`${name}: ${summary.join(', ')}`)}">${segments.join('')}</div>`;
  }

  const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  function renderHeader() {
    document.title = data.title;
    $('#report-title').textContent = data.title;
    $('#run-meta').textContent = [
      `Started ${new Date(data.startedAt).toLocaleString()}`,
      `took ${formatDuration(data.durationMs)}`,
      `${plural(tests.length, 'test')} in ${plural(data.projects.length, 'project')}`,
      `Playwright ${data.playwrightVersion}`,
    ].join(' · ');
    const kind = data.runStatus === 'passed' ? 'passed' : 'failed';
    $('#run-badge').innerHTML = `${dot(kind)}${esc(RUN_LABELS[data.runStatus] || data.runStatus)}`;
  }

  function renderSummary() {
    const counts = countOf(tests);
    const tile = (status, label, note) => `
      <button type="button" class="tile" data-status="${status}" title="List the ${label.toLowerCase()} tests">
        <span class="tile-label">${dot(status)}${label}</span>
        <span class="tile-value">${counts[status]}<span class="tile-percent">${percent(counts[status], counts.total)}</span></span>
        <span class="tile-note">${note}</span>
      </button>`;
    $('#summary-tiles').innerHTML = `
      <div class="tile">
        <span class="tile-label">Tests</span>
        <span class="tile-value">${counts.total}</span>
        <span class="tile-note">${plural(data.features.length, 'feature')} · ${plural(data.projects.length, 'project')}</span>
      </div>
      ${tile('passed', 'Passed', counts.flaky ? `${counts.flaky} of them flaky` : '')}
      ${tile('failed', 'Failed', '')}
      ${tile('skipped', 'Skipped', '')}`;
    $('#summary-bar').innerHTML = stackBar(counts, 'All tests');
    $('#summary-legend').innerHTML = STATUSES.map((status) => `<li><span class="swatch swatch--${status.value}"></span>${status.label}</li>`).join('');
  }

  function renderFeatures() {
    const cells = (counts) =>
      `<td class="num">${counts.total}</td>` +
      STATUSES.map((status) => `<td class="num">${counts[status.value]}<span class="pct">${percent(counts[status.value], counts.total)}</span></td>`).join('');
    $('#feature-rows').innerHTML = data.features
      .map((feature) => {
        const counts = countOf(tests.filter((test) => test.feature === feature));
        return `<tr>
          <th scope="row"><button type="button" class="feature-button" data-feature="${esc(feature)}" aria-pressed="false">${esc(feature)}</button></th>
          ${cells(counts)}
          <td class="bar-col">${stackBar(counts, feature)}</td>
        </tr>`;
      })
      .join('');
    const all = countOf(tests);
    $('#feature-total').innerHTML = `<tr><th scope="row">All features</th>${cells(all)}<td class="bar-col">${stackBar(all, 'All features')}</td></tr>`;
  }

  // ---- Filters ----

  function buildControls() {
    const chip = (attributes, label) =>
      `<button type="button" class="chip" ${attributes} aria-pressed="false">${label}<span class="chip-count"></span></button>`;
    $('#status-chips').innerHTML = STATUSES.map((status) => chip(`data-status="${status.value}"`, dot(status.value) + status.label)).join('');
    $('#tag-filters').innerHTML = data.tagGroups
      .map(
        (group, index) => `
        <div class="filter-row">
          <span class="filter-label" id="tag-group-${index}">${esc(group.name)}</span>
          <div class="chips" role="group" aria-labelledby="tag-group-${index}">
            ${group.tags.map((tag) => chip(`data-tag="${esc(tag)}" data-group="${esc(group.name)}"`, esc(tag))).join('')}
          </div>
        </div>`,
      )
      .join('');

    const fill = (select, options) => {
      select.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
    };
    fill($('#feature-filter'), [['', 'All features'], ...data.features.map((feature) => [feature, feature])]);
    fill($('#project-filter'), [['', 'All projects'], ...data.projects.map((project) => [project, project])]);
    fill($('#sort'), Object.entries(SORTS).map(([value, sort]) => [value, sort.label]));
  }

  function update() {
    const filter = currentFilter();

    if ($('#search').value !== state.query) $('#search').value = state.query;
    $('#feature-filter').value = state.feature;
    $('#project-filter').value = state.project;
    $('#sort').value = state.sort;
    $('#clear-filters').hidden = !hasFilters();

    for (const chip of document.querySelectorAll('#status-chips [data-status]')) {
      const status = chip.dataset.status;
      chip.setAttribute('aria-pressed', String(state.statuses.has(status)));
      chip.querySelector('.chip-count').textContent = tests.filter(
        (test) => test.status === status && matches(test, filter, { status: true }),
      ).length;
    }
    for (const chip of document.querySelectorAll('#tag-filters [data-tag]')) {
      const tag = chip.dataset.tag;
      chip.setAttribute('aria-pressed', String(state.tags.has(tag)));
      chip.querySelector('.chip-count').textContent = tests.filter(
        (test) => test.tags.includes(tag) && matches(test, filter, { group: chip.dataset.group }),
      ).length;
    }
    for (const button of document.querySelectorAll('#feature-rows [data-feature]')) {
      const active = button.dataset.feature === state.feature;
      button.setAttribute('aria-pressed', String(active));
      button.closest('tr').classList.toggle('is-active', active);
    }

    renderTests(filter);
    writeHash();
  }

  // ---- Test list ----

  function renderTests(filter) {
    const visible = tests.filter((test) => matches(test, filter)).sort(SORTS[state.sort].compare);
    $('#test-list').innerHTML = visible.map(testRow).join('');
    $('#empty').hidden = visible.length > 0;
    $('#result-count').textContent =
      visible.length === tests.length ? `${tests.length} tests` : `Showing ${visible.length} of ${tests.length} tests`;
  }

  function testRow(test) {
    const kind = kindOf(test);
    const retries = test.retries ? ` · ${test.retries} ${test.retries === 1 ? 'retry' : 'retries'}` : '';
    const issues = test.issues.length
      ? `<details class="test-issues">
          <summary>${test.issues.length === 1 ? '1 product issue' : `${test.issues.length} product issues`}</summary>
          <ul>${test.issues.map((issue) => `<li>${linkify(issue)}</li>`).join('')}</ul>
        </details>`
      : '';
    return `<li class="test test--${kind}">
      <div class="test-main">
        <span class="status">${dot(kind)}${statusLabel(test)}</span>
        <span class="test-id">${test.id === null ? 'setup' : `ID ${test.id}`}</span>
        <div class="test-text">
          <p class="test-title">${esc(displayTitle(test))}</p>
          <p class="test-file"><span class="mono">${esc(test.file)}:${test.line}</span> · ${esc(test.feature)}</p>
        </div>
        <div class="test-meta">
          <span class="badge badge--project">${esc(test.project)}</span>
          ${test.tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}
          <span class="test-duration">${formatDuration(test.durationMs)}${retries}</span>
        </div>
      </div>
      ${test.skipReason ? `<p class="test-note">${esc(test.skipReason)}</p>` : ''}
      ${issues}
      ${test.failure ? failureBlock(test) : ''}
    </li>`;
  }

  function failureBlock(test) {
    const { failure } = test;
    const button = (action, iconName, label, title, available = true) =>
      `<button type="button" class="button" data-action="${action}" data-key="${esc(test.key)}" title="${esc(title)}"${
        available ? '' : ' aria-disabled="true"'
      }>${ICONS[iconName]}${label}</button>`;
    const shots = failure.screenshots.length;
    return `<div class="failure">
      <div class="failure-actions">
        ${button('copy', 'copy', 'Copy', 'Copy the errors, step log and output as Markdown')}
        ${button(
          'screenshot',
          'image',
          shots > 1 ? `Screenshot (${shots})` : 'Screenshot',
          shots ? 'Show the screenshot taken when the test failed' : 'No screenshot: the test drives no browser page',
          shots > 0,
        )}
        ${button(
          'trace',
          'trace',
          'Trace',
          failure.trace ? 'Open the trace in the trace viewer' : 'No trace was recorded for this attempt',
          Boolean(failure.trace),
        )}
        ${button('uiMode', 'terminal', 'UI mode', 'Copy the command that opens this test in UI mode')}
      </div>
      <details class="failure-error">
        <summary>${test.flaky ? 'Error of the failed attempt' : 'Error'}</summary>
        <pre>${esc(failure.message)}</pre>
      </details>
    </div>`;
  }

  // ---- Actions of a failed test ----

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // No clipboard API outside a secure context - fall back to the selection.
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.className = 'visually-hidden';
      document.body.append(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    }
  }

  let toastTimer;
  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('is-visible'), 6000);
  }

  const ACTIONS = {
    async copy(test) {
      toast((await copyText(test.failure.markdown)) ? 'Copied the failure as Markdown.' : 'The browser refused access to the clipboard.');
    },

    screenshot(test) {
      if (!test.failure.screenshots.length) {
        toast('No screenshot: this test drives no browser page, or failed before one opened.');
        return;
      }
      openScreenshots(test);
    },

    async trace(test) {
      const { trace, showTraceCommand } = test.failure;
      if (!trace) {
        toast('No trace was recorded for this attempt. playwright.config.ts keeps the trace of every failed attempt (trace: retain-on-failure).');
        return;
      }
      if (location.protocol === 'file:') {
        const copied = await copyText(showTraceCommand);
        toast(
          'The trace viewer cannot start in a report opened from disk - serve it with "npm run report:custom".' +
            (copied ? `\nCopied instead: ${showTraceCommand}` : ''),
        );
        return;
      }
      window.open(`trace/index.html?trace=${encodeURIComponent(new URL(trace, location.href).href)}`, '_blank', 'noopener');
    },

    async uiMode(test) {
      const command = test.failure.uiModeCommand;
      const copied = await copyText(command);
      toast(copied ? `Copied - run it in the Automation-TypeScript folder:\n${command}` : command);
    },
  };

  function openScreenshots(test) {
    const shots = test.failure.screenshots;
    $('#shot-title').textContent = displayTitle(test);
    $('#shot-subtitle').textContent = `${test.id === null ? '' : `ID ${test.id} · `}${test.project} · ${test.file}:${test.line}`;
    const tabs = $('#shot-tabs');
    tabs.hidden = shots.length < 2;
    tabs.innerHTML = shots
      .map((shot, index) => `<button type="button" class="chip" data-shot="${index}" aria-pressed="false">${esc(shot.name)}</button>`)
      .join('');
    tabs.onclick = (event) => {
      const tab = event.target.closest('[data-shot]');
      if (tab) showScreenshot(shots, Number(tab.dataset.shot));
    };
    showScreenshot(shots, 0);
    $('#shot-dialog').showModal();
  }

  function showScreenshot(shots, index) {
    const shot = shots[index];
    $('#shot-image').src = shot.src;
    $('#shot-image').alt = `${shot.name} of the failed test`;
    $('#shot-open').href = shot.src;
    for (const tab of document.querySelectorAll('#shot-tabs [data-shot]')) {
      tab.setAttribute('aria-pressed', String(Number(tab.dataset.shot) === index));
    }
  }

  // ---- Events ----

  function bindEvents() {
    const toggle = (set, value) => (set.has(value) ? set.delete(value) : set.add(value));
    const showTests = () => $('#tests').scrollIntoView({ behavior: 'smooth', block: 'start' });

    $('#search').addEventListener('input', (event) => {
      state.query = event.target.value;
      update();
    });
    $('#feature-filter').addEventListener('change', (event) => {
      state.feature = event.target.value;
      update();
    });
    $('#project-filter').addEventListener('change', (event) => {
      state.project = event.target.value;
      update();
    });
    $('#sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      update();
    });
    $('#clear-filters').addEventListener('click', () => {
      Object.assign(state, { query: '', statuses: new Set(), tags: new Set(), feature: '', project: '' });
      update();
    });
    $('#status-chips').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-status]');
      if (!chip) return;
      toggle(state.statuses, chip.dataset.status);
      update();
    });
    $('#tag-filters').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-tag]');
      if (!chip) return;
      toggle(state.tags, chip.dataset.tag);
      update();
    });
    $('#summary-tiles').addEventListener('click', (event) => {
      const tile = event.target.closest('[data-status]');
      if (!tile) return;
      state.statuses = new Set([tile.dataset.status]);
      update();
      showTests();
    });
    $('#feature-rows').addEventListener('click', (event) => {
      const button = event.target.closest('[data-feature]');
      if (!button) return;
      state.feature = state.feature === button.dataset.feature ? '' : button.dataset.feature;
      update();
      if (state.feature) showTests();
    });
    $('#test-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      const test = button && byKey.get(button.dataset.key);
      if (test && test.failure) ACTIONS[button.dataset.action](test);
    });

    const dialog = $('#shot-dialog');
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
    });

    const tooltip = $('#tooltip');
    document.addEventListener('mouseover', (event) => {
      const target = event.target.closest && event.target.closest('[data-tip]');
      tooltip.hidden = !target;
      if (target) tooltip.textContent = target.dataset.tip;
    });
    document.addEventListener('mousemove', (event) => {
      if (tooltip.hidden) return;
      const left = Math.min(event.clientX + 12, window.innerWidth - tooltip.offsetWidth - 8);
      tooltip.style.left = `${Math.max(8, left)}px`;
      tooltip.style.top = `${event.clientY + 16}px`;
    });

    window.addEventListener('hashchange', () => {
      readHash();
      update();
    });
  }

  readHash();
  renderHeader();
  renderSummary();
  renderFeatures();
  buildControls();
  bindEvents();
  update();
})();
