/* Restless — shared page script.
 *
 * Driven entirely by the two files in /data. No page hardcodes hours, phone
 * numbers or menu items.
 *
 * These files load with fetch(), which browsers block on file:// URLs. Open the
 * site through a local server (see README), not by double-clicking the HTML.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday'
};

/* Hours are Cairo's, so read the clock in Cairo's zone rather than the
 * visitor's — someone checking from London still needs to know whether the
 * café is open now, in Maadi. */
const CAIRO_TZ = 'Africa/Cairo';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

const base = () => document.documentElement.dataset.base || '';

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

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

function fmtTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (h === 0 && m === 0) return 'midnight';
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}

/* A close time at or before the open means the shift runs past midnight —
 * 8am to 12am. Yesterday's late shift can still be running right now. */
function openState(hours) {
  const { day, minutes } = nowInCairo();
  const todayIdx = DAY_KEYS.indexOf(day);
  if (todayIdx < 0) return null;

  const running = (idx, offset) => {
    const slot = hours[DAY_KEYS[idx]];
    if (!slot || slot.closed) return null;
    const open = toMinutes(slot.open);
    const rawClose = toMinutes(slot.close);
    const close = rawClose <= open ? rawClose + 1440 : rawClose;
    const t = minutes + offset;
    return t >= open && t < close ? slot : null;
  };

  const live = running(todayIdx, 0) || running((todayIdx + 6) % 7, 1440);
  if (live) return { open: true, until: live.close };

  const today = hours[DAY_KEYS[todayIdx]];
  if (today && !today.closed && minutes < toMinutes(today.open)) {
    return { open: false, next: today.open, nextDay: 'today' };
  }
  for (let i = 1; i <= 7; i++) {
    const idx = (todayIdx + i) % 7;
    const slot = hours[DAY_KEYS[idx]];
    if (slot && !slot.closed) {
      return { open: false, next: slot.open, nextDay: i === 1 ? 'tomorrow' : DAY_NAMES[DAY_KEYS[idx]] };
    }
  }
  return null;
}

function renderStatus(node, site) {
  node.hidden = false;

  if (site.hours._confirmed === false) {
    node.textContent = 'Hours to be confirmed';
    node.removeAttribute('data-open');
    return;
  }

  const state = openState(site.hours);
  if (!state) { node.hidden = true; return; }

  node.dataset.open = String(state.open);
  node.textContent = state.open
    ? `Open now · until ${fmtTime(state.until)}`
    : `Closed · opens ${state.nextDay === 'today' ? '' : state.nextDay + ' '}${fmtTime(state.next)}`;

  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== CAIRO_TZ) {
    node.title = 'Cairo time';
  }
}

function renderHours(table, site) {
  const { day } = nowInCairo();
  const body = el('tbody');

  for (const key of DAY_KEYS) {
    const slot = site.hours[key];
    const row = el('tr');
    if (key === day) row.dataset.today = 'true';

    const th = el('th', null, DAY_NAMES[key]);
    th.scope = 'row';
    const td = el('td', null,
      !slot || slot.closed ? 'Closed' : `${fmtTime(slot.open)} – ${fmtTime(slot.close)}`);

    row.append(th, td);
    body.append(row);
  }

  table.replaceChildren(body);
}

/* -- brand mark ----------------------------------------------------------- */

/* The logo file may not be in the repo yet, and whoever adds it shouldn't have to
 * care about the extension. Try each candidate in turn; the first that loads
 * wins. If none do, the typographic stand-in stays. Adding the file later needs
 * no code change. */
function loadBrandMark(site) {
  const slots = document.querySelectorAll('[data-brand-mark]');
  const candidates = site.logo ? [site.logo, ...(site.logoAlternates ?? [])] : [];
  if (!slots.length || !candidates.length) return;

  const tryNext = (i) => {
    if (i >= candidates.length) return;
    const src = base() + candidates[i];
    const probe = new Image();
    probe.onerror = () => tryNext(i + 1);
    probe.onload = () => {
      for (const slot of slots) {
        const img = el('img', 'brand-mark');
        img.src = src;
        img.alt = `${site.name} logo`;
        img.width = 42;
        img.height = 42;
        slot.replaceWith(img);
      }
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) favicon.href = src;
    };
    probe.src = src;
  };

  tryNext(0);
}

/* -- contact links -------------------------------------------------------- */

