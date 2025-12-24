// ===================== CANVAS SETUP =====================
const canvas = document.getElementById("backgroundCanvas");
const ctx = canvas.getContext("2d");
const deactivateCheckBox = document.getElementById("deactivatebackground");
const anchors = document.getElementsByClassName("anchors");
const realWidth = window.screen.width;
const realHeight = window.screen.height;
// ===================== STATE =====================
const dots = [];
let initialized = false;
let active = true;
let drag = 1;
const mouse = { x: 0, y: 0, active: false };
const triangles = [];
const triangleKeys = new Set();
// ===================== CONFIG =====================
const baseColor = "hsla(0, 0%, 100%, 0.26)";
const linkedinColor = "hsla(221, 100%, 50%, 0.26)";
const githubColor = "hsla(0, 0%, 0%, 0.26)";
const instagramColor = "hsla(340, 100%, 50%, 0.26)";
let triangleColor = baseColor;
const referenceWidth = 1920;
const referenceHeight = 1080;
const referenceArea = referenceWidth * referenceHeight;
const currentArea = realWidth * realHeight;
const scaleFactor = Math.sqrt(currentArea / referenceArea);
// dots - usar raiz quadrada da área
const baseDots = 256;
const scaledDots = baseDots * Math.sqrt(currentArea / referenceArea);
const MIN_DOTS = 64;
const MAX_DOTS = 512;
const MAX_DOTS_FINAL = Math.min(MAX_DOTS, Math.max(MIN_DOTS, Math.floor(scaledDots)));
let MAX_DISTANCE = 140 * scaleFactor;
let DOT_REPEL_RADIUS = 128 * scaleFactor;
let DOT_REPEL_FORCE = 0.25 * scaleFactor;
let MOUSE_RADIUS = 128 * scaleFactor;
let MOUSE_FORCE = 0.15 * scaleFactor;
let FRICTION = 0.9999;
let MAX_TRIANGLES = 128;
// ===================== EVENT LISTENERS =====================
deactivateCheckBox.addEventListener("change", () => { active = !deactivateCheckBox.checked; });
window.addEventListener("mousedown", () => { drag = -2; });
window.addEventListener("mouseup", () => { drag = 1; });
Array.from(anchors).forEach(anchor => {
    anchor.addEventListener("mouseenter", () => {
        MOUSE_FORCE = -0.15;
        MOUSE_RADIUS = 512;
        if (anchor.classList.contains("linkedin"))
            triangleColor = linkedinColor;
        else if (anchor.classList.contains("github"))
            triangleColor = githubColor;
        else if (anchor.classList.contains("instagram"))
            triangleColor = instagramColor;
    });
    anchor.addEventListener("mouseleave", () => {
        MOUSE_FORCE = 0.15;
        MOUSE_RADIUS = 128;
        triangleColor = baseColor;
    });
});
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
});
window.addEventListener("mouseleave", () => { mouse.active = false; });
// ===================== CANVAS RESIZE =====================
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(rect.width * dpr);
    const displayHeight = Math.round(rect.height * dpr);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
