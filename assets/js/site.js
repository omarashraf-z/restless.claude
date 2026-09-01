/* Restless — shared page script.
 *
 * Driven entirely by the files in /data. No page hardcodes hours, phone
 * numbers, menu items or interface copy.
 *
 * These files load with fetch(), which browsers block on file:// URLs. Open the
 * site through a local server (see README), not by double-clicking the HTML.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* Hours are Cairo's, so read the clock in Cairo's zone rather than the
 * visitor's — someone checking from London still needs to know whether the
 * café is open now, in Maadi. */
const CAIRO_TZ = 'Africa/Cairo';

const LANG_KEY = 'restless.lang';
const ORDER_KEY = 'restless.order';

/* Arabic faces are only fetched when Arabic is actually chosen, so an English
 * visitor never pays for them. Amiri is a naskh with the period feel the brand
 * already has; Cairo carries the headings. */
const ARABIC_FONTS =
  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700&display=swap';

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

/* -- language ------------------------------------------------------------- */

const state = { lang: 'en', i18n: null, site: null, menu: null, order: new Map() };

/* A stored choice always wins. Failing that, an Arabic-speaking browser gets
 * Arabic — but storage can throw in private modes, so never let it break the
 * page. */
function initialLang(i18n) {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && i18n[saved]) return saved;
  } catch { /* storage unavailable — fall through */ }

  const prefers = (navigator.languages || [navigator.language || ''])
    .some((l) => String(l).toLowerCase().startsWith('ar'));
  return prefers && i18n.ar ? 'ar' : 'en';
}

function t(key, vars) {
  const dict = state.i18n?.[state.lang] ?? {};
  let out = dict[key] ?? state.i18n?.en?.[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, v);
  return out;
}

/* Pick the Arabic variant of a data field when it exists, else the English one.
 * Menu item names deliberately have no Arabic variant — see the README. */
const field = (obj, name) =>
  (state.lang === 'ar' && obj[name + 'Ar']) || obj[name];

function loadArabicFonts() {
  if (document.getElementById('ar-fonts')) return;
  const link = el('link');
  link.id = 'ar-fonts';
  link.rel = 'stylesheet';
  link.href = ARABIC_FONTS;
  document.head.append(link);
}

function applyLanguage() {
  const meta = state.i18n.languages[state.lang];
  const root = document.documentElement;

  root.lang = state.lang;
  root.dir = meta.dir;
  if (state.lang === 'ar') loadArabicFonts();

  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-html]')) {
    node.innerHTML = t(node.dataset.i18nHtml);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }

  for (const node of document.querySelectorAll('[data-lang-toggle]')) {
    node.textContent = meta.switchTo;
    node.setAttribute('aria-label', t('lang.aria'));
    node.lang = state.lang === 'en' ? 'ar' : 'en';
  }
}

function setLanguage(lang) {
  if (!state.i18n?.[lang]) return;
  state.lang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* not fatal */ }

  applyLanguage();
  renderAll();
}

/* -- hours ---------------------------------------------------------------- */

function nowInCairo() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    day: (get('weekday') || '').toLowerCase().slice(0, 3),
    minutes: Number(get('hour')) * 60 + Number(get('minute'))
  };
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

/* Latin digits in both languages. Egyptian menus and signage use them almost
 * universally, and Arabic-Indic numerals beside EGP prices would read oddly. */
function fmtTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (h === 0 && m === 0) return t('time.midnight');
  const suffix = t(h >= 12 ? 'time.pm' : 'time.am');
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return (m === 0 ? `${hour12}` : `${hour12}:${String(m).padStart(2, '0')}`) + suffix;
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
    const at = minutes + offset;
    return at >= open && at < close ? slot : null;
  };

  const live = running(todayIdx, 0) || running((todayIdx + 6) % 7, 1440);
  if (live) return { open: true, until: live.close };

  const today = hours[DAY_KEYS[todayIdx]];
  if (today && !today.closed && minutes < toMinutes(today.open)) {
    return { open: false, next: today.open, nextDay: null };
  }
  for (let i = 1; i <= 7; i++) {
    const idx = (todayIdx + i) % 7;
    const slot = hours[DAY_KEYS[idx]];
    if (slot && !slot.closed) {
      return {
        open: false,
        next: slot.open,
        nextDay: i === 1 ? t('status.tomorrow') : t('day.' + DAY_KEYS[idx])
      };
    }
  }
  return null;
}

