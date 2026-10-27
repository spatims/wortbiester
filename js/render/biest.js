// Vertragspräzisierung: species ist die numerische Art-ID. Koordinaten sind CSS-Pixel;
// drawBiest löscht nichts und erhält den Kontext. animateBiest besitzt nur seine
// eigene Schleife; stop() ist wiederholbar. html.ruhe und reduzierte Bewegung
// zeichnen t=0, Änderungen daran werden auch nach dem Start berücksichtigt.
const INK = '#101725';
const GLOW = '#ff9f43';

function shade(color, amount) {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color ?? '');
  let s = hex?.[1] ?? '6fcf6a';
  if (s.length === 3) s = [...s].map(c => c + c).join('');
  return '#' + [0, 2, 4].map(i => {
    const n = parseInt(s.slice(i, i + 2), 16);
    return Math.round(amount > 0 ? n + (255 - n) * amount : n * (1 + amount)).toString(16).padStart(2, '0');
  }).join('');
}

export function drawBiest(ctx, biest, { mood = 'ruhig', t = 0, size = 96, x = 0, y = 0 } = {}) {
  if (!(size > 0)) return;
  const species = biest.species ?? 0;
  const wild = biest.stage === 0 && mood !== 'ei';
  const egg = biest.stage === 1 || mood === 'ei';
  const base = wild ? '#202b3d' : biest.skin === 'nacht' ? shade(biest.color, -0.55) : shade(biest.color, 0);
  const light = wild ? base : shade(base, 0.32);
  const dark = wild ? base : shade(base, -0.26);
  const rare = biest.rarity === 'episch' ? '#ffd166' : biest.rarity === 'selten' ? '#dce6f4' : null;
  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.scale(size / 96, size / 96);
    ctx.beginPath(); ctx.rect(0, 0, 96, 96); ctx.clip();
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const oval = (cx, cy, rx, ry, color = base, stroke = true) => {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      if (stroke) { ctx.strokeStyle = INK; ctx.stroke(); }
    };
    const poly = (points, color = base, stroke = true) => {
      ctx.beginPath(); ctx.moveTo(...points[0]);
      for (const p of points.slice(1)) ctx.lineTo(...p);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      if (stroke) { ctx.strokeStyle = INK; ctx.stroke(); }
    };
    const line = (points, color = INK, width = 3) => {
      ctx.beginPath(); ctx.moveTo(...points[0]);
      for (const p of points.slice(1)) ctx.lineTo(...p);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.lineWidth = 3;
    };
    const star = (cx, cy, r, color) => poly([[cx, cy-r], [cx+r*.3, cy-r*.3], [cx+r, cy], [cx+r*.3, cy+r*.3], [cx, cy+r], [cx-r*.3, cy+r*.3], [cx-r, cy], [cx-r*.3, cy-r*.3]], color, false);
    if (rare && !wild) {
      if (biest.rarity === 'episch') {
        oval(48, 51, 39, 39, '#ffd16618', false);
        oval(48, 51, 34, 34, '#ffd16618', false);
      }
      // Rand folgt derselben Silhouette: breite Kontur hinter den Grundformen.
    }
    const hop = mood === 'jubel' ? -9 * Math.abs(Math.sin(Math.min(Math.max(t, 0), .6) / .6 * Math.PI * 2)) : 0;
    ctx.translate(mood === 'ducken' ? Math.sin(t * 48) * .7 : 0, hop);
    const bounce = mood === 'hungrig' ? Math.sin(t * 3) * 1.4 : Math.sin(t * 2) * .8;
    ctx.translate(48, 80 + bounce);
    ctx.scale(biest.stage === 2 && !egg ? .72 : 1, mood === 'ducken' ? .76 : 1);
    ctx.translate(-48, -80);
    // Alle Körperformen werden für Seltenheitsrand, Füllung und Muster erneut aufgebaut.
    const bodyPath = () => {
      ctx.beginPath();
      if (egg) {
        ctx.moveTo(48, 23); ctx.bezierCurveTo(66, 23, 77, 61, 69, 74);
        ctx.bezierCurveTo(61, 87, 32, 87, 25, 74); ctx.bezierCurveTo(18, 60, 31, 23, 48, 23);
      } else {
        switch (species) {
          case 0: ctx.ellipse(48, 59, 26, 18, 0, 0, Math.PI*2); break;
          case 1: ctx.moveTo(19, 30); ctx.lineTo(34, 40); ctx.lineTo(48, 35); ctx.lineTo(62, 40); ctx.lineTo(77, 30); ctx.lineTo(69, 69); ctx.quadraticCurveTo(48, 88, 27, 69); break;
          case 2: ctx.moveTo(21, 76); ctx.bezierCurveTo(28, 55, 21, 27, 48, 34); ctx.bezierCurveTo(64, 35, 64, 72, 78, 76); ctx.quadraticCurveTo(48, 89, 21, 76); break;
          case 3: ctx.moveTo(27, 42); ctx.lineTo(69, 42); ctx.lineTo(73, 70); ctx.quadraticCurveTo(48, 88, 23, 70); break;
          case 4: ctx.moveTo(24, 43); ctx.quadraticCurveTo(45, 31, 60, 44); ctx.lineTo(80, 54); ctx.lineTo(75, 72); ctx.lineTo(33, 78); ctx.closePath(); break;
          case 5: ctx.ellipse(48, 55, 23, 26, 0, 0, Math.PI*2); break;
          case 6: for (let i=0;i<24;i++) { const a=i*Math.PI/12; const r=i%2 ? 24 : 34; const px=48+Math.cos(a)*r, py=54+Math.sin(a)*r*.85; if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); } break;
          case 7: for(let i=0;i<8;i++) { const a=i*Math.PI/4; ctx.arc(48+Math.cos(a)*18, 54+Math.sin(a)*16, 13, a-Math.PI/2, a+Math.PI/2); } break;
          case 8: ctx.moveTo(26, 37); ctx.lineTo(65, 37); ctx.lineTo(75, 73); ctx.lineTo(58, 82); ctx.lineTo(26, 77); break;
          case 9: ctx.moveTo(48, 24); ctx.lineTo(69, 52); ctx.lineTo(48, 82); ctx.lineTo(27, 52); break;
          case 10: ctx.ellipse(48, 57, 21, 26, 0, 0, Math.PI*2); break;
          default: ctx.moveTo(30, 43); ctx.lineTo(64, 43); ctx.lineTo(72, 71); ctx.quadraticCurveTo(48, 88, 24, 71);
        }
      }
      ctx.closePath();
    };
    if (!egg) {
      // Gliedmaßen sind Teil der Silhouette, auch im Wildzustand.
      if (species === 0) for (const side of [-1, 1]) for (let i=0;i<3;i++) line([[48+side*20, 49+i*9], [48+side*34, 46+i*12], [48+side*37, 53+i*12]], base, 6);
      if (species === 1) for (const s of [-1,1]) poly([[48+s*17,48],[48+s*43,35],[48+s*36,65],[48+s*20,70]], dark);
      if (species === 3) for (const s of [-1,1]) poly([[48+s*12,45],[48+s*26,19],[48+s*24,47]], light);
      if (species === 5) { line([[35,42],[30,24]],base,6); line([[61,42],[66,24]],base,6); oval(30,24,7,7,light); oval(66,24,7,7,light); }
      if (species === 10) { oval(23,42,14,9,light); oval(73,42,14,9,light); line([[40,35],[35,22]],base); line([[56,35],[61,22]],base); }
      if (species === 11) { poly([[29,47],[21,14],[43,42]],light); poly([[54,42],[76,23],[66,53]],light); poly([[67,69],[83,56],[79,78],[62,78]],dark); }
      if (![0,2,6,9].includes(species)) { oval(34,79,10,5,dark); oval(61,79,10,5,dark); }
    }
    bodyPath();
    if (rare && !wild) { ctx.strokeStyle=rare; ctx.lineWidth=8; ctx.stroke(); ctx.lineWidth=3; }
    ctx.fillStyle=base; ctx.fill(); ctx.strokeStyle=INK; ctx.stroke();
    ctx.save();
    bodyPath(); ctx.clip();
    if (egg || (!wild && biest.skin)) {
      if (biest.skin === 'streifen' && !egg) {
        for(let i=0;i<5;i++) line([[18+i*13,30],[35+i*13,88]],dark,6);
      } else {
        const count = egg ? 5 + species % 4 : 8;
        for(let i=0;i<count;i++) {
          const px=28+((i*19+species*7)%42), py=38+((i*13+species*5)%37);
          if (egg && species%3===1) poly([[px,py-4],[px+4,py+3],[px-4,py+3]],dark,false);
          else if (egg && species%3===2) line([[px-3,py-2],[px,py+2],[px+4,py-2]],dark,2);
          else oval(px,py,biest.skin==='flecken'?8:3,biest.skin==='flecken'?5:3,dark,false);
        }
      }
    }
    ctx.restore();
    if (!egg) {
      if (biest.stage>=4) { poly([[28,69],[66,69],[65,76],[30,76]],GLOW); poly([[60,73],[74,78],[65,84]],GLOW); }
      const blink = t%4 > 3.82;
      const eyeY = species===4 ? 50 : 51;
      for (const ex of [39,57]) {
        if (mood==='jubel' || (!wild && blink)) {
          ctx.beginPath(); ctx.arc(ex,eyeY+2,6,Math.PI,Math.PI*2); ctx.strokeStyle=INK; ctx.stroke();
        } else {
          oval(ex,eyeY,mood==='ducken'?4:8,mood==='ducken'?3:10,wild?'#ffe6a0':'#f3f5f9',!wild);
          if(!wild) { oval(ex+1,eyeY+1,3.5,5,INK,false); oval(ex+2,eyeY-2,1.8,2,'#fff',false); }
        }
      }
      if(!wild) {
        if(mood==='jubel') { oval(48,65,7,8,INK,false); oval(48,69,4,2,GLOW,false); }
        else { ctx.beginPath(); ctx.arc(48,60,7,.15,Math.PI-.15); ctx.strokeStyle=INK; ctx.stroke(); }
        if(species===4 || species===8) for(const ex of [42,54]) poly([[ex-3,64],[ex+3,64],[ex,70]],'#f3f5f9',false);
      }
      if(biest.stage===2) poly([[30,35],[33,25],[62,25],[67,36],[57,32],[50,38],[42,32]],light);
      if(!wild && biest.hat) {
        switch(biest.hat) {
          case 'muetze': oval(48,32,20,12,GLOW); line([[28,37],[68,37]],light,6); oval(48,18,5,5,light); break;
          case 'krone': poly([[30,37],[27,20],[39,29],[48,17],[57,29],[69,20],[66,37]],'#ffd166'); break;
          case 'hut': poly([[33,34],[36,17],[60,17],[63,34]],dark); line([[25,36],[71,36]],INK,5); line([[35,30],[61,30]],GLOW,4); break;
          case 'brille': for(const ex of [39,57]) { ctx.beginPath();ctx.arc(ex,51,10,0,Math.PI*2);ctx.strokeStyle=GLOW;ctx.stroke(); } line([[48,50],[48,50]],GLOW,3); break;
          case 'schleife': poly([[48,31],[29,21],[29,39]],GLOW); poly([[48,31],[67,21],[67,39]],GLOW); oval(48,31,4,5,light); break;
          case 'helm': oval(48,30,22,14,'#aeb8cc'); poly([[25,31],[71,31],[71,37],[25,37]],'#aeb8cc'); line([[48,16],[48,31]],GLOW,5); break;
        }
      }
    }
    if (biest.stage===5 && !egg) for(let i=0;i<3;i++) star(14+i*33,20+(i%2)*54,3.5+Math.sin(t*3+i)*1.3,'#ffd166');
    if(mood==='hungrig' && !egg) {
      oval(74,19,17,11,'#f3f5f9'); poly([[65,25],[62,34],[73,28]],'#f3f5f9',false);
      for(let i=0;i<3;i++) oval(68+i*6,19,1.5,1.5,INK,false);
    }
  } finally { ctx.restore(); }
}

