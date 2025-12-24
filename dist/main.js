const canvas = document.getElementById("backgroundCanvas");
const ctx = canvas.getContext("2d");
const deactivateCheckBox = document.getElementById("deactivatebackground");
const anchors = document.getElementsByClassName("anchors");
/* ===================== STATE ===================== */
const dots = [];
let initialized = false;
let active = true;
let drag = 1; // 1 = do nothing while -1 pulls.
const mouse = {
    x: 0,
    y: 0,
    active: false
};
/* ===================== CONFIG ===================== */
let DOT_COUNT = 265;
let MAX_DISTANCE = 120;
let DOT_REPEL_RADIUS = 128;
let DOT_REPEL_FORCE = 0.5;
let MOUSE_RADIUS = 128;
let MOUSE_FORCE = 0.15;
let FRICTION = 0.99;
let MAX_TRIANGLES = 128;
/* ===================== INPUT ===================== */
deactivateCheckBox.addEventListener("change", () => {
    active = !deactivateCheckBox.checked;
});
window.addEventListener("mousedown", (e) => {
    drag = -2;
});
window.addEventListener("mouseup", (e) => {
    drag = 1;
});
Array.from(anchors).forEach(anchor => {
    anchor.addEventListener("mouseenter", () => {
        MOUSE_FORCE = -.15;
        MOUSE_RADIUS = 512;
    });
    anchor.addEventListener("mouseleave", () => {
        MOUSE_FORCE = 0.15;
        MOUSE_RADIUS = 128;
    });
});
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
});
window.addEventListener("mouseleave", () => {
    mouse.active = false;
});
/* ===================== CANVAS ===================== */
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
/* ===================== HELPERS ===================== */
function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function createDot() {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        radius: Math.random() * 2 + 0.5,
        vx: 0,
        vy: 0
    };
}
/* ===================== PHYSICS ===================== */
function applyDotRepulsion() {
    for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
            const a = dots[i];
            const b = dots[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
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
        const dx = dot.x - mouse.x;
        const dy = dot.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
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
        dot.x += dot.vx;
        dot.y += dot.vy;
        dot.vx *= FRICTION;
        dot.vy *= FRICTION;
        if (dot.x <= 0 || dot.x >= rect.width) {
            dot.vx *= -1;
        }
        if (dot.y <= 0 || dot.y >= rect.height) {
            dot.vy *= -1;
        }
    }
}
/* ===================== RENDER ===================== */
function drawDot(dot) {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
}
function drawLines() {
    for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
            const a = dots[i];
            const b = dots[j];
            const dist = distance(a, b);
            if (dist < MAX_DISTANCE) {
                const alpha = 1 - dist / MAX_DISTANCE;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
}
function drawTriangles() {
    let _triangle_count = 0;
    for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
            for (let k = j + 1; k < dots.length; k++) {
                if (_triangle_count >= MAX_TRIANGLES)
                    return;
                const a = dots[i];
                const b = dots[j];
                const c = dots[k];
                if (distance(a, b) < MAX_DISTANCE &&
                    distance(a, c) < MAX_DISTANCE &&
                    distance(b, c) < MAX_DISTANCE) {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.lineTo(c.x, c.y);
                    ctx.closePath();
                    ctx.fillStyle = "hsla(320, 100%, 50%, 0.26)";
                    ctx.fill();
                    _triangle_count++;
                }
            }
        }
    }
}
/* ===================== LOOP ===================== */
function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyDotRepulsion();
    applyMouseRepulsion();
    updateDots();
    drawTriangles();
    drawLines();
    for (const dot of dots) {
        drawDot(dot);
    }
}
function loop() {
    if (active) {
        canvas.style.visibility = "visible";
        drawAll();
    }
    else {
        canvas.style.visibility = "hidden";
    }
    requestAnimationFrame(loop);
}
/* ===================== INIT ===================== */
if (!initialized) {
    for (let i = 0; i < DOT_COUNT; i++) {
        dots.push(createDot());
    }
    initialized = true;
    loop();
}
export {};
//# sourceMappingURL=main.js.map