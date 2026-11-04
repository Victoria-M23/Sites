/* =========================================================
   UTBIOME site script
   1. Page switching (header links)
   2. DNA double helix drawn on a canvas, twisting with scroll
   3. Scroll animation: title flies up, subteam bubbles appear
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Page switching ---------- */
const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".site-nav a");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

function showPage() {
  const name = (location.hash || "#home").slice(1);
  const target = document.querySelector(`.page[data-page="${name}"]`) ? name : "home";

  pages.forEach(p => (p.hidden = p.dataset.page !== target));
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === target));
  document.body.classList.toggle("on-home", target === "home");

  window.scrollTo(0, 0);
  closeMenu();
}

function closeMenu() {
  nav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", showPage);
showPage();

/* ---------- 2. DNA helix ---------- */
const canvas = document.getElementById("dna");
const ctx = canvas.getContext("2d");
let W = 0, H = 0;

// Base-pair colours (A–T and C–G pairs) in the UTBIOME palette, picked in a fixed pattern
const PAIRS = [
  ["#3375c6", "#132a63"],
  ["#6bb6f9", "#48648c"],
  ["#132a63", "#3375c6"],
  ["#48648c", "#6bb6f9"],
];
const pairFor = i => PAIRS[(i * 7 + (i >> 2)) % PAIRS.length];

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawDNA(phase) {
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const amp = W * 0.32;                 // how wide the helix swings
  const k = (Math.PI * 2) / 280;        // one full turn every 280px
  const rungGap = 18;                   // spacing of base pairs
  const step = 4;                       // strand segment length

  // A point on strand s (0 or 1) at height y
  const point = (y, s) => {
    const a = y * k + phase + s * Math.PI;
    return { x: cx + amp * Math.sin(a), depth: Math.cos(a) }; // depth > 0 = towards viewer
  };

  // Draw strand segments that are either behind (front=false) or in front (front=true)
  const drawStrands = front => {
    for (let s = 0; s < 2; s++) {
      for (let y = -step; y < H + step; y += step) {
        const p1 = point(y, s), p2 = point(y + step, s);
        const d = (p1.depth + p2.depth) / 2;
        if ((d >= 0) !== front) continue;
        const t = (d + 1) / 2;          // 0 = far, 1 = near
        ctx.strokeStyle = s === 0
          ? `rgba(19, 42, 99, ${0.25 + 0.75 * t})`     // navy strand
          : `rgba(116, 138, 166, ${0.3 + 0.7 * t})`;   // steel-blue strand
        ctx.lineWidth = 2 + 4 * t;
        ctx.beginPath();
        ctx.moveTo(p1.x, y);
        ctx.lineTo(p2.x, y + step);
        ctx.stroke();
      }
    }
  };

  // Base pairs (rungs) connect the two strands
  const drawRungs = () => {
    ctx.lineCap = "round";
    // offset so rungs slide smoothly along as the helix twists
    const offset = ((phase / k) % rungGap + rungGap) % rungGap;
    for (let y = -offset, i = 0; y < H + rungGap; y += rungGap, i++) {
      const a = point(y, 0), b = point(y, 1);
      const mid = (a.x + b.x) / 2;
      const t = 1 - Math.abs(a.depth) * 0.55;   // rungs fade when seen edge-on
      const [c1, c2] = pairFor(i + Math.floor(phase / (k * rungGap)));
      ctx.globalAlpha = 0.35 + 0.5 * t;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c1;
      ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(mid, y); ctx.stroke();
      ctx.strokeStyle = c2;
      ctx.beginPath(); ctx.moveTo(mid, y); ctx.lineTo(b.x, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  ctx.lineCap = "round";
  drawStrands(false);
  drawRungs();
  drawStrands(true);

  // Soft glowing nodes where each strand is closest to the viewer
  for (let s = 0; s < 2; s++) {
    for (let y = 0; y < H; y += rungGap) {
      const p = point(y, s);
      if (p.depth < 0.85) continue;
      ctx.fillStyle = s === 0 ? "rgba(19,42,99,0.95)" : "rgba(51,117,198,0.95)";
      ctx.beginPath();
      ctx.arc(p.x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ---------- 3. Scroll animation ---------- */
const track = document.querySelector(".scroll-track");
const stage = document.querySelector(".stage");
const hero = document.getElementById("hero");
const bubbleBox = document.getElementById("bubbles");
const bubbleHeading = document.querySelector(".bubbles-heading");
const bubbles = [...document.querySelectorAll(".bubble")];

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);

// 0 at the top of the home page, 1 once the animation has fully played
function scrollProgress() {
  const range = track.offsetHeight - stage.offsetHeight;
  return range > 0 ? clamp(window.scrollY / range) : 0;
}

function updateScene(p, time) {
  // Title flies up and fades out during the first ~30% of the scroll
  const tp = easeOut(clamp(p / 0.3));
  hero.style.transform = `translateY(${-tp * stage.offsetHeight * 0.85}px)`;
  hero.style.opacity = String(1 - clamp(tp * 1.3));

  // "Our Subteams" heading fades in, then the bubbles pop in one after another
  const hp = easeOut(clamp((p - 0.18) / 0.15));
  bubbleHeading.style.opacity = String(hp);
  bubbleHeading.style.transform = `translateY(${(1 - hp) * 20}px)`;

  bubbles.forEach((b, i) => {
    const bp = easeOut(clamp((p - 0.22 - i * 0.07) / 0.22));
    const bob = reduceMotion ? 0 : Math.sin(time / 900 + i * 1.3) * 6 * bp;
    b.style.opacity = String(bp);
    b.style.transform = `translateY(${(1 - bp) * 60 + bob}px) scale(${0.4 + 0.6 * bp})`;
  });
  bubbleBox.classList.toggle("live", p > 0.4);
}

/* ---------- Animation loop ---------- */
function frame(time) {
  if (document.body.classList.contains("on-home")) {
    const p = scrollProgress();
    // Twist comes from scrolling, plus a slow idle rotation so it always feels alive
    const phase = window.scrollY * 0.012 + (reduceMotion ? 0 : time * 0.0004);
    drawDNA(phase);
    updateScene(p, time);
  }
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
requestAnimationFrame(frame);