export function biestCanvas(biest, opts = {}) {
  const canvas = document.createElement('canvas');
  const size = opts.size ?? 96;
  const ratio = globalThis.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio); canvas.height = Math.round(size * ratio);
  canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', biest.name ? `Biest: ${biest.name}` : 'Biest');
  const ctx = canvas.getContext('2d');
  if (ctx) { ctx.scale(ratio, ratio); drawBiest(ctx, biest, opts); }
  return canvas;
}

export function animateBiest(canvas, biest, getMood = () => 'ruhig') {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const quiet = () => document.documentElement.classList.contains('ruhe') || reduced?.matches;
  let frame = null, stopped = false, start = null, lastMood = null;
  function paint(now) {
    frame = null;
    if(stopped) return;
    const mood = getMood();
    if(start === null || mood !== lastMood) { start = now; lastMood = mood; }
    ctx.save();
    try {
      ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);
      const size = parseFloat(canvas.style.width) || canvas.width / (globalThis.devicePixelRatio || 1);
      ctx.scale(canvas.width / size, canvas.height / size);
      drawBiest(ctx, biest, { mood, t: quiet() ? 0 : (now-start)/1000, size });
    } finally { ctx.restore(); }
    if(!quiet()) frame = requestAnimationFrame(paint);
  }
  function refresh() {
    if(frame !== null) cancelAnimationFrame(frame);
    frame = null;
    paint(performance.now());
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  reduced?.addEventListener('change', refresh);
  refresh();
  return () => {
    if(stopped) return;
    stopped = true;
    if(frame !== null) cancelAnimationFrame(frame);
    observer.disconnect(); reduced?.removeEventListener('change', refresh);
  };
}
