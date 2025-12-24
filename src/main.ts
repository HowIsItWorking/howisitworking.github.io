// ===================== CANVAS SETUP =====================
const canvas = document.getElementById("backgroundCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const deactivateCheckBox = document.getElementById("deactivate-background") as HTMLInputElement;
const anchors = document.getElementsByClassName("anchors") as HTMLCollectionOf<HTMLElement>;

const realWidth = window.screen.width;
const realHeight = window.screen.height;

// ===================== TYPES =====================
interface Dot { x: number; y: number; radius: number; vx: number; vy: number; }
interface Triangle {
  a: number;
  b: number;
  c: number;
}

// ===================== STATE =====================
const dots: Dot[] = [];
let active = true;
let drag = 1;
const mouse = { x: 0, y: 0, active: false };
let triangles: Triangle[] = [];
const triangleKeys = new Set<string>();

// ===================== CONFIG & SMOOTH COLOR =====================
const colors = {
  base: { h: 0, s: 0, l: 100, a: 0.26 },
  linkedin: { h: 221, s: 100, l: 50, a: 0.26 },
  github: { h: 0, s: 0, l: 0, a: 0.26 },
  instagram: { h: 340, s: 100, l: 50, a: 0.26 }
};

// Lerp State
let targetColor = colors.base;
let currentColor = { ...colors.base };
const LERP_SPEED = 0.04; // 0.01 (slow) to 0.1 (fast)

const referenceWidth = 1920;
const referenceHeight = 1080;
const scaleFactor = Math.sqrt((realWidth * realHeight) / (referenceWidth * referenceHeight));
const MAX_DOTS_FINAL = Math.min(1024, Math.max(64, Math.floor(256 * scaleFactor)));

let MAX_DISTANCE = 130 * scaleFactor;
let DOT_REPEL_RADIUS = 128 * scaleFactor;
let DOT_REPEL_FORCE = 0.05 * scaleFactor;
let MOUSE_RADIUS = 128 * scaleFactor;
let MOUSE_FORCE = 0.05 * scaleFactor;
let FRICTION = 0.999;
let MAX_TRIANGLES = 256;

// ===================== HELPERS =====================

function updateSmoothColor(): void {
  // Linearly interpolate H, S, and L towards the target
  currentColor.h += (targetColor.h - currentColor.h) * LERP_SPEED;
  currentColor.s += (targetColor.s - currentColor.s) * LERP_SPEED;
  currentColor.l += (targetColor.l - currentColor.l) * LERP_SPEED;
}

function getHSLAString(colorObj: { h: number, s: number, l: number }, alpha: number): string {
  return `hsla(${colorObj.h}, ${colorObj.s}%, ${colorObj.l}%, ${alpha})`;
}

function distance(a: Dot, b: Dot): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function triangleKey(i: number, j: number, k: number): string {
  return [i, j, k].sort((a, b) => a - b).join("-");
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Account for high-resolution screens
  const displayWidth = Math.round(rect.width * dpr);
  const displayHeight = Math.round(rect.height * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    // Reset the coordinate system to match CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Call it once and add the listener
resizeCanvas();


// ===================== EVENT LISTENERS =====================
deactivateCheckBox.addEventListener("change", () => { active = !deactivateCheckBox.checked; });
window.addEventListener("mousedown", () => { drag = -2; });
window.addEventListener("mouseup", () => { drag = 1; });
window.addEventListener("resize", resizeCanvas);

Array.from(anchors).forEach(anchor => {
  anchor.addEventListener("mouseenter", () => {
    MOUSE_FORCE = -0.15; MOUSE_RADIUS = 512;
    if (anchor.classList.contains("linkedin")) targetColor = colors.linkedin;
    else if (anchor.classList.contains("github")) targetColor = colors.github;
    else if (anchor.classList.contains("instagram")) targetColor = colors.instagram;
  });
  anchor.addEventListener("mouseleave", () => {
    MOUSE_FORCE = 0.15; MOUSE_RADIUS = 128;
    targetColor = colors.base;
  });
});

window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.active = true;
});

// ===================== TRIANGLE BUILDING =====================
function buildTriangles(): void {
  // We clear and rebuild to ensure triangles vanish when dots move away
  triangles = [];
  triangleKeys.clear();

  for (let i = 0; i < dots.length; i++) {
    if (triangles.length >= MAX_TRIANGLES) return;
    const a = dots[i];

    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      if (distance(a, b) >= MAX_DISTANCE) continue;

      for (let k = j + 1; k < dots.length; k++) {
        const c = dots[k];
        if (triangles.length >= MAX_TRIANGLES) return;
        if (distance(a, c) >= MAX_DISTANCE || distance(b, c) >= MAX_DISTANCE) continue;

        const key = triangleKey(i, j, k);
        if (triangleKeys.has(key)) continue;

        triangles.push({
          a: i, b: j, c: k,
        });
        triangleKeys.add(key);
      }
    }
  }
}

// ===================== PHYSICS =====================
function applyPhysics(): void {
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];

    // Dot Repulsion
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      const dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < DOT_REPEL_RADIUS) {
        const f = (DOT_REPEL_RADIUS - dist) / DOT_REPEL_RADIUS * DOT_REPEL_FORCE;
        a.vx += (dx / dist) * f; a.vy += (dy / dist) * f;
        b.vx -= (dx / dist) * f; b.vy -= (dy / dist) * f;
      }
    }

    // Mouse
    if (mouse.active) {
      const mdx = a.x - mouse.x, mdy = a.y - mouse.y, mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < MOUSE_RADIUS) {
        const mf = (MOUSE_RADIUS - mDist) / MOUSE_RADIUS * MOUSE_FORCE * drag;
        a.vx += (mdx / mDist) * mf; a.vy += (mdy / mDist) * mf;
      }
    }

    a.x += a.vx; a.y += a.vy;
    a.vx *= FRICTION; a.vy *= FRICTION;
    if (a.x <= 0 || a.x >= rect.width) a.vx *= -1;
    if (a.y <= 0 || a.y >= rect.height) a.vy *= -1;
  }
}

// ===================== RENDER =====================
function drawAll(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateSmoothColor();
  applyPhysics();
  buildTriangles();

  // 1. Draw Triangles (Individual Colors)
  for (const t of triangles) {
    const a = dots[t.a], b = dots[t.b], c = dots[t.c];
    const maxE = Math.max(distance(a, b), distance(b, c), distance(c, a));
    const fade = 1 - (maxE / MAX_DISTANCE);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
    ctx.fillStyle = getHSLAString(currentColor, fade * 0.15); // Triangle fill is lighter
    ctx.fill();
  }

  // 2. Draw Lines (Global Smoothed Color)
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      const d = distance(a, b);
      if (d < MAX_DISTANCE) {
        const fade = 1 - (d / MAX_DISTANCE);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = getHSLAString(currentColor, fade * 0.4);
        ctx.stroke();
      }
    }
  }

  // 3. Draw Dots
  ctx.fillStyle = getHSLAString(currentColor, 0.5);
  for (const dot of dots) {
    ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2); ctx.fill();
  }
}

function loop(): void {
  if (active){
    canvas.style.visibility = "visible"
    drawAll();
  } else {
    canvas.style.visibility = "hidden"
  }
  requestAnimationFrame(loop);
}

// Init
for (let i = 0; i < MAX_DOTS_FINAL; i++) {
  const r = canvas.getBoundingClientRect();
  dots.push({ x: Math.random() * r.width, y: Math.random() * r.height, radius: Math.random() * 2 + 0.5, vx: 0, vy: 0 });
}
loop();