// Gemeinsame Bausteine der Oberfläche. Nutzertext nur über textContent;
// escape() liegt für den Fall bereit, dass doch eine Zeichenkette gebaut wird.
//
// setzeRevier steht nicht in der Auftragsliste, beide Startbildschirme brauchen es:
// die Revierfarbe der aktiven Liste wird zur CSS-Variable --revier (nur #rrggbb).

export function escape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = String(value);
      else if (key === 'dataset' && typeof value === 'object') {
        for (const [name, inhalt] of Object.entries(value)) node.dataset[name] = inhalt == null ? '' : String(inhalt);
      } else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'aria' && typeof value === 'object') {
        for (const [name, inhalt] of Object.entries(value)) node.setAttribute('aria-' + name, String(inhalt));
      } else if (typeof value === 'function' && key.startsWith('on')) {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    }
  }
  anhaengen(node, children);
  return node;
}

function anhaengen(node, children) {
  const liste = Array.isArray(children) ? children : [children];
  for (const kind of liste.flat(Infinity)) {
    if (kind == null || kind === false) continue;
    node.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
}

export function knopf(label, { art = 'sekundaer', unterzeile, onClick, className } = {}) {
  const button = el('button', {
    type: 'button',
    class: ['knopf', art === 'primaer' ? 'primaer' : 'sekundaer', className].filter(Boolean).join(' '),
  }, [
    el('span', { class: 'knopf-text', text: label }),
    unterzeile ? el('small', { text: unterzeile }) : null,
  ]);
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function block(text, { onClick, className } = {}) {
  const button = el('button', {
    type: 'button',
    class: ['block', className].filter(Boolean).join(' '),
    text: text ?? '',
  });
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function schilde(anzahl, max, { bricht = -1, neues = -1 } = {}) {
  const oben = Math.max(0, max | 0);
  const voll = Math.max(0, Math.min(oben, anzahl | 0));
  const wrap = el('div', { class: 'schilde', aria: { label: `${voll} von ${oben} Schilden` } });
  for (let i = 0; i < oben; i++) {
    const gebrochen = i === bricht;
    const istVoll = i < voll || gebrochen;
    wrap.append(el('span', {
      class: ['schild', istVoll ? 'voll' : 'leer', gebrochen ? 'bricht' : '', i === neues ? 'neu' : ''].filter(Boolean).join(' '),
    }));
  }
  return wrap;
}

export function route(punkte) {
  const wrap = el('ol', { class: 'route' });
  for (const punkt of punkte || []) {
    const art = punkt.kind === 'feuer' || punkt.kind === 'boss' ? punkt.kind : 'aufgabe';
    wrap.append(el('li', {
      class: ['route-punkt', art, punkt.done ? 'fertig' : '', punkt.current ? 'jetzt' : ''].filter(Boolean).join(' '),
    }));
  }
  return wrap;
}

export function flamme(combo, mult) {
  const n = Number(combo) || 0;
  const stufe = n <= 0 ? 'glut' : mult >= 3 ? 'gross' : mult >= 2 ? 'mittel' : 'klein';
  return el('div', {
    class: `flamme ${stufe}`,
    aria: { label: n > 0 ? `Kombo ${n}` : 'Keine Kombo' },
  }, [
    el('span', { class: 'flamme-form' }),
    n > 0 ? el('span', { class: 'zahl', text: String(n) }) : null,
  ]);
}

export function beutel(coins, eggs) {
  const muenzen = Math.max(0, coins | 0);
  const eier = Math.max(0, eggs | 0);
  return el('div', {
    class: 'beutel',
    dataset: { beutel: '1' },
    aria: { label: eier ? `${muenzen} Münzen, ${eier} Eier` : `${muenzen} Münzen` },
  }, [
    el('span', { class: 'beutel-form', aria: { hidden: 'true' } }),
    el('span', { class: 'zahl', text: String(muenzen) }),
    eier ? el('span', { class: 'zahl eier-zahl', text: String(eier) }) : null,
  ]);
}

export function kopfzeile({
  shields, maxShields, route: punkte, combo, mult, coins, eggs, onPause,
  bricht = -1, neuesSchild = -1, routeLabel,
} = {}) {
  const zeile = el('div', { class: 'kopf-zeile' }, [
    schilde(shields, maxShields, { bricht, neues: neuesSchild }),
    route(punkte),
    el('div', { class: 'kopf-rechts' }, [
      flamme(combo, mult),
      beutel(coins, eggs),
      knopf('Pause', { art: 'sekundaer', className: 'pause', onClick: onPause }),
    ]),
  ]);
  if (routeLabel) zeile.querySelector('.route')?.setAttribute('aria-label', routeLabel);
  return el('header', { class: 'kopf' }, [zeile]);
}

const fliegend = new Set();

export function muenzflug(von, nach, n = 4) {
  if (!von || !nach || typeof document === 'undefined') return;
  if (document.documentElement.classList.contains('ruhe')) return;
  const menge = Math.min(6, Math.max(1, n | 0 || 1));
  const start = von.getBoundingClientRect();
  const ziel = nach.getBoundingClientRect();
  if (!start.width && !start.height) return;
  for (let i = 0; i < menge; i++) {
    const muenze = el('span', { class: 'muenze-flug' });
    const x = start.left + start.width / 2;
    const y = start.top + start.height / 2;
    muenze.style.left = `${x}px`;
    muenze.style.top = `${y}px`;
    document.body.append(muenze);
    fliegend.add(muenze);
    const dx = (ziel.left + ziel.width / 2) - x + (i - (menge - 1) / 2) * 10;
    const dy = (ziel.top + ziel.height / 2) - y;
    requestAnimationFrame(() => {
      muenze.style.transform = `translate(${dx}px, ${dy}px) scale(0.55)`;
      muenze.style.opacity = '0.15';
    });
    setTimeout(() => { muenze.remove(); fliegend.delete(muenze); }, 420);
  }
}

export function muenzenWeg() {
  for (const muenze of fliegend) muenze.remove();
  fliegend.clear();
}

export function modal(root, { titel, text, knoepfe = [] } = {}) {
  const overlay = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
  if (titel) overlay.setAttribute('aria-label', titel);
  const kasten = el('div', { class: 'karte modal-karte' }, [
    titel ? el('h2', { text: titel }) : null,
    text ? el('p', { text: text }) : null,
    el('div', { class: 'modal-aktionen' }, knoepfe.map((eintrag) => knopf(eintrag.label, eintrag))),
  ]);
  overlay.append(kasten);
  (root || document.body).append(overlay);
  return { schliessen: () => overlay.remove(), overlay };
}

export function setzeRevier(color) {
  const farbe = /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '#6fcf6a';
  document.documentElement.style.setProperty('--revier', farbe);
}
