document.documentElement.classList.add('js');

const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.nav-toggle');
const drawer = document.querySelector('.menu-drawer');
const drawerClose = drawer.querySelector('.drawer-close');
const backdrop = document.querySelector('.menu-backdrop');
const main = document.querySelector('main');
const footer = document.querySelector('.site-footer');
let menuOpen = false;

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 40 || menuOpen);
}
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
  updateHeader();
  if (open) drawerClose.focus();
  else if (restoreFocus) menuToggle.focus();
}
menuToggle.addEventListener('click', () => setMenu(!menuOpen));
drawerClose.addEventListener('click', () => setMenu(false));
backdrop.addEventListener('click', () => setMenu(false));
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

drawer.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href');
  setMenu(false, false);
  if (href.startsWith('#')) {
    const section = document.getElementById(href.slice(1));
    if (section) {
      section.setAttribute('tabindex', '-1');
      section.focus({ preventScroll: true });
    }
  }
});
document.addEventListener('keydown', (event) => {
  if (!menuOpen) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setMenu(false);
  }
  if (event.key === 'Tab') {
    const focusable = Array.from(drawer.querySelectorAll('button, a[href]')).filter((element) => !element.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
});

// Occurrences are compared to the current calendar date in the festival's timezone.
const timeZone = 'Europe/Berlin';
const programmeDate = document.getElementById('programme-today');
const programmeList = document.getElementById('programme-list');
const calendarParts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateLabel = new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const clockLabel = new Intl.DateTimeFormat('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' });
let occurrences = null;
let programmeError = false;
let displayedDay = '';

function dateKey(date) {
  const parts = Object.fromEntries(calendarParts.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function renderProgramme(force = false) {
  const now = new Date();
  const today = dateKey(now);
  if (!force && today === displayedDay) return;
  displayedDay = today;
  programmeDate.textContent = dateLabel.format(now);
  programmeDate.dataset.currentDate = today;
  programmeList.replaceChildren();
  programmeList.setAttribute('aria-busy', String(occurrences === null && !programmeError));
  if (programmeError) {
    programmeList.append(makeElement('p', 'programme-state', 'Das heutige Programm konnte nicht geladen werden. Alle Termine findest du im vollständigen Veranstaltungskalender.'));
    return;
  }
  if (occurrences === null) {
    programmeList.append(makeElement('p', 'programme-state', 'Die heutigen Veranstaltungen werden geladen.'));
    return;
  }
  const todayEvents = occurrences.filter((event) => {
    const start = new Date(event.start);
    return !Number.isNaN(start.valueOf()) && dateKey(start) === today;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
  programmeList.dataset.eventCount = String(todayEvents.length);
  if (todayEvents.length === 0) {
    programmeList.append(makeElement('p', 'programme-state', 'Für heute sind keine Veranstaltungen im vorliegenden Programm eingetragen. Entdecke weitere Termine im vollständigen Veranstaltungskalender.'));
    return;
  }
  todayEvents.forEach((event) => {
    const start = new Date(event.start);
    const row = makeElement('article', 'programme-row');
    const time = makeElement('time', 'programme-time', clockLabel.format(start));
    time.dateTime = event.start;
    const end = event.end ? new Date(event.end) : null;
    if (end && !Number.isNaN(end.valueOf())) time.append(makeElement('span', 'programme-end', `bis ${clockLabel.format(end)} Uhr`));
    const details = makeElement('div');
    const title = makeElement('h3');
    const link = makeElement('a', 'programme-title-link', event.title);
    const detail = new URL('veranstaltung/', document.baseURI);
    detail.searchParams.set('id', event.groupId || '');
    detail.searchParams.set('termin', event.start);
    detail.searchParams.set('back', new URLSearchParams({ date: today, period: 'all' }).toString());
    link.href = detail.href;
    title.append(link);
    details.append(title);
    if (event.place) details.append(makeElement('p', '', event.place));
    if (/EventCancelled/.test(event.status || '')) details.append(makeElement('span', 'event-status', 'Abgesagt'));
    else if (/EventPostponed/.test(event.status || '')) details.append(makeElement('span', 'event-status', 'Verschoben'));
    const arrow = makeElement('span', 'row-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    row.append(time, details, arrow);
    programmeList.append(row);
  });
}
renderProgramme(true);
fetch(new URL('assets/events.json', document.baseURI), { cache: 'no-cache' })
  .then((response) => {
    if (!response.ok) throw new Error(`Programme: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data.events)) throw new Error('Invalid programme');
    occurrences = data.events;
    renderProgramme(true);
  })
  .catch(() => { programmeError = true; renderProgramme(true); });
setInterval(() => renderProgramme(), 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderProgramme(); });
