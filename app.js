﻿// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STEEL FORGE â€” app.js
// Cinematic Scroll Engine v1.0 | Russian Edition
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// === CONSTANTS ===
const TOTAL_FRAMES = 430;     // steel-forge-ru frames
const PAGE_COUNT   = 6;   // 6 sections
const LERP         = 0.02; // Cinematic smoothness (very slow, film-like)
const CONCURRENCY  = 48;   // Parallel frame loading

// === DEVICE DETECTION ===
// isMobile checks both UA and viewport width
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

// === CANVAS SETUP ===
const canvas = document.getElementById('gl-canvas');
const ctx    = canvas.getContext('2d');

// IMPORTANT: canvasDpr is module-level so both resize() and drawFrame() use same value.
// Never use canvas.width / devicePixelRatio in drawFrame() â€” use innerWidth instead.
let canvasDpr = 1;

function resize() {
  canvasDpr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width  = innerWidth  * canvasDpr;
  canvas.height = innerHeight * canvasDpr;
  canvas.style.width  = innerWidth  + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0); // HiDPI support
}

window.addEventListener('resize', resize);
resize();

// === FRAME LOADING ===
const frames = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let isReady     = false;
let preloaderDismissed = false;
const PRELOADER_THRESHOLD = 15;
let animStarted = false;

function frameName(i) {
  // Pattern: frame_000001.webp â€¦ frame_000800.webp (6 zero-padded)
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadAll() {
  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);

  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      await new Promise(resolve => {
        const img = new Image();
                img.onload = img.onerror = () => {
          frames[i] = img;
          loadedCount++;
          if (loadedCount === 1) { isReady = true; if (typeof startAnim === "function") startAnim(); }
          const realPct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
          if (!preloaderDismissed) {
            const visualPct = Math.min(Math.round((realPct / PRELOADER_THRESHOLD) * 100), 100);
            const bar = document.getElementById('progress-bar') || document.getElementById('loader-bar');
            const pctEl = document.getElementById('loader-pct');
            if (bar) bar.style.width = visualPct + '%';
            if (pctEl) pctEl.textContent = visualPct + '%';
            if (realPct >= PRELOADER_THRESHOLD) {
              preloaderDismissed = true;
              isReady = true;
              drawFrame(0);
              if (typeof pages !== 'undefined' && pages[0]) pages[0].classList.add('is-active');
              const loader = document.getElementById('loader');
              if (loader) { 
                loader.style.transition = 'opacity 0.8s'; 
                loader.style.opacity = '0'; 
                setTimeout(() => { loader.style.display = 'none'; }, 800); 
              }
              const slb = document.getElementById('siteLoadingBar');
              if (slb) {
                slb.style.opacity = '1';
                slb.style.visibility = 'visible';
                slb.innerHTML = '<div class="slb-track"><div class="slb-fill" id="slbFill"></div></div><span class="slb-text" id="siteLoadingText">Loading video 0%</span>';
              }
            }
          } else {
            const slb = document.getElementById('slbFill');
            const txt = document.getElementById('siteLoadingText');
            const phase2Pct = Math.round(((realPct - PRELOADER_THRESHOLD) / (100 - PRELOADER_THRESHOLD)) * 100);
            if (slb) slb.style.width = phase2Pct + '%';
            if (txt) txt.textContent = 'Loading video ' + realPct + '%';
            if (realPct >= 100) {
              const sbar = document.getElementById('siteLoadingBar');
              if (txt) txt.textContent = 'Loading complete';
              if (sbar) {
                sbar.style.opacity = '0';
                sbar.style.visibility = 'hidden';
                setTimeout(() => sbar.remove(), 800);
              }
            }
          }
          resolve();
        };
        img.src = frameName(i);
      });
    }
  }

  // Launch CONCURRENCY parallel workers
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// === ANIMATION LOOP ===
let currentFrame = 0;
let targetFrame  = 0;

window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress  = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame     = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