// ===================== GEOMETRY HELPERS =====================
function ccw(ax, ay, bx, by, cx, cy) {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    return (ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
        ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy));
}
function distance(a, b) {
    if (!a || !b)
        return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function isTriangleValid(t) {
    if (!t)
        return false;
    const a = dots[t.a], b = dots[t.b], c = dots[t.c];
    if (!a || !b || !c)
        return false;
    return distance(a, b) < MAX_DISTANCE && distance(a, c) < MAX_DISTANCE && distance(b, c) < MAX_DISTANCE;
}
function trianglesOverlap(t1, a1, b1, c1) {
    if (!a1 || !b1 || !c1)
        return false;
    const t2a = dots[t1.a], t2b = dots[t1.b], t2c = dots[t1.c];
    if (!t2a || !t2b || !t2c)
        return false;
    const tri1 = [a1, b1, c1];
    const tri2 = [t2a, t2b, t2c];
    const axes = [
        [b1.x - a1.x, b1.y - a1.y],
        [c1.x - b1.x, c1.y - b1.y],
        [a1.x - c1.x, a1.y - c1.y],
        [t2b.x - t2a.x, t2b.y - t2a.y],
        [t2c.x - t2b.x, t2c.y - t2b.y],
        [t2a.x - t2c.x, t2a.y - t2c.y]
    ];
    for (const axis of axes) {
        if (!axis || axis.length < 2)
            continue; // evita undefined
        if (!axis || axis.length < 2 || axis[0] == null || axis[1] == null)
            continue;
        const ax = -axis[1];
        const ay = axis[0];
        if (ax == null || ay == null)
            continue; // checagem extra
        let min1 = Infinity, max1 = -Infinity;
        for (const p of tri1) {
            if (!p)
                continue;
            const proj = p.x * ax + p.y * ay;
            min1 = Math.min(min1, proj);
            max1 = Math.max(max1, proj);
        }
        let min2 = Infinity, max2 = -Infinity;
        for (const p of tri2) {
            if (!p)
                continue;
            const proj = p.x * ax + p.y * ay;
            min2 = Math.min(min2, proj);
            max2 = Math.max(max2, proj);
        }
        if (max1 < min2 || max2 < min1)
            return false; // separating axis encontrado
    }
    return true;
}
function triangleKey(i, j, k) {
    return [i, j, k].sort((a, b) => a - b).join("-");
}
// ===================== TRIANGLE BUILDING =====================
function buildTriangles() {
    for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        if (!a)
            continue;
        for (let j = i + 1; j < dots.length; j++) {
            const b = dots[j];
            if (!b || distance(a, b) >= MAX_DISTANCE)
                continue;
            for (let k = j + 1; k < dots.length; k++) {
                const c = dots[k];
                if (!c)
                    continue;
                if (distance(a, c) >= MAX_DISTANCE)
                    continue;
                if (distance(b, c) >= MAX_DISTANCE)
                    continue;
                const key = triangleKey(i, j, k);
                if (triangleKeys.has(key))
                    continue;
                triangles.push({ a: i, b: j, c: k, color: triangleColor });
                triangleKeys.add(key);
                if (triangles.length >= MAX_TRIANGLES)
                    return;
            }
        }
    }
}
// ===================== DOTS =====================
function createDot() {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.random() * rect.width, y: Math.random() * rect.height, radius: Math.random() * 2 + 0.5, vx: 0, vy: 0 };
}
// ===================== PHYSICS =====================
function applyDotRepulsion() {
    for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        if (!a)
            continue;
        for (let j = i + 1; j < dots.length; j++) {
            const b = dots[j];
            if (!b)
                continue;
            const dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0 && dist < DOT_REPEL_RADIUS) {
                const force = (DOT_REPEL_RADIUS - dist) / DOT_REPEL_RADIUS;
                const fx = (dx / dist) * force * DOT_REPEL_FORCE;
                const fy = (dy / dist) * force * DOT_REPEL_FORCE;
                a.vx += fx;
                a.vy += fy;
                b.vx -= fx;
                b.vy -= fy;
            }
        }
    }
}
function applyMouseRepulsion() {
    if (!mouse.active)
        return;
    for (const dot of dots) {
        if (!dot)
            continue;
        const dx = dot.x - mouse.x, dy = dot.y - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < MOUSE_RADIUS) {
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            dot.vx += (dx / dist) * force * MOUSE_FORCE * drag;
            dot.vy += (dy / dist) * force * MOUSE_FORCE * drag;
        }
    }
}
function updateDots() {
    const rect = canvas.getBoundingClientRect();
    for (const dot of dots) {
        if (!dot)
            continue;
        dot.x += dot.vx;
        dot.y += dot.vy;
        dot.vx *= FRICTION;
        dot.vy *= FRICTION;
        if (dot.x <= 0 || dot.x >= rect.width)
            dot.vx *= -1;
        if (dot.y <= 0 || dot.y >= rect.height)
            dot.vy *= -1;
    }
}
// ===================== RENDER =====================
function drawDot(dot) {
    if (!dot)
        return;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
}
function drawLines() {
    for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        if (!a)
            continue;
        for (let j = i + 1; j < dots.length; j++) {
            const b = dots[j];
            if (!b)
                continue;
            const dist = distance(a, b);
            if (dist < MAX_DISTANCE) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(255,255,255,${(1 - dist / MAX_DISTANCE) * 0.5})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
}
function drawTriangles() {
    for (const t of triangles) {
        if (!t)
            continue;
        const a = dots[t.a], b = dots[t.b], c = dots[t.c];
        if (!a || !b || !c)
            continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = t.color;
        ctx.fill();
    }
}
// ===================== MAIN LOOP =====================
function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyDotRepulsion();
    applyMouseRepulsion();
    updateDots();
    for (let i = triangles.length - 1; i >= 0; i--) {
        if (!isTriangleValid(triangles[i])) {
            const t = triangles[i];
            if (t)
                triangleKeys.delete(triangleKey(t.a, t.b, t.c));
            triangles.splice(i, 1);
        }
    }
    buildTriangles();
    drawTriangles();
    drawLines();
    for (const dot of dots)
        drawDot(dot);
}
function loop() {
    if (active) {
        canvas.style.visibility = "visible";
        drawAll();
    }
    else
        canvas.style.visibility = "hidden";
    requestAnimationFrame(loop);
}
// ===================== INIT =====================
if (!initialized) {
    for (let i = 0; i < MAX_DOTS_FINAL; i++)
        dots.push(createDot());
    initialized = true;
    loop();
}
export {};
//# sourceMappingURL=main.js.map