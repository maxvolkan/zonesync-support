const DOT = '⠿';

// Per-char delay uses ease-IN so the visual reveal reads as ease-OUT.
function revealSchedule(n) {
  const total = 80 + Math.pow(n, 0.5) * 70;
  const easeInQuart = t => t * t * t * t;
  const delays = [];
  for (let i = 0; i < n; i++) {
    delays.push(easeInQuart(n === 1 ? 1 : i / (n - 1)) * total);
  }
  return { delays, total };
}

document.querySelectorAll('[data-reveal]').forEach(el => {
  const target = el.textContent;
  el.textContent = '';
  for (const ch of target) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.textContent = ch;
    if (ch === ' ') span.dataset.skip = '1';
    el.appendChild(span);
  }
  el.classList.add('is-revealed');

  let pinging = false;
  el.addEventListener('mouseenter', () => {
    if (pinging) return;
    pinging = true;
    const spans = el.querySelectorAll('.ch');
    el.classList.remove('is-revealed');
    setTimeout(() => {
      const { delays, total } = revealSchedule(spans.length);
      spans.forEach((s, i) => {
        if (s.dataset.skip) return;
        s.style.setProperty('--d', delays[i] + 'ms');
      });
      el.classList.add('is-revealed');
      setTimeout(() => { pinging = false; }, total + 220);
    }, 110);
  });
});

const SPIN_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
const spinners = Array.from(document.querySelectorAll('.spinner')).map(el => ({
  el, phase: parseInt(el.dataset.phase || '0', 10),
}));
let spinTick = 0;
let spinLast = 0;
function spinLoop(t) {
  if (t - spinLast > 120) {
    spinLast = t;
    spinTick++;
    for (const s of spinners) {
      s.el.textContent = SPIN_FRAMES[(spinTick + s.phase) % SPIN_FRAMES.length];
    }
  }
  requestAnimationFrame(spinLoop);
}
requestAnimationFrame(spinLoop);

let pendingMove = null;
addEventListener('pointermove', e => {
  pendingMove = e;
  if (pendingMove._scheduled) return;
  pendingMove._scheduled = true;
  requestAnimationFrame(() => {
    const ev = pendingMove;
    pendingMove = null;
    document.documentElement.style.setProperty('--mx', ev.clientX + 'px');
    document.documentElement.style.setProperty('--my', ev.clientY + 'px');
    const lat = ((ev.clientY / innerHeight) * 180 - 90).toFixed(4);
    const lon = ((ev.clientX / innerWidth) * 360 - 180).toFixed(4);
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    railLeft.textContent = `${ns} ${Math.abs(lat).toFixed(4)} · ${ew} ${Math.abs(lon).toFixed(4)}`;
  });
});
const railLeft = document.getElementById('rail-left');
const railRight = document.getElementById('rail-right');

// Track is duplicated so the -50% translate loops seamlessly.
const ZONES = [
  'TYO +09', 'SIN +08', 'DEL +05:30', 'IST +03', 'CET +01', 'UTC ±00',
  'NYC −05', 'CHI −06', 'DEN −07', 'LAX −08', 'HNL −10', 'SYD +11',
  'AKL +13', 'GMT ±00', 'MOW +03', 'DXB +04', 'BKK +07', 'HKG +08'
];
const tickerEl = document.getElementById('ticker');
const tickerHTML = ZONES.map(z => `<span>${z}</span>`).join('');
tickerEl.innerHTML = tickerHTML + tickerHTML;

const clock = document.getElementById('clock');
function tick() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const off = -d.getTimezoneOffset() / 60;
  const sign = off >= 0 ? '+' : '−';
  const str = `${hh}:${mm}:${ss} UTC${sign}${Math.abs(off)}`;
  clock.textContent = str;
}
setInterval(tick, 1000);
tick();