function drawFrame(idx) {
  const img = frames[Math.max(0, Math.min(Math.round(idx), TOTAL_FRAMES - 1))];
  if (!img || !img.complete) return;

  // IMPORTANT: Use innerWidth/innerHeight (not canvas.width / canvasDpr)
  // ctx.setTransform already applies the dpr scaling.
  const W = innerWidth;
  const H = innerHeight;

  // Cover-fit: scale image to fill viewport, centered (equivalent to background-size: cover)
  const r  = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth  * r;
  const ih = img.naturalHeight * r;
  const x  = (W - iw) / 2;
  const y  = (H - ih) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);

  // â”€â”€ Radial vignette (industrial dark)
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
  vig.addColorStop(0, 'rgba(8,8,8,0)');
  vig.addColorStop(1, 'rgba(8,8,8,0.82)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // â”€â”€ Bottom gradient darkening (for text legibility)
  const bot = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bot.addColorStop(0, 'rgba(8,8,8,0)');
  bot.addColorStop(1, 'rgba(8,8,8,0.90)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // â”€â”€ Subtle top edge darkening (navbar area)
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.12);
  top.addColorStop(0, 'rgba(8,8,8,0.5)');
  top.addColorStop(1, 'rgba(8,8,8,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.12);
}

function startAnim() {
  function loop() {
    requestAnimationFrame(loop);
    // LERP interpolation for cinematic smoothness
    currentFrame += (targetFrame - currentFrame) * LERP;
    if (isReady) drawFrame(Math.round(currentFrame));
  }
  loop();
}

// === SECTION ACTIVATION (IntersectionObserver) ===
const pages    = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      // Activate current page, deactivate others
      pages.forEach((p, i)    => p.classList.toggle('is-active', i === idx));
      // Highlight corresponding nav link (offset by 1 since hero has no nav link)
      navLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
    }
  });
}, { rootMargin: '-40% 0px -40% 0px' });

pages.forEach(p => observer.observe(p));

// Ensure hero is active on initial load
if (pages[0]) pages[0].classList.add('is-active');

// === MOBILE BURGER MENU ===
const burger        = document.getElementById('burger');
const navDrawer     = document.getElementById('nav-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose   = document.getElementById('drawer-close');

function openDrawer() {
  if (!navDrawer || !drawerOverlay || !burger) return;
  navDrawer.classList.add('open');
  drawerOverlay.classList.add('show');
  burger.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  if (!navDrawer || !drawerOverlay || !burger) return;
  navDrawer.classList.remove('open');
  drawerOverlay.classList.remove('show');
  burger.classList.remove('open');
  document.body.style.overflow = '';
}

if (burger)        burger.addEventListener('click', openDrawer);
if (drawerClose)   drawerClose.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

// Close drawer on any drawer link click
document.querySelectorAll('.drawer-link').forEach(link => {
  link.addEventListener('click', closeDrawer);
});

// === SMOOTH SCROLL for anchor links ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const id     = this.getAttribute('href');
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// === CONTACT FORM HANDLER ===
function handleForm(e) {
  e.preventDefault();
  const btn      = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.innerHTML  = 'ÐžÐ¢ÐŸÐ ÐÐ’Ð›Ð•ÐÐž âœ“';
  btn.style.background = 'rgba(255,107,53,0.8)';
  btn.disabled   = true;
  setTimeout(() => {
    btn.innerHTML  = original;
    btn.style.background = '';
    btn.disabled   = false;
    e.target.reset();
  }, 3000);
}

// === KICK OFF LOADING ===
loadAll();



// Site loading bar CSS (Phase 2 - deferred)
const siteBarStyle = document.createElement('style');
siteBarStyle.textContent = '.site-loading-bar{position:fixed;bottom:0;left:0;width:100%;height:28px;background:rgba(10,10,10,.85);backdrop-filter:blur(8px);z-index:9998;display:flex;align-items:center;padding:0 16px;gap:10px;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;border-top:1px solid rgba(255,255,255,.08)}.site-loading-bar.active{opacity:1;visibility:visible}.site-loading-bar.done{opacity:0;visibility:hidden}.site-loading-fill{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}.site-loading-fill-inner{height:100%;width:0;background:linear-gradient(90deg,var(--gold,var(--accent,#c9a84c)),var(--gold-light,#e8c97a));border-radius:2px;transition:width .2s}.site-loading-text{font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap}';
document.head.appendChild(siteBarStyle);

// === SITE LOADING BAR (Phase 2 — deferred) ===
(function(){
  if (document.getElementById('siteLoadingBar')) return;
  var el = document.createElement('div');
  el.id = 'siteLoadingBar';
  el.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:32px;background:rgba(10,10,10,.88);backdrop-filter:blur(10px);z-index:9998;display:flex;align-items:center;padding:0 20px;gap:12px;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;border-top:1px solid rgba(255,255,255,.08);';
  el.innerHTML = '<div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div id="slbFill" style="height:100%;width:0;background:linear-gradient(90deg,var(--gold,var(--accent,#c9a84c)),#e8c97a);border-radius:2px;transition:width .25s;"></div></div><span id="siteLoadingText" style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;">Loading video...</span>';
  document.body.appendChild(el);
})();
