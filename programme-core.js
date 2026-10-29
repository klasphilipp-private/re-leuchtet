(function (root) {
  'use strict';
  const timeZone = 'Europe/Berlin';
  const dayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateFormatter = new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortFormatter = new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' });
  const validDate = value => { if (value === null || value === undefined || value === '') return null; const d = new Date(value); return !Number.isNaN(d.valueOf()) ? d : null; };
  function dateKey(value) {
    const d = validDate(value);
    if (!d) return '';
    const parts = Object.fromEntries(dayFormatter.formatToParts(d).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  const dateLabel = value => validDate(value) ? dateFormatter.format(new Date(value)) : '';
  const shortDate = value => validDate(value) ? shortFormatter.format(new Date(value)) : '';
  const timeLabel = value => validDate(value) ? timeFormatter.format(new Date(value)) : '';
  const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de');
  const safeUrl = value => {
    if (typeof value !== 'string') return '';
    try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  };
  function readFilters(search) {
    const params = new URLSearchParams(search || '');
    const period = params.get('period') || params.get('rel_period') || 'upcoming';
    const date = params.get('date') || params.get('rel_date') || '';
    const price = params.get('price') || params.get('rel_price') || 'all';
    return {
      q: (params.get('q') || params.get('rel_q') || '').trim(),
      period: ['upcoming', 'past', 'all'].includes(period) ? period : 'upcoming',
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
      place: params.get('place') || params.get('rel_place') || '',
      price: ['free', 'paid', 'all'].includes(price) ? price : 'all'
    };
  }
  function filterQuery(filters) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.period && filters.period !== 'upcoming') params.set('period', filters.period);
    if (filters.date) params.set('date', filters.date);
    if (filters.place) params.set('place', filters.place);
    if (filters.price && filters.price !== 'all') params.set('price', filters.price);
    return params.toString();
  }
  function costType(occurrence) {
    if (occurrence.costType === 'unknown') return 'free';
    if (['free', 'paid'].includes(occurrence.costType)) return occurrence.costType;
    if (occurrence.isFree === true || occurrence.costType === 'free') return 'free';
    if (occurrence.isFree === false || occurrence.costType === 'paid') return 'paid';
    const price = String(occurrence.price || '').trim();
    if (/^(kostenlos|kostenfrei|eintritt frei|frei|0(?:[,.]00)?\s*€?)$/i.test(price)) return 'free';
    if (/\d/.test(price) && /€|euro/i.test(price) && !/^0(?:[,.]00)?\s*(€|euro)$/i.test(price)) return 'paid';
    return 'free';
  }
  function priceLabel(occurrence) {
    const type = costType(occurrence);
    if (type === 'free' && (!occurrence.price || /keine angabe/i.test(occurrence.price))) return 'kostenlos';
    if (occurrence.price) return String(occurrence.price);
    return type === 'paid' ? 'Kostenpflichtig' : 'Eintritt: keine Angabe';
  }
  const firstDay = occurrence => occurrence.date || dateKey(occurrence.start);
  const lastDay = occurrence => occurrence.lastDate || dateKey(occurrence.end) || firstDay(occurrence);
  function filterEvents(events, filters, now) {
    filters = Object.assign(readFilters(''), filters || {});
    const today = dateKey(now || new Date());
    const terms = normalizeText(filters.q).split(/\s+/).filter(Boolean);
    const results = [];
    events.forEach(event => {
      const matches = event.occurrences.filter(occurrence => {
        const day = firstDay(occurrence);
        if (!day) return false;
        if (filters.period === 'upcoming' && lastDay(occurrence) < today) return false;
        if (filters.period === 'past' && lastDay(occurrence) >= today) return false;
        if (filters.date && (day > filters.date || lastDay(occurrence) < filters.date)) return false;
        if (filters.place && occurrence.place !== filters.place) return false;
        if (filters.price !== 'all' && costType(occurrence) !== filters.price) return false;
        const haystack = normalizeText([event.title, event.summary, event.description, occurrence.description, occurrence.place, occurrence.address, event.keywords].filter(Boolean).join(' '));
        return terms.every(term => haystack.includes(term));
      }).sort((a, b) => new Date(a.start) - new Date(b.start));
      if (!matches.length) return;
      const future = matches.filter(occurrence => lastDay(occurrence) >= today);
      const occurrence = filters.period === 'past' ? matches[matches.length - 1] : (future[0] || matches[matches.length - 1]);
      results.push({ event, occurrence, matches, count: matches.length, total: event.occurrences.length });
    });
    return results.sort((a, b) => {
      const aFuture = lastDay(a.occurrence) >= today;
      const bFuture = lastDay(b.occurrence) >= today;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      const difference = new Date(a.occurrence.start) - new Date(b.occurrence.start);
      return aFuture ? difference : -difference;
    });
  }
  function selectOccurrence(event, start, now) {
    const ordered = event.occurrences.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    if (start) {
      const selected = ordered.find(occurrence => occurrence.id === start || occurrence.start === start || new Date(occurrence.start).valueOf() === new Date(start).valueOf());
      if (selected) return selected;
    }
    return ordered.find(occurrence => lastDay(occurrence) >= dateKey(now || new Date())) || ordered[ordered.length - 1] || null;
  }
  function detailUrl(id, start, query, base) {
    const params = new URLSearchParams();
    if (start) params.set('termin', start);
    if (query) params.set('back', query.replace(/^\?/, ''));
    return `${base || 'veranstaltung/'}${encodeURIComponent(id)}.html${params.size ? `?${params}` : ''}`;
  }
  function mapsUrl(occurrence) {
    if (safeUrl(occurrence.mapsUrl)) return safeUrl(occurrence.mapsUrl);
    const destination = [occurrence.place, occurrence.address].filter(Boolean).join(', ');
    if (Number.isFinite(occurrence.lat) && Number.isFinite(occurrence.lng)) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${occurrence.lat},${occurrence.lng}`)}`;
    return destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : '';
  }
  function mapEmbedUrl(occurrence) {
    if (!Number.isFinite(occurrence.lat) || !Number.isFinite(occurrence.lng)) return '';
    const lat = occurrence.lat;
    const lng = occurrence.lng;
    const bounds = `${lng - .008},${lat - .0045},${lng + .008},${lat + .0045}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const utcStamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  function calendarLinks(event, occurrence) {
    const start = validDate(occurrence.start);
    if (!start) return null;
    const validEnd = validDate(occurrence.end);
    const end = validEnd && validEnd > start ? validEnd : new Date(start.valueOf() + 3600000);
    const description = occurrence.description || event.description || event.summary || '';
    const location = [occurrence.place, occurrence.address].filter(Boolean).join(', ');
    const url = safeUrl(occurrence.url || event.url);
    const google = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${utcStamp(start)}/${utcStamp(end)}`, details: [description, url].filter(Boolean).join('\n\n'), location, ctz: timeZone });
    const outlook = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, startdt: start.toISOString(), enddt: end.toISOString(), body: [description, url].filter(Boolean).join('\n\n'), location });
    return { google: safeUrl(occurrence.googleCalendarUrl) || `https://calendar.google.com/calendar/render?${google}`, outlook: safeUrl(occurrence.outlookCalendarUrl) || `https://outlook.live.com/calendar/0/deeplink/compose?${outlook}`, provisionalEnd: !(validEnd && validEnd > start) };
  }
  function icsEscape(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function foldLine(line) {
    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    const lines = [];
    let chunk = '';
    let bytes = 0;
    Array.from(line).forEach(character => {
      const length = encoder ? encoder.encode(character).length : unescape(encodeURIComponent(character)).length;
      if (bytes + length > 73) { lines.push(chunk); chunk = ' '; bytes = 1; }
      chunk += character; bytes += length;
    });
    lines.push(chunk);
    return lines.join('\r\n');
  }
  function ics(event, occurrence, now) {
    const start = validDate(occurrence.start);
    if (!start) return '';
    const end = validDate(occurrence.end);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Recklinghausen leuchtet//Programm//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${icsEscape(`${event.id}-${start.toISOString()}@re-leuchtet.de`)}`, `DTSTAMP:${utcStamp(now || new Date())}`, `DTSTART:${utcStamp(start)}`];
    if (end && end > start) lines.push(`DTEND:${utcStamp(end)}`);
    lines.push(`SUMMARY:${icsEscape(event.title)}`, `DESCRIPTION:${icsEscape(occurrence.description || event.description || event.summary || '')}`, `LOCATION:${icsEscape([occurrence.place, occurrence.address].filter(Boolean).join(', '))}`);
    const url = safeUrl(occurrence.url || event.url);
    if (url) lines.push(`URL:${url}`);
    if (/EventCancelled/.test(occurrence.status || '')) lines.push('STATUS:CANCELLED');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }
  const api = { timeZone, dateKey, dateLabel, shortDate, timeLabel, firstDay, lastDay, normalizeText, safeUrl, readFilters, filterQuery, costType, priceLabel, filterEvents, selectOccurrence, detailUrl, mapsUrl, mapEmbedUrl, calendarLinks, ics };
  root.REProgramme = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