function renderStatus(node, site) {
  node.hidden = false;

  if (site.hours._confirmed === false) {
    node.textContent = t('status.unconfirmed');
    node.removeAttribute('data-open');
    return;
  }

  const status = openState(site.hours);
  if (!status) { node.hidden = true; return; }

  node.dataset.open = String(status.open);
  if (status.open) {
    node.textContent = t('status.openUntil', { time: fmtTime(status.until) });
  } else {
    const time = fmtTime(status.next);
    node.textContent = status.nextDay
      ? t('status.closedOpensDay', { day: status.nextDay, time })
      : t('status.closedOpens', { time });
  }

  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== CAIRO_TZ) {
    node.title = t('status.cairoTime');
  }
}

function renderHours(table, site) {
  const { day } = nowInCairo();
  const body = el('tbody');

  for (const key of DAY_KEYS) {
    const slot = site.hours[key];
    const row = el('tr');
    if (key === day) row.dataset.today = 'true';

    const th = el('th', null, t('day.' + key));
    th.scope = 'row';
    const td = el('td', null, !slot || slot.closed
      ? t('day.closed')
      : `${fmtTime(slot.open)} – ${fmtTime(slot.close)}`);

    row.append(th, td);
    body.append(row);
  }

  table.replaceChildren(body);
}

/* -- brand mark ----------------------------------------------------------- */

/* The logo is in the markup, so it paints with the page and nothing flashes
 * before it. This only handles the failure case: if the file is missing or
 * renamed, walk the alternate extensions, and fall back to a typographic mark
 * only when none of them load. */
function guardBrandMark(site) {
  const marks = [...document.querySelectorAll('img[data-brand-mark]')];
  if (!marks.length) return;

  const candidates = [site.logo, ...(site.logoAlternates ?? [])].filter(Boolean);

  const useTypographic = () => {
    for (const mark of marks) {
      const span = el('span', 'brand-mark brand-mark--fallback', 'R');
      span.setAttribute('aria-hidden', 'true');
      span.dataset.brandMark = '';
      mark.replaceWith(span);
    }
  };

  const tryFrom = (i) => {
    if (i >= candidates.length) { useTypographic(); return; }
    const src = base() + candidates[i];
    const probe = new Image();
    probe.onerror = () => tryFrom(i + 1);
    probe.onload = () => {
      for (const mark of marks) mark.src = src;
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) favicon.href = src;
    };
    probe.src = src;
  };

  for (const mark of marks) {
    mark.addEventListener('error', () => tryFrom(1), { once: true });
    // Covers an image that already failed before this script ran.
    if (mark.complete && mark.naturalWidth === 0) tryFrom(1);
  }
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
    const message = t(node.dataset.whatsapp || 'cta.whatsappMessage');
    node.href = `https://wa.me/${site.whatsapp.number}?text=${encodeURIComponent(message)}`;
  }
}

/* -- order -----------------------------------------------------------------
 *
 * Restless has no ordering system, and building one would mean payments,
 * accounts and a monthly bill. This does the useful 90%: the visitor picks
 * items, and the WhatsApp button composes the order as a message they send
 * themselves. Nothing is transmitted anywhere until they hit send.
 *
 * The basket lives in their own browser and survives navigation between pages.
 * Items are stored with their name and price rather than a pointer into the
 * menu, so a later menu edit can never silently rewrite someone's basket. */

const money = (n) =>
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2 }).format(n);

function loadOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
    if (Array.isArray(raw)) {
      for (const line of raw) {
        if (line?.key && line.qty > 0) state.order.set(line.key, line);
      }
    }
  } catch { /* unreadable or unavailable — start empty */ }
}

function saveOrder() {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify([...state.order.values()]));
  } catch { /* private mode — the basket just won't outlive the page */ }
}

const orderCount = () => [...state.order.values()].reduce((n, l) => n + l.qty, 0);
const orderTotal = () => [...state.order.values()].reduce((n, l) => n + l.qty * l.price, 0);

function changeQty(key, name, price, delta) {
  const line = state.order.get(key) ?? { key, name, price, qty: 0 };
  line.qty += delta;
  line.name = name;
  line.price = price;

  if (line.qty > 0) state.order.set(key, line);
  else state.order.delete(key);

  saveOrder();
  renderOrder();
}

function orderMessage(currency) {
  const lines = [...state.order.values()]
    .map((l) => `• ${l.qty}× ${l.name} — ${money(l.qty * l.price)} ${currency}`);

  return [
    t('order.msgIntro'),
    '',
    ...lines,
    '',
    `${t('order.subtotal')}: ${money(orderTotal())} ${currency}`,
    t('order.beforeTax')
  ].join('\n');
}