function wireContacts(site) {
  for (const node of document.querySelectorAll('[data-maps]')) {
    node.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address.mapsQuery)}`;
  }

  for (const node of document.querySelectorAll('[data-tel]')) {
    node.href = `tel:${site.phones[0]}`;
  }

  for (const node of document.querySelectorAll('[data-whatsapp]')) {
    if (!site.whatsapp.enabled) {
      node.setAttribute('aria-disabled', 'true');
      node.title = 'WhatsApp number not set yet — add it in data/site.json';
      node.removeAttribute('href');
      continue;
    }
    const message = node.dataset.whatsapp || `Hi ${site.shortName}, I'd like to place an order.`;
    node.href = `https://wa.me/${site.whatsapp.number}?text=${encodeURIComponent(message)}`;
  }
}

/* -- menu ----------------------------------------------------------------- */

function buildItem(item, menu, site) {
  const li = el('li', 'menu-item');
  const line = el('div', 'menu-item-line');

  const name = el('span', 'menu-item-name', item.name);
  if (item.badge) name.append(el('span', 'badge', item.badge));
  line.append(name);

  const showPrice = site.showPrices && item.price != null;
  if (showPrice) {
    line.append(el('span', 'menu-leader'));
    line.append(el('span', 'menu-price',
      `${new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2 }).format(item.price)} ${menu.currency}`));
  }

  li.append(line);
  if (item.description) li.append(el('p', 'desc', item.description));
  return li;
}

function buildSection(section, menu, site) {
  const wrap = el('section', 'menu-section');
  wrap.id = section.id;

  wrap.append(el('h2', 'script', section.name));
  wrap.append(el('hr', 'rule'));
  if (section.note) wrap.append(el('p', 'note', section.note));

  const addList = (items) => {
    const list = el('ul', 'menu-items');
    for (const item of items) list.append(buildItem(item, menu, site));
    wrap.append(list);
  };

  if (section.groups?.length) {
    for (const group of section.groups) {
      wrap.append(el('h3', 'menu-group', group.name));
      addList(group.items);
    }
  } else if (section.items?.length) {
    addList(section.items);
  } else {
    wrap.append(el('p', 'empty', 'Nothing added to this section yet.'));
  }

  if (section.addons?.length) {
    const list = el('ul', 'addons');
    for (const addon of section.addons) {
      const li = el('li');
      li.append(document.createTextNode(addon.name + ' '));
      li.append(el('b', null, `+${addon.price.toFixed(2)} ${menu.currency}`));
      list.append(li);
    }
    wrap.append(list);
  }

  return wrap;
}

function renderMenu(root, menu, site) {
  const tabsHost = document.querySelector('[data-menu-tabs]');
  const jumpHost = document.querySelector('[data-menu-jump]');
  const noteHost = document.querySelector('[data-menu-note]');

  const show = (index) => {
    const active = menu.menus[index];

    for (const [i, button] of [...(tabsHost?.children ?? [])].entries()) {
      button.setAttribute('aria-selected', String(i === index));
    }

    if (noteHost) {
      noteHost.textContent = active.note || '';
      noteHost.hidden = !active.note;
    }

    if (jumpHost) {
      jumpHost.replaceChildren(...active.sections.map((section) => {
        const li = el('li');
        const a = el('a', null, section.name);
        a.href = `#${section.id}`;
        li.append(a);
        return li;
      }));
    }

    root.replaceChildren(...active.sections.map((s) => buildSection(s, menu, site)));

    if (menu.notice) root.append(el('p', 'menu-legal', menu.notice));
  };

  if (tabsHost) {
    tabsHost.replaceChildren(...menu.menus.map((sub, i) => {
      const button = el('button', null, sub.name);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(i === 0));
      button.addEventListener('click', () => show(i));
      return button;
    }));
  }

  show(0);
}

/* -- boot ----------------------------------------------------------------- */

(async function init() {
  let site;
  try {
    site = await loadJSON(`${base()}data/site.json`);
  } catch (err) {
    console.error('Could not load site data.', err);
    for (const node of document.querySelectorAll('[data-status]')) node.hidden = true;
    return;
  }

  for (const node of document.querySelectorAll('[data-status]')) renderStatus(node, site);
  for (const node of document.querySelectorAll('[data-hours-table]')) renderHours(node, site);
  wireContacts(site);
  loadBrandMark(site);

  const menuRoot = document.querySelector('[data-menu]');
  if (menuRoot) {
    try {
      renderMenu(menuRoot, await loadJSON(`${base()}data/menu.json`), site);
    } catch (err) {
      console.error('Could not load the menu.', err);
      menuRoot.replaceChildren(el('p', 'empty',
        `The menu could not be loaded. Please call us on ${site.phones[0]}.`));
    }
  }
})();
