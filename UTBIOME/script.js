/* =========================================================
   UTBIOME site script
   1. Page switching (header links)
   2. DNA double helix drawn on a canvas, twisting slowly with scroll
   3. Scroll animation: title flies up, the three goals appear,
      then the goals leave and the subteam atom appears
   4. Atom: subteam electrons orbit a nucleus; hovering one
      stops the orbit, enlarges it and shrinks the others
   5. Partners row: moved with the arrow buttons
   6. About Us mural: a circle of tiles that reveal photos on hover
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ---------- 1. Page switching ---------- */
const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".site-nav a");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
let pendingTarget = null;   // card to scroll to after an electron is clicked

function showPage() {
  const name = (location.hash || "#home").slice(1);
  const target = document.querySelector(`.page[data-page="${name}"]`) ? name : "home";

  pages.forEach(p => (p.hidden = p.dataset.page !== target));
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === target));
  document.body.classList.toggle("on-home", target === "home");

  window.scrollTo(0, 0);
  closeMenu();
  setHover(null);

  // Jump to the specific project / section the electron represents
  if (pendingTarget) {
    const el = document.getElementById(pendingTarget);
    pendingTarget = null;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        el.classList.remove("flash");
        void el.offsetWidth;            // restart the highlight animation
        el.classList.add("flash");
      });
    }
  }
}