/* Quantity control shown on every priced item. */
function orderControl(key, name, price) {
  const wrap = el('div', 'qty');
  const line = state.order.get(key);
  const qty = line?.qty ?? 0;

  const button = (label, delta, aria) => {
    const b = el('button', 'qty-btn', label);
    b.type = 'button';
    b.setAttribute('aria-label', t(aria, { item: name }));
    b.addEventListener('click', () => changeQty(key, name, price, delta));
    return b;
  };

  if (qty > 0) {
    wrap.append(button('−', -1, 'order.decrease'));
    const count = el('span', 'qty-count', String(qty));
    count.setAttribute('aria-live', 'polite');
    wrap.append(count);
  }
  wrap.append(button('+', +1, 'order.add'));
  wrap.dataset.active = String(qty > 0);

  // Carried on the element so a quantity change can rebuild just this control
  // in place, instead of re-rendering all 254 rows and losing scroll position.
  wrap.dataset.orderKey = key;
  wrap.dataset.orderName = name;
  wrap.dataset.orderPrice = String(price);
  return wrap;
}

/* The bar is built in script rather than markup so it exists on every page —
 * a basket started on the menu can still be sent from Visit. */
function orderBar() {
  let bar = document.getElementById('order-bar');
  if (bar) return bar;

  bar = el('div', 'order-bar');
  bar.id = 'order-bar';
  bar.hidden = true;

  const panel = el('div', 'order-panel');
  panel.id = 'order-panel';
  panel.hidden = true;

  const summary = el('button', 'order-summary');
  summary.type = 'button';
  summary.setAttribute('aria-controls', 'order-panel');
  summary.setAttribute('aria-expanded', 'false');
  summary.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    summary.setAttribute('aria-expanded', String(open));
    renderOrder();
  });

  const send = el('a', 'btn btn--primary order-send');
  send.dataset.whatsapp = '';

  const row = el('div', 'order-row');
  row.append(summary, send);
  bar.append(panel, row);
  document.body.append(bar);
  return bar;
}

function renderOrder() {
  // Rebuild the controls on screen so their counts match the basket.
  for (const node of [...document.querySelectorAll('.qty[data-order-key]')]) {
    const { orderKey, orderName, orderPrice } = node.dataset;
    node.replaceWith(orderControl(orderKey, orderName, Number(orderPrice)));
  }

  const bar = orderBar();
  const count = orderCount();
  const currency = state.menu?.currency ?? state.site?.currency ?? 'EGP';

  bar.hidden = count === 0;
  document.body.classList.toggle('has-order', count > 0);
  if (count === 0) {
    bar.querySelector('.order-panel').hidden = true;
    bar.querySelector('.order-summary').setAttribute('aria-expanded', 'false');
    return;
  }

  const summary = bar.querySelector('.order-summary');
  summary.replaceChildren(
    el('span', 'order-count', t(count === 1 ? 'order.itemOne' : 'order.itemMany', { n: count })),
    el('span', 'order-total', `${money(orderTotal())} ${currency}`)
  );

  const panel = bar.querySelector('.order-panel');
  if (!panel.hidden) {
    const list = el('ul', 'order-lines');
    for (const line of state.order.values()) {
      const li = el('li');
      li.append(el('span', 'order-line-name', line.name));
      li.append(el('span', 'order-line-sum', `${money(line.qty * line.price)} ${currency}`));
      li.append(orderControl(line.key, line.name, line.price));
      list.append(li);
    }

    const clear = el('button', 'order-clear', t('order.clear'));
    clear.type = 'button';
    clear.addEventListener('click', () => {
      state.order.clear();
      saveOrder();
      renderOrder();
      if (state.menu) renderAll();
    });

    panel.replaceChildren(
      el('p', 'order-title', t('order.title')),
      list,
      el('p', 'order-note', t('order.beforeTax')),
      clear
    );
  }

  const send = bar.querySelector('.order-send');
  send.textContent = t('order.send');
  if (state.site?.whatsapp?.enabled) {
    send.href = `https://wa.me/${state.site.whatsapp.number}?text=${encodeURIComponent(orderMessage(currency))}`;
    send.removeAttribute('aria-disabled');
  } else {
    send.removeAttribute('href');
    send.setAttribute('aria-disabled', 'true');
  }
}

/* -- menu ----------------------------------------------------------------- */

function buildItem(item, menu, site, key) {
  const li = el('li', 'menu-item');
  const line = el('div', 'menu-item-line');

  const name = el('span', 'menu-item-name', field(item, 'name'));
  if (item.badge) name.append(el('span', 'badge', field(item, 'badge')));
  line.append(name);

  const orderable = site.showPrices && item.price != null;

  if (orderable) {
    line.append(el('span', 'menu-leader'));
    line.append(el('span', 'menu-price', `${money(item.price)} ${menu.currency}`));
    line.append(orderControl(key, field(item, 'name'), item.price));
  }

  li.append(line);

  const desc = field(item, 'description');
  if (desc) li.append(el('p', 'desc', desc));
  return li;
}

