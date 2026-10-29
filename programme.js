(function () {
  'use strict';
  document.documentElement.classList.add('js');
  const P = window.REProgramme;
  const appRoot = new URL('../', window.location.href);
  const $ = selector => document.querySelector(selector);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const assetUrl = source => {
    if (!source) return '';
    try { const url = new URL(source, appRoot); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  };
  const header = $('.site-header');
  const menuToggle = $('.nav-toggle');
  const drawer = $('.menu-drawer');
  const backdrop = $('.menu-backdrop');
  const main = $('main');
  const footer = $('.site-footer');
  let menuOpen = false;
  function setMenu(open, restoreFocus = true) {
    menuOpen = open;
    drawer.hidden = !open;
    backdrop.hidden = !open;
    drawer.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    main.inert = open;
    footer.inert = open;
    if (open) drawer.querySelector('.drawer-close').focus();
    else if (restoreFocus) menuToggle.focus();
  }
  menuToggle.addEventListener('click', () => setMenu(!menuOpen));
  drawer.querySelector('.drawer-close').addEventListener('click', () => setMenu(false));
  backdrop.addEventListener('click', () => setMenu(false));
  drawer.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false, false); });
  document.addEventListener('keydown', event => {
    if (!menuOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
    if (event.key === 'Tab') {
      const nodes = Array.from(drawer.querySelectorAll('button, a[href]'));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });
  function picture(source, alt, gallery, className) {
    const url = assetUrl(source);
    if (!url) return null;
    const link = element('a', className);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.lightbox = '';
    link.dataset.gallery = gallery;
    link.dataset.caption = alt;
    link.setAttribute('aria-label', `${alt} – Bild vergrößern`);
    const image = element('img');
    image.src = url;
    image.alt = alt;
    image.loading = 'lazy';
    const icon = element('span', 'image-open', '⤢');
    icon.setAttribute('aria-hidden', 'true');
    link.append(image, icon);
    return link;
  }
  function message(target, title, text, retry) {
    const box = element('div', 'programme-message');
    if (title) box.append(element('h2', '', title));
    box.append(element('p', '', text));
    if (retry) {
      const button = element('button', 'button button-secondary', 'Erneut versuchen');
      button.type = 'button';
      button.addEventListener('click', retry);
      box.append(button);
    }
    target.replaceChildren(box);
  }
  async function loadData() {
    const response = await fetch(new URL('assets/programme.json', appRoot), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Programme ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.groups)) throw new Error('Invalid programme data');
    return data.groups.filter(event => event.id && Array.isArray(event.occurrences));
  }
  function priceBadge(occurrence) {
    const badge = element('span', 'cost-badge', P.priceLabel(occurrence));
    badge.classList.toggle('is-free', P.costType(occurrence) === 'free');
    badge.classList.toggle('is-paid', P.costType(occurrence) === 'paid');
    return badge;
  }
  function statusLabel(occurrence) {
    if (/EventCancelled/.test(occurrence.status || '')) return 'Abgesagt';
    if (/EventPostponed/.test(occurrence.status || '')) return 'Verschoben';
    return '';
  }

  function enhanceSelect(select) {
    if (select.dataset.enhanced) return;
    select.dataset.enhanced = 'true';
    const wrapper = element('div', 'custom-select');
    select.before(wrapper); wrapper.append(select); select.hidden = true;
    const label = document.querySelector(`label[for="${select.id}"]`);
    label.id = `${select.id}-label`;
    const trigger = element('button', 'select-trigger'); trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-labelledby', label.id); trigger.setAttribute('aria-expanded', 'false');
    const list = element('div', 'select-options'); list.id = `${select.id}-options`;
    list.setAttribute('role', 'listbox'); list.setAttribute('aria-labelledby', label.id); list.hidden = true;
    trigger.setAttribute('aria-controls', list.id); wrapper.append(trigger, list);
    let options = [];
    function sync() {
      trigger.textContent = select.selectedOptions[0]?.textContent || '';
      options.forEach((button, index) => button.setAttribute('aria-selected', String(select.selectedIndex === index)));
    }
    function close(focus = false) { list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focus) trigger.focus(); }
    function open(index = select.selectedIndex) {
      document.dispatchEvent(new CustomEvent('select-close', {detail: trigger.id}));
      list.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      options[Math.max(0, index)]?.focus({preventScroll:true});
      options[Math.max(0, index)]?.scrollIntoView({block:'nearest'});
    }
    function rebuild() {
      options = Array.from(select.options, (option, index) => {
        const button = element('button', 'select-option', option.textContent); button.type = 'button';
        button.setAttribute('role', 'option'); button.tabIndex = -1;
        button.addEventListener('click', () => { select.selectedIndex = index; sync(); close(true); select.dispatchEvent(new Event('change', {bubbles:true})); });
        return button;
      });
      list.replaceChildren(...options); sync();
    }
    trigger.addEventListener('click', () => list.hidden ? open() : close());
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault(); open(event.key === 'End' ? options.length - 1 : event.key === 'Home' ? 0 : select.selectedIndex);
      }
    });
    let typed = ''; let typedAt = 0;
    list.addEventListener('keydown', event => {
      const index = options.indexOf(document.activeElement);
      let next = index;
      if (event.key === 'ArrowDown') next = Math.min(index + 1, options.length - 1);
      else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = options.length - 1;
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      else if (event.key === 'Tab') { close(); return; }
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== ' ') {
        const now = Date.now(); typed = now - typedAt < 700 ? typed + event.key : event.key; typedAt = now;
        const found = options.findIndex(option => P.normalizeText(option.textContent).startsWith(P.normalizeText(typed)));
        if (found >= 0) next = found;
      } else return;
      event.preventDefault(); options[next]?.focus();
    });
    document.addEventListener('click', event => { if (!wrapper.contains(event.target)) close(); });
    document.addEventListener('select-close', event => { if (event.detail !== trigger.id) close(); });
    select.addEventListener('select-sync', sync); select.addEventListener('change', sync);
    label.addEventListener('click', event => { event.preventDefault(); trigger.focus(); });
    new MutationObserver(rebuild).observe(select, {childList:true}); rebuild();
  }

  function programmePage() {
    const form = $('#programme-filters');
    const results = $('#programme-results');
    const count = $('#results-count');
    const date = $('#programme-date');
    let events = [];
    let filters = P.readFilters(window.location.search);
    let ready = false;
    let day = P.dateKey(new Date());
    const controls = Object.fromEntries(['q', 'period', 'date', 'place', 'price'].map(name => [name, form.elements.namedItem(name)]));
    function fillControls() {
      Object.keys(controls).forEach(name => {
        if (name === 'place' && filters.place && !Array.from(controls.place.options).some(option => option.value === filters.place)) controls.place.add(new Option(filters.place, filters.place));
        controls[name].value = filters[name];
        controls[name].dispatchEvent(new Event('select-sync'));
      });
    }
    function readControls() {
      return P.readFilters(new URLSearchParams(new FormData(form)).toString());
    }
    function saveFilters(next, push = true) {
      filters = next;
      const query = P.filterQuery(filters);
      const url = window.location.pathname + (query ? `?${query}` : '');
      if (push && url !== window.location.pathname + window.location.search) history.pushState({ filters }, '', url);
      fillControls();
      render();
    }
    function render() {
      date.textContent = `Heute: ${P.dateLabel(new Date())}`;
      if (!ready) return;
      const matches = P.filterEvents(events, filters, new Date());
      count.textContent = `${matches.length} ${matches.length === 1 ? 'Veranstaltung' : 'Veranstaltungen'} gefunden`;
      results.setAttribute('aria-busy', 'false');
      results.dataset.resultCount = String(matches.length);
      if (!matches.length) {
        message(results, 'Für diese Auswahl gibt es keine Veranstaltungen.', 'Ändere deine Suche oder den Zeitraum. Über „Alle Termine“ erreichst du auch vergangene Veranstaltungen.');
        return;
      }
      const fragment = document.createDocumentFragment();
      matches.forEach(match => {
        const event = match.event;
        const occurrence = match.occurrence;
        const image = occurrence.image || event.image;
        const card = element('article', `event-result${image ? ' has-image' : ''}`);
        const dateBlock = element('div', 'result-date');
        const start = new Date(occurrence.start);
        dateBlock.append(element('span', '', new Intl.DateTimeFormat('de-DE', { timeZone: P.timeZone, weekday: 'short' }).format(start)));
        const dateStrong = element('strong', '', new Intl.DateTimeFormat('de-DE', { timeZone: P.timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(start));
        dateBlock.append(dateStrong);
        const time = element('time', 'result-time', `${P.timeLabel(start)} Uhr`);
        time.dateTime = occurrence.start;
        dateBlock.append(time);
        if (P.lastDay(occurrence) !== P.firstDay(occurrence)) dateBlock.append(element('span', 'result-range', `bis ${P.shortDate(`${P.lastDay(occurrence)}T12:00:00+01:00`)}`));
        const details = element('div', 'result-copy');
        const title = element('h3', 'result-title');
        const href = new URL(P.detailUrl(event.id, occurrence.start, P.filterQuery(filters)), appRoot).href;
        const titleLink = element('a', '', event.title);
        titleLink.href = href;
        title.append(titleLink);
        details.append(title);
        const summary = event.summary || (occurrence.description || '').split(/\n\s*\n/)[0];
        if (summary) details.append(element('p', 'result-summary', summary.length > 260 ? `${summary.slice(0, 257).trimEnd()}…` : summary));
        if (occurrence.place) details.append(element('p', 'result-place', occurrence.place));
        const meta = element('div', 'result-meta');
        const terms = match.count === 1 ? '1 passender Termin' : `${match.count} passende Termine`;
        meta.append(priceBadge(occurrence), element('span', 'term-count', match.count === match.total ? `${match.total} ${match.total === 1 ? 'Termin' : 'Termine'}` : `${terms} · ${match.total} insgesamt`));
        details.append(meta);
        const status = statusLabel(occurrence);
        if (status) details.append(element('p', 'result-status', status));
        const detailLink = element('a', 'text-link', 'Details & Termine →');
        detailLink.href = href;
        details.append(detailLink);
        card.append(dateBlock, details);
        if (image) {
          const photo = element('a', 'result-picture');
          photo.href = href;
          photo.setAttribute('aria-label', `${event.title} – Details ansehen`);
          const thumbnail = element('img');
          thumbnail.src = assetUrl(image); thumbnail.alt = event.title; thumbnail.loading = 'lazy';
          photo.append(thumbnail); card.append(photo);
        }
        fragment.append(card);
      });
      results.replaceChildren(fragment);
    }
    async function load() {
      results.setAttribute('aria-busy', 'true');
      message(results, '', 'Das Veranstaltungsprogramm wird geladen.');
      try {
        events = await loadData();
        const places = Array.from(new Set(events.flatMap(event => event.occurrences.map(occurrence => occurrence.place)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de'));
        controls.place.replaceChildren(new Option('Alle Orte', ''));
        places.forEach(place => controls.place.add(new Option(place, place)));
        ready = true;
        form.querySelectorAll('select').forEach(enhanceSelect);
        fillControls();
        render();
      } catch (_) {
        ready = false;
        results.setAttribute('aria-busy', 'false');
        count.textContent = 'Programm nicht verfügbar';
        message(results, 'Das Programm konnte nicht geladen werden.', 'Bitte versuche es erneut. Deine Filter bleiben erhalten.', load);
      }
    }
    form.addEventListener('submit', event => { event.preventDefault(); saveFilters(readControls()); count.tabIndex = -1; count.focus({ preventScroll: true }); count.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
    $('#today-filter').addEventListener('click', () => { const next = readControls(); next.date = P.dateKey(new Date()); next.period = 'all'; saveFilters(next); });
    $('#reset-filters').addEventListener('click', () => saveFilters(P.readFilters('')));
    window.addEventListener('popstate', () => { filters = P.readFilters(window.location.search); fillControls(); render(); });
    fillControls();
    render();
    load();
    setInterval(() => { const current = P.dateKey(new Date()); if (current !== day) { day = current; render(); } }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { day = P.dateKey(new Date()); render(); } });
  }

  function eventPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const state = $('#event-state');
    const content = $('#event-content');
    const selector = $('#occurrence-select');
    const backQuery = P.filterQuery(P.readFilters(params.get('back') || ''));
    $('#back-to-programme').href = new URL(`programm/${backQuery ? `?${backQuery}` : ''}`, appRoot).href;
    let selected = null;
    let event = null;
    let icsObjectUrl = '';
    function descriptionContent(text) {
      const fragment = document.createDocumentFragment();
      const regex = /https?:\/\/[^\s<>]+/g;
      let index = 0;
      let match;
      while ((match = regex.exec(text))) {
        fragment.append(document.createTextNode(text.slice(index, match.index)));
        const url = P.safeUrl(match[0]);
        if (url) {
          const link = element('a', '', match[0]);
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          fragment.append(link);
        } else fragment.append(document.createTextNode(match[0]));
        index = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(index)));
      return fragment;
    }
    function renderOccurrence(occurrence) {
      selected = occurrence;
      selector.value = occurrence.id || occurrence.start;
      selector.dispatchEvent(new Event('select-sync'));
      $('#event-date').textContent = P.dateLabel(occurrence.start);
      $('#event-selected-date').textContent = P.lastDay(occurrence) === P.firstDay(occurrence) ? `${P.dateLabel(occurrence.start)} · ${P.timeLabel(occurrence.start)} Uhr` : `${P.dateLabel(occurrence.start)} bis ${P.shortDate(`${P.lastDay(occurrence)}T12:00:00+01:00`)}`;
      $('#event-time').textContent = occurrence.end ? `${P.timeLabel(occurrence.start)} – ${P.timeLabel(occurrence.end)} Uhr` : `${P.timeLabel(occurrence.start)} Uhr · Endzeit nicht angegeben`;
      const oldBadge = $('#event-price');
      const badge = priceBadge(occurrence);
      badge.id = 'event-price';
      oldBadge.replaceWith(badge);
      const status = statusLabel(occurrence);
      $('#event-status').textContent = status;
      $('#event-status').hidden = !status;
      $('#event-description').replaceChildren(descriptionContent(occurrence.description || event.description || event.summary || 'Zu dieser Veranstaltung liegt keine weitere Beschreibung vor.'));
      $('#event-place').textContent = occurrence.place || 'Veranstaltungsort nicht angegeben';
      $('#event-address').textContent = occurrence.address || '';
      $('#event-address').hidden = !occurrence.address;
      $('#event-organizer').textContent = occurrence.organizer ? `Veranstalter: ${occurrence.organizer}` : '';
      $('#event-organizer').hidden = !occurrence.organizer;
      const maps = P.mapsUrl(occurrence);
      $('#event-maps').hidden = !maps;
      if (maps) $('#event-maps').href = maps;
      const website = P.safeUrl(occurrence.url || event.url);
      $('#event-website').hidden = !website;
      if (website) $('#event-website').href = website;
      const image = picture(occurrence.image || event.image, event.title, `event-${event.id}`, 'event-image');
      $('#event-picture').replaceChildren(...(image ? [image] : []));
      const embed = P.mapEmbedUrl(occurrence);
      $('#event-map-area').hidden = !embed;
      $('#event-map-container').hidden = true;
      $('#event-map-container').replaceChildren();
      $('#load-event-map').hidden = false;
      const calendar = P.calendarLinks(event, occurrence);
      $('.calendar-section').hidden = !calendar;
      if (calendar) {
        $('#calendar-google').href = calendar.google;
        $('#calendar-outlook').href = calendar.outlook;
        $('#calendar-notice').textContent = calendar.provisionalEnd ? 'Die Endzeit ist nicht angegeben. Google und Outlook planen vorläufig eine Stunde ein; die ICS-Datei enthält keine Endzeit.' : 'Die Kalenderdatei enthält den ausgewählten Termin. Alle angezeigten Uhrzeiten gelten für Europe/Berlin.';
        if (icsObjectUrl) URL.revokeObjectURL(icsObjectUrl);
        icsObjectUrl = URL.createObjectURL(new Blob([P.ics(event, occurrence)], { type: 'text/calendar;charset=utf-8' }));
        $('#calendar-ics').href = icsObjectUrl;
        $('#calendar-ics').download = `re-leuchtet-${event.id}-${P.dateKey(occurrence.start)}.ics`;
      }
    }
    selector.addEventListener('change', () => {
      const occurrence = event.occurrences.find(item => (item.id || item.start) === selector.value);
      if (!occurrence) return;
      renderOccurrence(occurrence);
      const query = new URLSearchParams(window.location.search);
      query.set('termin', occurrence.start);
      history.replaceState(null, '', `${window.location.pathname}?${query}`);
      $('#occurrence-notice').hidden = true;
    });
    $('#load-event-map').addEventListener('click', () => {
      const url = P.mapEmbedUrl(selected);
      if (!url) return;
      const iframe = element('iframe');
      iframe.src = url;
      iframe.title = `OpenStreetMap: ${selected.place || event.title}`;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      $('#event-map-container').replaceChildren(iframe);
      $('#event-map-container').hidden = false;
      $('#load-event-map').hidden = true;
    });
    async function load() {
      state.hidden = false;
      content.hidden = true;
      message(state, '', 'Die Veranstaltungsinformationen werden geladen.');
      try {
        const events = await loadData();
        event = events.find(item => item.id === id);
        if (!event || !event.occurrences.length) {
          $('#event-title').textContent = 'Veranstaltung nicht gefunden.';
          message(state, 'Diese Veranstaltung ist nicht verfügbar.', 'Über „Zurück zum Programm“ findest du alle vorhandenen Veranstaltungen.');
          return;
        }
        $('#event-title').textContent = event.title;
        document.title = `${event.title} · Recklinghausen leuchtet`;
        $('#event-summary').textContent = event.summary || '';
        $('#event-summary').hidden = !event.summary;
        const ordered = event.occurrences.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
        selector.replaceChildren();
        ordered.forEach(occurrence => {
          const range = P.lastDay(occurrence) !== P.firstDay(occurrence) ? ` bis ${P.lastDay(occurrence).split('-').reverse().join('.')}` : '';
          const option = new Option(`${P.shortDate(occurrence.start)}${range} · ${P.timeLabel(occurrence.start)} Uhr · ${P.priceLabel(occurrence)}`, occurrence.id || occurrence.start);
          selector.add(option);
        });
        enhanceSelect(selector);
        const requested = params.get('termin');
        const occurrence = P.selectOccurrence(event, requested, new Date());
        const exact = !requested || ordered.some(item => item.id === requested || item.start === requested || new Date(item.start).valueOf() === new Date(requested).valueOf());
        $('#occurrence-notice').hidden = exact;
        $('#occurrence-notice').textContent = exact ? '' : 'Der angefragte Termin ist nicht vorhanden. Angezeigt wird ein verfügbarer Termin dieser Veranstaltung.';
        renderOccurrence(occurrence);
        state.hidden = true;
        content.hidden = false;
      } catch (_) {
        $('#event-title').textContent = 'Veranstaltung nicht verfügbar.';
        message(state, 'Die Veranstaltungsinformationen konnten nicht geladen werden.', 'Bitte versuche es erneut.', load);
      }
    }
    window.addEventListener('pagehide', () => { if (icsObjectUrl) URL.revokeObjectURL(icsObjectUrl); });
    load();
  }
  if (document.body.dataset.page === 'programme') programmePage();
  else if (document.body.dataset.page === 'event') eventPage();
})();