function closeMenu() {
  nav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

/* ---------- 2. DNA helix ---------- */
const canvas = document.getElementById("dna");
const ctx = canvas.getContext("2d");
let W = 0, H = 0;

// Base-pair colours in the UTBIOME palette, picked in a fixed pattern
const PAIRS = [
  ["#ffffff", "#81acda"],
  ["#6484c2", "#d7e3f6"],
  ["#81acda", "#ffffff"],
  ["#d7e3f6", "#6484c2"],
];
const pairFor = i => PAIRS[((i * 7 + (i >> 2)) % PAIRS.length + PAIRS.length) % PAIRS.length];

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// endY: where the strand ends (canvas px). The two strands taper together there.
function drawDNA(phase, endY = Infinity) {
  ctx.clearRect(0, 0, W, H);

  // Everything scales with the canvas width so the helix fills its half of the screen
  const size = Math.max(W, 160);
  const cx = W / 2;
  const amp = size * 0.36;                    // how wide the helix swings
  const k = (Math.PI * 2) / (size * 1.5);     // one full turn every 1.5 × width
  const rungGap = Math.max(18, size / 15);    // spacing of base pairs
  const step = 4;                             // strand segment length
  const thick = size / 110;                   // strand thickness

  const taper = size * 0.7;                   // length over which the strands close up at the end
  const bottom = Math.min(H + step, endY);
  if (bottom <= 0) return;

  // A point on strand s (0 or 1) at height y
  const point = (y, s) => {
    const a = y * k + phase + s * Math.PI;
    const close = endY === Infinity ? 1 : easeOut(clamp((endY - y) / taper));
    return { x: cx + amp * close * Math.sin(a), depth: Math.cos(a) * close }; // depth > 0 = towards viewer
  };

  // Draw strand segments that are either behind (front=false) or in front (front=true)
  const drawStrands = front => {
    for (let s = 0; s < 2; s++) {
      for (let y = -step; y < bottom; y += step) {
        const y2 = Math.min(y + step, bottom);
        const p1 = point(y, s), p2 = point(y2, s);
        const d = (p1.depth + p2.depth) / 2;
        if ((d >= 0) !== front) continue;
        const t = (d + 1) / 2;                // 0 = far, 1 = near
        ctx.strokeStyle = s === 0
          ? `rgba(255, 255, 255, ${0.25 + 0.75 * t})`
          : `rgba(129, 172, 218, ${0.3 + 0.7 * t})`;
        ctx.lineWidth = thick * (1 + 2 * t);
        ctx.beginPath();
        ctx.moveTo(p1.x, y);
        ctx.lineTo(p2.x, y2);
        ctx.stroke();
      }
    }
  };

  // Base pairs (rungs) connect the two strands
  const drawRungs = () => {
    const shift = phase / k;                  // rungs move with the twist
    const offset = ((shift % rungGap) + rungGap) % rungGap;
    const base = Math.floor(shift / rungGap);
    for (let y = -offset, i = 0; y < Math.min(H + rungGap, endY - rungGap * 0.6); y += rungGap, i++) {
      const a = point(y, 0), b = point(y, 1);
      const mid = (a.x + b.x) / 2;
      const t = 1 - Math.abs(a.depth) * 0.55; // rungs fade when seen edge-on
      const [c1, c2] = pairFor(i + base);
      ctx.globalAlpha = 0.3 + 0.55 * t;
      ctx.lineWidth = thick * 1.3;
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

  // A small bead where the two strands meet marks the end of the helix
  if (endY < H + step) {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(129, 172, 218, 0.9)";
    ctx.shadowBlur = thick * 6;
    ctx.beginPath();
    ctx.arc(cx, endY, thick * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/* ---------- 3. Scroll animation ---------- */
const track = document.querySelector(".scroll-track");
const stage = document.querySelector(".stage");
const hero = document.getElementById("hero");
const goalsWrap = document.getElementById("goalsWrap");
const goalCards = [...goalsWrap.querySelectorAll(".goal")];
const atomWrap = document.getElementById("atomWrap");
const atom = document.getElementById("atom");
const electrons = [...atom.querySelectorAll(".electron")];

// 0 at the top of the home page, 1 once the animation has fully played
function scrollProgress() {
  const range = track.offsetHeight - stage.offsetHeight;
  return range > 0 ? clamp(window.scrollY / range) : 0;
}

let appear = 0;   // how far the atom has appeared (0–1)
let dnaExit = 0;  // 0 = full DNA strand, 1 = its end has scrolled off the top

function updateScene(p) {
  const h = stage.offsetHeight;

  // 1. Title flies up and fades out
  const tp = easeOut(clamp(p / 0.18));
  hero.style.transform = `translateY(${-tp * h * 0.85}px)`;
  hero.style.opacity = String(1 - clamp(tp * 1.3));

  // 2. Goals rise in one box at a time, hold, then fly up and out
  const gIn = clamp((p - 0.1) / 0.2);
  const gOut = easeOut(clamp((p - 0.5) / 0.14));

  // The DNA strand ends with the goals: its end rises up the screen as the goals leave
  dnaExit = clamp((p - 0.46) / 0.2);
  goalsWrap.style.opacity = String(Math.min(clamp(gIn * 3), 1 - gOut));
  goalsWrap.style.transform = `translateY(${-gOut * h * 0.6}px)`;
  goalsWrap.style.pointerEvents = gIn > 0.9 && gOut < 0.1 ? "auto" : "none";
  goalCards.forEach((card, i) => {
    const c = easeOut(clamp((gIn - i * 0.2) / 0.6));
    card.style.opacity = String(c);
    card.style.transform = `translateY(${(1 - c) * 60}px)`;
  });

  // 3. Atom grows in and the electrons spread out from the nucleus
  appear = easeOut(clamp((p - 0.6) / 0.22));
  atomWrap.style.opacity = String(appear);
  atom.style.transform = `scale(${0.6 + 0.4 * appear})`;
  atomWrap.classList.toggle("live", appear > 0.9);
  if (appear <= 0.9 && hovered !== null) setHover(null);
}

/* ---------- 4. Atom: orbiting electrons ---------- */
const ORBIT_RX = 0.80;                 // orbit size as a fraction of the atom's radius
const ORBIT_RY = 0.31;                 //   (matches the <ellipse> in the HTML)
const ORBIT_TILT = [0, 60, 120].map(d => (d * Math.PI) / 180);
const ORBIT_SPEED = [0.30, 0.36, 0.42];   // radians per second (slow, so labels stay readable)

let hovered = null;          // index of the enlarged electron, or null
let orbitTime = 0;
let lastPointer = "mouse";
const scales = electrons.map(() => 0.9);
const PER_ORBIT = [0, 1, 2].map(o => electrons.filter((_, i) => i % 3 === o).length || 1);

function setHover(i) {
  hovered = i;
  atom.classList.toggle("paused", i !== null);
  electrons.forEach((e, j) => {
    e.classList.toggle("active", j === i);
    e.classList.toggle("dim", i !== null && j !== i);
  });
}

function updateAtom(dt) {
  const paused = hovered !== null || reduceMotion;   // only hovering a subteam bubble pauses the orbit
  if (!paused) orbitTime += dt;

  const R = atom.offsetWidth / 2;
  const rx = R * ORBIT_RX * appear;
  const ry = R * ORBIT_RY * appear;
  const ease = clamp(dt * 10);

  electrons.forEach((el, i) => {
    const o = i % 3;                                   // electrons share the 3 orbits in turn
    const start = o * 2.1 + Math.floor(i / 3) * (Math.PI * 2 / PER_ORBIT[o]); // evenly spaced on each orbit
    const theta = start + orbitTime * ORBIT_SPEED[o];

    // Point on a flat ellipse, then rotate it by the orbit's tilt
    const ex = rx * Math.cos(theta);
    const ey = ry * Math.sin(theta);
    const tilt = ORBIT_TILT[o];
    const x = ex * Math.cos(tilt) - ey * Math.sin(tilt);
    const y = ex * Math.sin(tilt) + ey * Math.cos(tilt);
    const depth = Math.sin(theta);                     // > 0 = in front of the nucleus

    const target =
      hovered === null ? 0.82 + 0.18 * depth :
      hovered === i ? 1.6 : 0.6;
    scales[i] += (target - scales[i]) * ease;

    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scales[i]})`;
    el.style.zIndex = hovered === i ? 20 : depth > 0 ? 6 : 3;
    el.style.opacity =
      hovered === i ? 1 :
      hovered !== null ? 0.7 : 0.8 + 0.2 * depth;
  });
}

electrons.forEach((el, i) => {
  el.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") setHover(i); });
  el.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") setHover(null); });
  el.addEventListener("focus", () => setHover(i));
  el.addEventListener("blur", () => setHover(null));

  el.addEventListener("click", e => {
    // On touch screens the first tap enlarges the electron, the second opens it
    if (lastPointer !== "mouse" && hovered !== i) {
      e.preventDefault();
      setHover(i);
      return;
    }
    pendingTarget = el.dataset.target;
  });
});

document.addEventListener("pointerdown", e => {
  lastPointer = e.pointerType;
  if (e.pointerType !== "mouse" && !e.target.closest(".electron")) setHover(null);
}, true);

/* ---------- 5. Partners row ---------- */
// The row stays still; the arrow buttons move it one "page" of logos at a time.
// Each arrow is greyed out once there is nothing more to see in that direction.
const partnerTrack = document.getElementById("partnerTrack");
const partnerBtns = document.querySelectorAll(".partner-btn");

function updatePartnerBtns() {
  const max = partnerTrack.scrollWidth - partnerTrack.clientWidth - 2;
  partnerBtns.forEach(btn => {
    btn.disabled = btn.dataset.dir === "-1" ? partnerTrack.scrollLeft <= 2 : partnerTrack.scrollLeft >= max;
  });
  partnerTrack.classList.toggle("more-left", partnerTrack.scrollLeft > 2);
  partnerTrack.classList.toggle("more-right", partnerTrack.scrollLeft < max);
}

partnerBtns.forEach(btn => btn.addEventListener("click", () => {
  partnerTrack.scrollBy({
    left: Number(btn.dataset.dir) * partnerTrack.clientWidth * 0.8,
    behavior: reduceMotion ? "auto" : "smooth",
  });
}));
partnerTrack.addEventListener("scroll", updatePartnerBtns, { passive: true });
window.addEventListener("resize", updatePartnerBtns);
window.addEventListener("load", updatePartnerBtns);
updatePartnerBtns();

/* ---------- 6. About Us mural ---------- */
// A full-width band of tiles, about 1.5x as tall as a person card.
// Swap these placeholders for real photos (any size; each is cropped to its tile).
// Tiles cycle through the list, so a few photos are enough to fill the band.
const MURAL_IMAGES = [
  "assets/mural/placeholder-1.svg",
  "assets/mural/placeholder-2.svg",
  "assets/mural/placeholder-3.svg",
  "assets/mural/placeholder-4.svg",
  "assets/mural/placeholder-5.svg",
  "assets/mural/placeholder-6.svg",
];
const MURAL_ROWS = 6;                // rows of tiles; columns are added to fill the width
const MURAL_HEIGHT_VS_CARD = 1.5;    // band height compared with one person card
const MURAL_SHOW_MS = 1500;          // how long a photo stays before fading back

const mural = document.getElementById("mural");
if (mural) {
  let builtFor = "";

  // (Re)build the tiles to fit the current page width and card height
  const buildMural = () => {
    const card = document.querySelector("#page-about .person");
    if (!card || !mural.offsetWidth || !card.offsetHeight) return;   // About page not showing
    const height = Math.round(card.offsetHeight * MURAL_HEIGHT_VS_CARD);
    const cols = Math.max(4, Math.round(mural.offsetWidth / (height / MURAL_ROWS)));  // near-square tiles
    const key = `${cols}x${height}`;
    if (key === builtFor) return;
    builtFor = key;

    mural.style.height = `${height}px`;
    mural.style.setProperty("--cols", cols);
    mural.style.setProperty("--rows", MURAL_ROWS);
    mural.replaceChildren();
    for (let i = 0; i < cols * MURAL_ROWS; i++) {
      const row = Math.floor(i / cols);
      const tile = document.createElement("div");
      tile.className = "tile";
      const img = document.createElement("img");
      img.src = MURAL_IMAGES[(i * 7 + row) % MURAL_IMAGES.length];  // mix them up a bit
      img.alt = "";
      img.loading = "lazy";
      tile.appendChild(img);
      mural.appendChild(tile);
    }
  };

  const reveal = tile => {
    if (!tile || !mural.contains(tile)) return;
    tile.classList.add("on");
    clearTimeout(tile._timer);
    tile._timer = setTimeout(() => tile.classList.remove("on"), MURAL_SHOW_MS);
  };
  mural.addEventListener("pointerover", e => reveal(e.target.closest(".tile")));
  // dragging a finger across the mural reveals tiles too
  mural.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") reveal(document.elementFromPoint(e.clientX, e.clientY)?.closest(".tile"));
  });
  mural.style.touchAction = "pan-y";

  // Build once the About page is visible, and again if the window size changes
  const buildSoon = () => requestAnimationFrame(buildMural);
  window.addEventListener("hashchange", buildSoon);
  window.addEventListener("resize", buildSoon);
  window.addEventListener("load", buildSoon);
  buildSoon();
}

/* ---------- Animation loop ---------- */
let lastTime = performance.now();

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  if (document.body.classList.contains("on-home")) {
    // Slow twist from scrolling, plus a gentle idle rotation so it always feels alive
    const phase = window.scrollY * 0.0045 + (reduceMotion ? 0 : time * 0.00015);
    updateScene(scrollProgress());
    // After the goals, the strand's tapered end travels up and off the screen
    const taper = Math.max(W, 160) * 0.7;
    const endY = dnaExit <= 0 ? Infinity : (H + taper) - dnaExit * (H + taper + 80);
    drawDNA(phase, endY);
    updateAtom(dt);
  }
  requestAnimationFrame(frame);
}

window.addEventListener("hashchange", showPage);
window.addEventListener("resize", resizeCanvas);
showPage();
resizeCanvas();
requestAnimationFrame(frame);