function buildSection(section, menu, site, menuId) {
  const wrap = el('section', 'menu-section');
  wrap.id = section.id;

  wrap.append(el('h2', 'script', field(section, 'name')));
  wrap.append(el('hr', 'rule'));

  const note = field(section, 'note');
  if (note) wrap.append(el('p', 'note', note));

  // Names repeat across sections at different prices — "Eggs & Cheese" is 149.99
  // as a wrap and 179.99 as a sandwich — so the basket key has to be positional.
  const addList = (items, groupIdx) => {
    const list = el('ul', 'menu-items');
    items.forEach((item, i) => {
      const key = `${menuId}/${section.id}/${groupIdx}${i}`;
      list.append(buildItem(item, menu, site, key));
    });
    wrap.append(list);
  };

  if (section.groups?.length) {
    section.groups.forEach((group, gi) => {
      wrap.append(el('h3', 'menu-group', field(group, 'name')));
      addList(group.items, `g${gi}-`);
    });
  } else if (section.items?.length) {
    addList(section.items, '');
  } else {
    wrap.append(el('p', 'empty', t('menu.empty')));
  }

  if (section.addons?.length) {
    const list = el('ul', 'addons');
    for (const addon of section.addons) {
      const li = el('li');
      li.append(document.createTextNode(field(addon, 'name') + ' '));
      li.append(el('b', null, `+${addon.price.toFixed(2)} ${menu.currency}`));
      list.append(li);
    }
    wrap.append(list);
  }

  return wrap;
}

function renderMenu(root, menu, site, keepIndex = 0) {
  const tabsHost = document.querySelector('[data-menu-tabs]');
  const jumpHost = document.querySelector('[data-menu-jump]');
  const noteHost = document.querySelector('[data-menu-note]');

  const show = (index) => {
    const active = menu.menus[index];
    root.dataset.activeMenu = String(index);

    for (const [i, button] of [...(tabsHost?.children ?? [])].entries()) {
      button.setAttribute('aria-selected', String(i === index));
    }

    if (noteHost) {
      const note = field(active, 'note');
      noteHost.textContent = note || '';
      noteHost.hidden = !note;
    }

    if (jumpHost) {
      jumpHost.replaceChildren(...active.sections.map((section) => {
        const li = el('li');
        const a = el('a', null, field(section, 'name'));
        a.href = `#${section.id}`;
        li.append(a);
        return li;
      }));
    }

    root.replaceChildren(...active.sections.map((s) => buildSection(s, menu, site, active.id)));

    const notice = field(menu, 'notice');
    if (notice) root.append(el('p', 'menu-legal', notice));
  };

  if (tabsHost) {
    tabsHost.replaceChildren(...menu.menus.map((sub, i) => {
      const button = el('button', null, field(sub, 'name'));
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => show(i));
      return button;
    }));
  }

  show(keepIndex);
}

/* -- render --------------------------------------------------------------- */

function renderAll() {
  const { site, menu } = state;

  for (const node of document.querySelectorAll('[data-status]')) renderStatus(node, site);
  for (const node of document.querySelectorAll('[data-hours-table]')) renderHours(node, site);
  wireContacts(site);

  const menuRoot = document.querySelector('[data-menu]');
  if (menuRoot && menu) {
    renderMenu(menuRoot, menu, site, Number(menuRoot.dataset.activeMenu || 0));
  }

  renderOrder();
}

/* -- boot ----------------------------------------------------------------- */

(async function init() {
  try {
    [state.site, state.i18n] = await Promise.all([
      loadJSON(`${base()}data/site.json`),
      loadJSON(`${base()}data/i18n.json`)
    ]);
  } catch (err) {
    console.error('Could not load site data.', err);
    for (const node of document.querySelectorAll('[data-status]')) node.hidden = true;
    return;
  }

  state.lang = initialLang(state.i18n);
  loadOrder();
  applyLanguage();

  for (const node of document.querySelectorAll('[data-lang-toggle]')) {
    node.hidden = false;
    node.addEventListener('click', () => setLanguage(state.lang === 'en' ? 'ar' : 'en'));
  }

  guardBrandMark(state.site);

  if (document.querySelector('[data-menu]')) {
    try {
      state.menu = await loadJSON(`${base()}data/menu.json`);
    } catch (err) {
      console.error('Could not load the menu.', err);
      document.querySelector('[data-menu]').replaceChildren(
        el('p', 'empty', t('menu.failed', { phone: state.site.phones[0] })));
    }
  }

  renderAll();
})();
