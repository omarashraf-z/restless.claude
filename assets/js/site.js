/* Restless — shared page script.
 *
 * Everything here is driven by the two JSON files in /data. No page hardcodes
 * hours, phone numbers or menu items, so updating the site means editing data,
 * not markup.
 *
 * Note: these files are loaded with fetch(), which browsers block on file://
 * URLs. Open the site through a local server (see README) rather than by
 * double-clicking the HTML.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday'
};

/* Cairo is UTC+2 with no daylight saving as of 2026's schedule for most of the
 * year; rather than guess, we read the visitor's own clock and only claim
 * "open now" when their timezone is Egypt's. Everyone else sees the hours
 * table without a live claim, which is the honest answer. */
const CAIRO_TZ = 'Africa/Cairo';

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

function base() {
  // Works both at a domain root and under a /repo-name/ GitHub Pages path.
  return document.documentElement.dataset.base || '';
}

/* -- hours ---------------------------------------------------------------- */

function nowInCairo() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    day: (get('weekday') || '').toLowerCase().slice(0, 3),
    minutes: Number(get('hour')) * 60 + Number(get('minute'))
  };
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function fmtTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}

/* A closing time earlier than the opening time means the shift runs past
 * midnight — 9am to 1am. Yesterday's late shift can still be running now. */
function openState(hours) {
  const { day, minutes } = nowInCairo();
  const todayIdx = DAY_KEYS.indexOf(day);
  if (todayIdx < 0) return null;

  const check = (idx, offset) => {
    const slot = hours[DAY_KEYS[idx]];
    if (!slot || slot.closed) return null;
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close) + (toMinutes(slot.close) <= open ? 1440 : 0);
    const t = minutes + offset;
    return t >= open && t < close ? slot : null;
  };

  const yesterdayIdx = (todayIdx + 6) % 7;
  const running = check(todayIdx, 0) || check(yesterdayIdx, 1440);
  if (running) return { open: true, until: running.close };

  const today = hours[DAY_KEYS[todayIdx]];
  if (today && !today.closed && minutes < toMinutes(today.open)) {
    return { open: false, next: today.open, nextDay: 'today' };
  }
  for (let i = 1; i <= 7; i++) {
    const slot = hours[DAY_KEYS[(todayIdx + i) % 7]];
    if (slot && !slot.closed) {
      return { open: false, next: slot.open, nextDay: i === 1 ? 'tomorrow' : DAY_NAMES[DAY_KEYS[(todayIdx + i) % 7]] };
    }
  }
  return null;
}

function renderStatus(el, site) {
  if (site.hours._confirmed === false) {
    el.textContent = 'Hours to be confirmed';
    el.removeAttribute('data-open');
    return;
  }
  const visitorTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const state = openState(site.hours);
  if (!state) { el.hidden = true; return; }

  el.dataset.open = String(state.open);
  if (state.open) {
    el.textContent = `Open now · until ${fmtTime(state.until)}`;
  } else {
    el.textContent = `Closed · opens ${state.nextDay === 'today' ? '' : state.nextDay + ' '}${fmtTime(state.next)}`.replace('  ', ' ');
  }
  if (visitorTZ !== CAIRO_TZ) el.title = 'Cairo time';
}

function renderHours(table, site) {
  const { day } = nowInCairo();
  table.innerHTML = '';
  const body = document.createElement('tbody');
  for (const key of DAY_KEYS) {
    const slot = site.hours[key];
    const row = document.createElement('tr');
    if (key === day) row.dataset.today = 'true';
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = DAY_NAMES[key];
    const td = document.createElement('td');
    td.textContent = !slot || slot.closed ? 'Closed' : `${fmtTime(slot.open)} – ${fmtTime(slot.close)}`;
    row.append(th, td);
    body.append(row);
  }
  table.append(body);
}

/* -- contact links -------------------------------------------------------- */

function wireContacts(site) {
  document.querySelectorAll('[data-maps]').forEach((el) => {
    el.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address.mapsQuery)}`;
  });

  document.querySelectorAll('[data-tel]').forEach((el) => {
    el.href = `tel:${site.phones[0]}`;
  });

  document.querySelectorAll('[data-whatsapp]').forEach((el) => {
    if (!site.whatsapp.enabled) {
      el.setAttribute('aria-disabled', 'true');
      el.title = 'WhatsApp number not set yet — add it in data/site.json';
      el.removeAttribute('href');
      return;
    }
    const message = el.dataset.whatsapp || `Hi ${site.shortName}, I'd like to place an order.`;
    el.href = `https://wa.me/${site.whatsapp.number}?text=${encodeURIComponent(message)}`;
  });
}

/* -- menu ----------------------------------------------------------------- */

function renderMenu(root, menu, site) {
  const nav = document.querySelector('[data-menu-nav]');
  const money = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 });

  root.innerHTML = '';
  if (nav) nav.innerHTML = '';

  for (const section of menu.sections) {
    if (nav) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${section.id}`;
      a.textContent = section.name;
      li.append(a);
      nav.append(li);
    }

    const wrap = document.createElement('section');
    wrap.className = 'menu-section';
    wrap.id = section.id;

    const h2 = document.createElement('h2');
    h2.textContent = section.name;
    wrap.append(h2);

    if (section.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = section.note;
      wrap.append(note);
    }

    if (!section.items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Nothing added to this section yet.';
      wrap.append(empty);
      root.append(wrap);
      continue;
    }

    const list = document.createElement('ul');
    list.className = 'menu-items';

    for (const item of section.items) {
      const li = document.createElement('li');
      li.className = 'menu-item';

      const h3 = document.createElement('h3');
      h3.textContent = item.name;
      li.append(h3);

      if (site.showPrices && item.price !== null && item.price !== undefined) {
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = `${money.format(item.price)} ${site.currency}`;
        li.append(price);
      }

      if (item.description) {
        const desc = document.createElement('p');
        desc.className = 'desc';
        desc.textContent = item.description;
        li.append(desc);
      }

      if (item.tags?.length) {
        const tags = document.createElement('div');
        tags.className = 'tags';
        for (const tag of item.tags) {
          const span = document.createElement('span');
          span.className = 'tag';
          span.textContent = tag.replace(/-/g, ' ');
          tags.append(span);
        }
        li.append(tags);
      }

      list.append(li);
    }

    wrap.append(list);
    root.append(wrap);
  }
}

/* -- boot ----------------------------------------------------------------- */

(async function init() {
  let site;
  try {
    site = await loadJSON(`${base()}data/site.json`);
  } catch (err) {
    console.error('Could not load site data.', err);
    document.querySelectorAll('[data-status]').forEach((el) => { el.hidden = true; });
    return;
  }

  document.querySelectorAll('[data-status]').forEach((el) => renderStatus(el, site));
  document.querySelectorAll('[data-hours-table]').forEach((el) => renderHours(el, site));
  wireContacts(site);

  const menuRoot = document.querySelector('[data-menu]');
  if (menuRoot) {
    try {
      renderMenu(menuRoot, await loadJSON(`${base()}data/menu.json`), site);
    } catch (err) {
      console.error('Could not load the menu.', err);
      menuRoot.innerHTML = '<p class="empty">The menu could not be loaded. Please call us on ' + site.phones[0] + '.</p>';
    }
  }
})();
