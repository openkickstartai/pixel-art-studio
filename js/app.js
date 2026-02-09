/**
 * Pixel Art Studio - Main Application
 */

// ============================================================
// State
// ============================================================
const state = {
    canvasSize: 16,
    zoom: 1,
    pixelSize: 1,
    showGrid: true,
    currentTool: 'pencil',
    currentColor: '#000000',
    brushSize: 1,
    opacity: 100,
    layers: [],
    activeLayerIdx: 0,
    frames: [],
    activeFrameIdx: 0,
    isDrawing: false,
    startX: -1,
    startY: -1,
    lastX: -1,
    lastY: -1,
    undoStack: [],
    redoStack: [],
    maxUndo: 50,
    isPlaying: false,
    animTimer: null,
    fps: 8,
    moveOffsetX: 0,
    moveOffsetY: 0,
};

const DEFAULT_PALETTE = [
    '#000000','#1D2B53','#7E2553','#008751',
    '#AB5236','#5F574F','#C2C3C7','#FFF1E8',
    '#FF004D','#FFA300','#FFEC27','#00E436',
    '#29ADFF','#83769C','#FF77A8','#FFCCAA',
    '#291814','#111D35','#422136','#125359',
    '#742F29','#49333B','#A28879','#F2D3AB',
    '#EB6B6F','#F9A31B','#FFF726','#A8E72E',
    '#00B543','#065AB5','#754665','#F29CBD',
];

// ============================================================
// Helpers
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function cloneImageData(src) {
    return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

// ============================================================
// DOM References
// ============================================================
const mainCanvas = $('#main-canvas');
const previewCanvas = $('#preview-canvas');
const gridCanvas = $('#grid-canvas');
const mainCtx = mainCanvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');
const gridCtx = gridCanvas.getContext('2d');
const canvasWrapper = $('#canvas-wrapper');

// ============================================================
// Initialization
// ============================================================
function init() {
    setupCanvas();
    setupPalette();
    state.layers = [];
    state.frames = [];
    state.activeLayerIdx = 0;
    state.activeFrameIdx = 0;
    state.undoStack = [];
    state.redoStack = [];
    addLayer('Layer 1');
    saveFrameState();
    renderLayers();
    renderFrames();
    updateColorPreview();
    fitZoom();
}

function setupCanvas() {
    const size = state.canvasSize;
    [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
        c.width = size;
        c.height = size;
    });
    mainCtx.imageSmoothingEnabled = false;
    previewCtx.imageSmoothingEnabled = false;
    updateCanvasDisplay();
}

function updateCanvasDisplay() {
    const displaySize = state.canvasSize * state.zoom;
    const px = displaySize + 'px';
    canvasWrapper.style.width = px;
    canvasWrapper.style.height = px;
    [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
        c.style.width = px;
        c.style.height = px;
    });
    const baseZoom = 512 / state.canvasSize;
    $('#zoom-level').textContent = Math.round(state.zoom / baseZoom * 100) + '%';
    drawGrid();
}

function fitZoom() {
    const area = $('.canvas-area');
    const maxW = area.clientWidth - 60;
    const maxH = area.clientHeight - 60;
    const fitZ = Math.floor(Math.min(maxW, maxH) / state.canvasSize);
    state.zoom = Math.max(1, fitZ);
    updateCanvasDisplay();
    compositeAndDraw();
}

// ============================================================
// Grid
// ============================================================
function drawGrid() {
    const size = state.canvasSize;
    gridCtx.clearRect(0, 0, size, size);
    if (!state.showGrid || state.zoom < 4) return;
    gridCtx.strokeStyle = 'rgba(255,255,255,0.15)';
    gridCtx.lineWidth = 1 / state.zoom;
    for (let i = 0; i <= size; i++) {
        gridCtx.beginPath();
        gridCtx.moveTo(i, 0);
        gridCtx.lineTo(i, size);
        gridCtx.stroke();
        gridCtx.beginPath();
        gridCtx.moveTo(0, i);
        gridCtx.lineTo(size, i);
        gridCtx.stroke();
    }
}

// ============================================================
// Palette
// ============================================================
function setupPalette() {
    const container = $('#color-palette');
    container.innerHTML = '';
    DEFAULT_PALETTE.forEach(color => {
        const el = document.createElement('div');
        el.className = 'palette-color';
        el.style.background = color;
        el.dataset.color = color;
        el.addEventListener('click', () => {
            state.currentColor = color;
            $('#color-picker').value = color;
            $('#color-hex').value = color;
            updateColorPreview();
            highlightPaletteColor();
        });
        container.appendChild(el);
    });
    highlightPaletteColor();
}

function highlightPaletteColor() {
    $$('.palette-color').forEach(el => {
        el.classList.toggle('active', el.dataset.color.toLowerCase() === state.currentColor.toLowerCase());
    });
}

function updateColorPreview() {
    $('#current-color-preview').style.background = state.currentColor;
}

// ============================================================
// Layers
// ============================================================
function addLayer(name) {
    const size = state.canvasSize;
    const data = new ImageData(size, size);
    state.layers.push({
        name: name || ('Layer ' + (state.layers.length + 1)),
        visible: true,
        opacity: 100,
        data: data,
    });
    state.activeLayerIdx = state.layers.length - 1;
    renderLayers();
    compositeAndDraw();
}

function deleteLayer() {
    if (state.layers.length <= 1) return;
    pushUndo();
    state.layers.splice(state.activeLayerIdx, 1);
    state.activeLayerIdx = Math.min(state.activeLayerIdx, state.layers.length - 1);
    renderLayers();
    compositeAndDraw();
}

function duplicateLayer() {
    pushUndo();
    const src = state.layers[state.activeLayerIdx];
    state.layers.splice(state.activeLayerIdx + 1, 0, {
        name: src.name + ' copy',
        visible: true,
        opacity: src.opacity,
        data: cloneImageData(src.data),
    });
    state.activeLayerIdx++;
    renderLayers();
    compositeAndDraw();
}

function mergeDown() {
    if (state.activeLayerIdx >= state.layers.length - 1) return;
    pushUndo();
    const top = state.layers[state.activeLayerIdx];
    const bottom = state.layers[state.activeLayerIdx + 1];
    const size = state.canvasSize;
    const tmpC = document.createElement('canvas');
    tmpC.width = size; tmpC.height = size;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.putImageData(bottom.data, 0, 0);
    const topC = document.createElement('canvas');
    topC.width = size; topC.height = size;
    topC.getContext('2d').putImageData(top.data, 0, 0);
    tmpCtx.globalAlpha = top.opacity / 100;
    tmpCtx.drawImage(topC, 0, 0);
    tmpCtx.globalAlpha = 1;
    bottom.data = tmpCtx.getImageData(0, 0, size, size);
    state.layers.splice(state.activeLayerIdx, 1);
    renderLayers();
    compositeAndDraw();
}

function renderLayers() {
    const list = $('#layer-list');
    list.innerHTML = '';
    for (let i = 0; i < state.layers.length; i++) {
        const layer = state.layers[i];
        const el = document.createElement('div');
        el.className = 'layer-item' + (i === state.activeLayerIdx ? ' active' : '');

        const thumb = document.createElement('canvas');
        thumb.className = 'layer-thumb';
        thumb.width = 24; thumb.height = 24;
        const tCtx = thumb.getContext('2d');
        tCtx.imageSmoothingEnabled = false;
        const tmpC = document.createElement('canvas');
        tmpC.width = state.canvasSize; tmpC.height = state.canvasSize;
        tmpC.getContext('2d').putImageData(layer.data, 0, 0);
        tCtx.drawImage(tmpC, 0, 0, 24, 24);

        const vis = document.createElement('span');
        vis.className = 'layer-visibility';
        vis.innerHTML = layer.visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        vis.addEventListener('click', (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            renderLayers();
            compositeAndDraw();
        });

        const nameEl = document.createElement('span');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;

        el.appendChild(thumb);
        el.appendChild(vis);
        el.appendChild(nameEl);
        el.addEventListener('click', () => {
            state.activeLayerIdx = i;
            renderLayers();
        });
        list.appendChild(el);
    }
}

// ============================================================
// Compositing
// ============================================================
function compositeAndDraw() {
    const size = state.canvasSize;
    mainCtx.clearRect(0, 0, size, size);
    // Checkerboard
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            mainCtx.fillStyle = ((x + y) % 2 === 0) ? '#c0c0c0' : '#808080';
            mainCtx.fillRect(x, y, 1, 1);
        }
    }
    // Layers bottom to top
    for (let i = state.layers.length - 1; i >= 0; i--) {
        const layer = state.layers[i];
        if (!layer.visible) continue;
        const tmpC = document.createElement('canvas');
        tmpC.width = size; tmpC.height = size;
        tmpC.getContext('2d').putImageData(layer.data, 0, 0);
        mainCtx.globalAlpha = layer.opacity / 100;
        mainCtx.drawImage(tmpC, 0, 0);
    }
    mainCtx.globalAlpha = 1;
}

// ============================================================
// Drawing Helpers
// ============================================================
function getPixelCoords(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const scaleX = state.canvasSize / rect.width;
    const scaleY = state.canvasSize / rect.height;
    return [
        Math.floor((e.clientX - rect.left) * scaleX),
        Math.floor((e.clientY - rect.top) * scaleY)
    ];
}

function setPixel(imageData, x, y, color, opacity) {
    const size = state.canvasSize;
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    const [r, g, b] = hexToRgb(color);
    const a = Math.round((opacity / 100) * 255);
    const srcA = a / 255;
    const dstA = imageData.data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA > 0) {
        imageData.data[idx]     = Math.round((r * srcA + imageData.data[idx] * dstA * (1 - srcA)) / outA);
        imageData.data[idx + 1] = Math.round((g * srcA + imageData.data[idx + 1] * dstA * (1 - srcA)) / outA);
        imageData.data[idx + 2] = Math.round((b * srcA + imageData.data[idx + 2] * dstA * (1 - srcA)) / outA);
        imageData.data[idx + 3] = Math.round(outA * 255);
    }
}

function erasePixel(imageData, x, y) {
    const size = state.canvasSize;
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    imageData.data[idx] = 0;
    imageData.data[idx + 1] = 0;
    imageData.data[idx + 2] = 0;
    imageData.data[idx + 3] = 0;
}

function getPixelColor(imageData, x, y) {
    const size = state.canvasSize;
    if (x < 0 || x >= size || y < 0 || y >= size) return [0,0,0,0];
    const idx = (y * size + x) * 4;
    return [imageData.data[idx], imageData.data[idx+1], imageData.data[idx+2], imageData.data[idx+3]];
}

function drawBrush(imageData, x, y, tool) {
    const bs = state.brushSize;
    const half = Math.floor(bs / 2);
    for (let dy = 0; dy < bs; dy++) {
        for (let dx = 0; dx < bs; dx++) {
            const px = x - half + dx;
            const py = y - half + dy;
            if (tool === 'eraser') erasePixel(imageData, px, py);
            else setPixel(imageData, px, py, state.currentColor, state.opacity);
        }
    }
}

function floodFill(imageData, startX, startY, fillColor, opacity) {
    const size = state.canvasSize;
    if (startX < 0 || startX >= size || startY < 0 || startY >= size) return;
    const targetColor = getPixelColor(imageData, startX, startY);
    const [fr, fg, fb] = hexToRgb(fillColor);
    const fa = Math.round((opacity / 100) * 255);
    if (targetColor[0] === fr && targetColor[1] === fg && targetColor[2] === fb && targetColor[3] === fa) return;
    const stack = [[startX, startY]];
    const visited = new Set();
    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cx >= size || cy < 0 || cy >= size) continue;
        const key = cy * size + cx;
        if (visited.has(key)) continue;
        visited.add(key);
        const c = getPixelColor(imageData, cx, cy);
        if (c[0] !== targetColor[0] || c[1] !== targetColor[1] || c[2] !== targetColor[2] || c[3] !== targetColor[3]) continue;
        const idx = key * 4;
        imageData.data[idx] = fr;
        imageData.data[idx + 1] = fg;
        imageData.data[idx + 2] = fb;
        imageData.data[idx + 3] = fa;
        stack.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
    }
}

function bresenhamLine(x0, y0, x1, y1, callback) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
        callback(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

function drawLineOnData(imageData, x0, y0, x1, y1, tool) {
    bresenhamLine(x0, y0, x1, y1, (x, y) => drawBrush(imageData, x, y, tool));
}

function drawRectOnData(imageData, x0, y0, x1, y1, tool) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    for (let x = minX; x <= maxX; x++) { drawBrush(imageData, x, minY, tool); drawBrush(imageData, x, maxY, tool); }
    for (let y = minY + 1; y < maxY; y++) { drawBrush(imageData, minX, y, tool); drawBrush(imageData, maxX, y, tool); }
}

function drawEllipseOnData(imageData, cx, cy, rx, ry, tool) {
    if (rx === 0 && ry === 0) { drawBrush(imageData, cx, cy, tool); return; }
    const a = Math.abs(rx), b = Math.abs(ry);
    // Simple parametric approach
    const steps = Math.max(a, b) * 8 + 16;
    let prevX = null, prevY = null;
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = Math.round(cx + a * Math.cos(t));
        const y = Math.round(cy + b * Math.sin(t));
        if (prevX !== null) {
            bresenhamLine(prevX, prevY, x, y, (px, py) => drawBrush(imageData, px, py, tool));
        }
        prevX = x; prevY = y;
    }
}

// ============================================================
// Undo / Redo
// ============================================================
function pushUndo() {
    const snapshot = state.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity,
        data: cloneImageData(l.data),
    }));
    state.undoStack.push({ layers: snapshot, activeLayerIdx: state.activeLayerIdx });
    if (state.undoStack.length > state.maxUndo) state.undoStack.shift();
    state.redoStack = [];
}

function undo() {
    if (state.undoStack.length === 0) return;
    const current = state.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity,
        data: cloneImageData(l.data),
    }));
    state.redoStack.push({ layers: current, activeLayerIdx: state.activeLayerIdx });
    const snap = state.undoStack.pop();
    state.layers = snap.layers;
    state.activeLayerIdx = snap.activeLayerIdx;
    renderLayers();
    compositeAndDraw();
}

function redo() {
    if (state.redoStack.length === 0) return;
    const current = state.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity,
        data: cloneImageData(l.data),
    }));
    state.undoStack.push({ layers: current, activeLayerIdx: state.activeLayerIdx });
    const snap = state.redoStack.pop();
    state.layers = snap.layers;
    state.activeLayerIdx = snap.activeLayerIdx;
    renderLayers();
    compositeAndDraw();
}

// ============================================================
// Frames (Animation)
// ============================================================
function saveFrameState() {
    const frameLayers = state.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity,
        data: cloneImageData(l.data),
    }));
    if (state.frames.length === 0) {
        state.frames.push({ layers: frameLayers });
    } else {
        state.frames[state.activeFrameIdx] = { layers: frameLayers };
    }
}

function loadFrameState(idx) {
    saveFrameState(); // save current first
    state.activeFrameIdx = idx;
    const frame = state.frames[idx];
    state.layers = frame.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity,
        data: cloneImageData(l.data),
    }));
    state.activeLayerIdx = Math.min(state.activeLayerIdx, state.layers.length - 1);
    renderLayers();
    compositeAndDraw();
}

function addFrame() {
    saveFrameState();
    const size = state.canvasSize;
    state.frames.push({ layers: [{ name: 'Layer 1', visible: true, opacity: 100, data: new ImageData(size, size) }] });
    state.activeFrameIdx = state.frames.length - 1;
    state.layers = state.frames[state.activeFrameIdx].layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity, data: cloneImageData(l.data),
    }));
    state.activeLayerIdx = 0;
    renderLayers();
    compositeAndDraw();
    renderFrames();
}

function deleteFrame() {
    if (state.frames.length <= 1) return;
    state.frames.splice(state.activeFrameIdx, 1);
    state.activeFrameIdx = Math.min(state.activeFrameIdx, state.frames.length - 1);
    const frame = state.frames[state.activeFrameIdx];
    state.layers = frame.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity, data: cloneImageData(l.data),
    }));
    state.activeLayerIdx = Math.min(state.activeLayerIdx, state.layers.length - 1);
    renderLayers();
    compositeAndDraw();
    renderFrames();
}

function duplicateFrame() {
    saveFrameState();
    const src = state.frames[state.activeFrameIdx];
    const dup = { layers: src.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity, data: cloneImageData(l.data),
    }))};
    state.frames.splice(state.activeFrameIdx + 1, 0, dup);
    state.activeFrameIdx++;
    const frame = state.frames[state.activeFrameIdx];
    state.layers = frame.layers.map(l => ({
        name: l.name, visible: l.visible, opacity: l.opacity, data: cloneImageData(l.data),
    }));
    renderLayers();
    compositeAndDraw();
    renderFrames();
}

function renderFrames() {
    const list = $('#frame-list');
    list.innerHTML = '';
    for (let i = 0; i < state.frames.length; i++) {
        const frame = state.frames[i];
        const thumb = document.createElement('canvas');
        thumb.className = 'frame-thumb' + (i === state.activeFrameIdx ? ' active' : '');
        thumb.width = 48; thumb.height = 48;
        thumb.title = 'Frame ' + (i + 1);
        const tCtx = thumb.getContext('2d');
        tCtx.imageSmoothingEnabled = false;
        // Composite frame layers
        const tmpC = document.createElement('canvas');
        tmpC.width = state.canvasSize; tmpC.height = state.canvasSize;
        const tmpCtx = tmpC.getContext('2d');
        for (let j = frame.layers.length - 1; j >= 0; j--) {
            const l = frame.layers[j];
            if (!l.visible) continue;
            const lc = document.createElement('canvas');
            lc.width = state.canvasSize; lc.height = state.canvasSize;
            lc.getContext('2d').putImageData(l.data, 0, 0);
            tmpCtx.globalAlpha = l.opacity / 100;
            tmpCtx.drawImage(lc, 0, 0);
        }
        tmpCtx.globalAlpha = 1;
        tCtx.drawImage(tmpC, 0, 0, 48, 48);
        thumb.addEventListener('click', () => {
            loadFrameState(i);
            renderFrames();
        });
        list.appendChild(thumb);
    }
}

// ============================================================
// Animation Playback
// ============================================================
function togglePlay() {
    if (state.isPlaying) {
        stopPlay();
    } else {
        startPlay();
    }
}

function startPlay() {
    if (state.frames.length < 2) return;
    state.isPlaying = true;
    $('#btn-play i').className = 'fas fa-pause';
    saveFrameState();
    playNextFrame();
}

function stopPlay() {
    state.isPlaying = false;
    $('#btn-play i').className = 'fas fa-play';
    if (state.animTimer) { clearTimeout(state.animTimer); state.animTimer = null; }
}

function playNextFrame() {
    if (!state.isPlaying) return;
    const previewCanvas = $('#animation-preview');
    const pCtx = previewCanvas.getContext('2d');
    pCtx.imageSmoothingEnabled = false;
    pCtx.clearRect(0, 0, 64, 64);

    const frame = state.frames[state.activeFrameIdx];
    const size = state.canvasSize;
    const tmpC = document.createElement('canvas');
    tmpC.width = size; tmpC.height = size;
    const tmpCtx = tmpC.getContext('2d');
    for (let j = frame.layers.length - 1; j >= 0; j--) {
        const l = frame.layers[j];
        if (!l.visible) continue;
        const lc = document.createElement('canvas');
        lc.width = size; lc.height = size;
        lc.getContext('2d').putImageData(l.data, 0, 0);
        tmpCtx.globalAlpha = l.opacity / 100;
        tmpCtx.drawImage(lc, 0, 0);
    }
    tmpCtx.globalAlpha = 1;
    pCtx.drawImage(tmpC, 0, 0, 64, 64);

    // Highlight current frame
    $$('.frame-thumb').forEach((el, idx) => el.classList.toggle('active', idx === state.activeFrameIdx));

    const nextIdx = (state.activeFrameIdx + 1) % state.frames.length;
    state.activeFrameIdx = nextIdx;

    state.animTimer = setTimeout(playNextFrame, 1000 / state.fps);
}

// ============================================================
// Export
// ============================================================
function exportPNG() {
    saveFrameState();
    const size = state.canvasSize;
    const tmpC = document.createElement('canvas');
    tmpC.width = size; tmpC.height = size;
    const tmpCtx = tmpC.getContext('2d');
    for (let i = state.layers.length - 1; i >= 0; i--) {
        const l = state.layers[i];
        if (!l.visible) continue;
        const lc = document.createElement('canvas');
        lc.width = size; lc.height = size;
        lc.getContext('2d').putImageData(l.data, 0, 0);
        tmpCtx.globalAlpha = l.opacity / 100;
        tmpCtx.drawImage(lc, 0, 0);
    }
    tmpCtx.globalAlpha = 1;
    const link = document.createElement('a');
    link.download = 'pixel-art.png';
    link.href = tmpC.toDataURL('image/png');
    link.click();
}

function exportGIF() {
    saveFrameState();
    const size = state.canvasSize;
    const encoder = new GIFEncoder(size, size);
    encoder.setDelay(Math.round(1000 / state.fps));

    for (const frame of state.frames) {
        const tmpC = document.createElement('canvas');
        tmpC.width = size; tmpC.height = size;
        const tmpCtx = tmpC.getContext('2d');
        // White background for GIF
        tmpCtx.fillStyle = '#ffffff';
        tmpCtx.fillRect(0, 0, size, size);
        for (let j = frame.layers.length - 1; j >= 0; j--) {
            const l = frame.layers[j];
            if (!l.visible) continue;
            const lc = document.createElement('canvas');
            lc.width = size; lc.height = size;
            lc.getContext('2d').putImageData(l.data, 0, 0);
            tmpCtx.globalAlpha = l.opacity / 100;
            tmpCtx.drawImage(lc, 0, 0);
        }
        tmpCtx.globalAlpha = 1;
        const imgData = tmpCtx.getImageData(0, 0, size, size);
        encoder.addFrame(imgData.data);
    }

    const gifData = encoder.encode();
    const blob = new Blob([gifData], { type: 'image/gif' });
    const link = document.createElement('a');
    link.download = 'pixel-art.gif';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}

// ============================================================
// Canvas Mouse Events
// ============================================================
function onCanvasMouseDown(e) {
    e.preventDefault();
    const [x, y] = getPixelCoords(e);
    state.isDrawing = true;
    state.startX = x;
    state.startY = y;
    state.lastX = x;
    state.lastY = y;

    const layer = state.layers[state.activeLayerIdx];
    const tool = state.currentTool;

    if (tool === 'eyedropper') {
        pickColor(x, y);
        state.isDrawing = false;
        return;
    }

    if (tool === 'fill') {
        pushUndo();
        floodFill(layer.data, x, y, state.currentColor, state.opacity);
        compositeAndDraw();
        renderLayers();
        state.isDrawing = false;
        return;
    }

    if (tool === 'pencil' || tool === 'eraser') {
        pushUndo();
        drawBrush(layer.data, x, y, tool);
        compositeAndDraw();
        renderLayers();
    }

    if (tool === 'move') {
        state.moveOffsetX = 0;
        state.moveOffsetY = 0;
    }

    if (['line', 'rect', 'circle'].includes(tool)) {
        pushUndo();
    }
}

function onCanvasMouseMove(e) {
    if (!state.isDrawing) return;
    const [x, y] = getPixelCoords(e);
    const layer = state.layers[state.activeLayerIdx];
    const tool = state.currentTool;

    if (tool === 'pencil' || tool === 'eraser') {
        drawLineOnData(layer.data, state.lastX, state.lastY, x, y, tool);
        state.lastX = x;
        state.lastY = y;
        compositeAndDraw();
        renderLayers();
    }

    if (['line', 'rect', 'circle'].includes(tool)) {
        // Preview on previewCanvas
        previewCtx.clearRect(0, 0, state.canvasSize, state.canvasSize);
        const tmpData = cloneImageData(layer.data);
        if (tool === 'line') {
            drawLineOnData(tmpData, state.startX, state.startY, x, y, 'pencil');
        } else if (tool === 'rect') {
            drawRectOnData(tmpData, state.startX, state.startY, x, y, 'pencil');
        } else if (tool === 'circle') {
            const cx = Math.round((state.startX + x) / 2);
            const cy = Math.round((state.startY + y) / 2);
            const rx = Math.abs(x - state.startX) / 2;
            const ry = Math.abs(y - state.startY) / 2;
            drawEllipseOnData(tmpData, cx, cy, Math.round(rx), Math.round(ry), 'pencil');
        }
        // Draw preview
        const tmpC = document.createElement('canvas');
        tmpC.width = state.canvasSize; tmpC.height = state.canvasSize;
        tmpC.getContext('2d').putImageData(tmpData, 0, 0);
        previewCtx.drawImage(tmpC, 0, 0);
    }

    if (tool === 'move') {
        const dx = x - state.startX;
        const dy = y - state.startY;
        if (dx !== state.moveOffsetX || dy !== state.moveOffsetY) {
            // Restore from undo and apply offset
            const snap = state.undoStack[state.undoStack.length - 1];
            if (snap) {
                const srcData = snap.layers[state.activeLayerIdx].data;
                const size = state.canvasSize;
                const newData = new ImageData(size, size);
                for (let py = 0; py < size; py++) {
                    for (let px = 0; px < size; px++) {
                        const sx = px - dx, sy = py - dy;
                        if (sx >= 0 && sx < size && sy >= 0 && sy < size) {
                            const si = (sy * size + sx) * 4;
                            const di = (py * size + px) * 4;
                            newData.data[di] = srcData.data[si];
                            newData.data[di+1] = srcData.data[si+1];
                            newData.data[di+2] = srcData.data[si+2];
                            newData.data[di+3] = srcData.data[si+3];
                        }
                    }
                }
                layer.data = newData;
                state.moveOffsetX = dx;
                state.moveOffsetY = dy;
                compositeAndDraw();
                renderLayers();
            }
        }
    }
}

function onCanvasMouseUp(e) {
    if (!state.isDrawing) return;
    const [x, y] = getPixelCoords(e);
    const layer = state.layers[state.activeLayerIdx];
    const tool = state.currentTool;

    if (['line', 'rect', 'circle'].includes(tool)) {
        previewCtx.clearRect(0, 0, state.canvasSize, state.canvasSize);
        if (tool === 'line') {
            drawLineOnData(layer.data, state.startX, state.startY, x, y, 'pencil');
        } else if (tool === 'rect') {
            drawRectOnData(layer.data, state.startX, state.startY, x, y, 'pencil');
        } else if (tool === 'circle') {
            const cx = Math.round((state.startX + x) / 2);
            const cy = Math.round((state.startY + y) / 2);
            const rx = Math.abs(x - state.startX) / 2;
            const ry = Math.abs(y - state.startY) / 2;
            drawEllipseOnData(layer.data, cx, cy, Math.round(rx), Math.round(ry), 'pencil');
        }
        compositeAndDraw();
        renderLayers();
    }

    state.isDrawing = false;
}

function pickColor(x, y) {
    // Pick from composite
    const size = state.canvasSize;
    const tmpC = document.createElement('canvas');
    tmpC.width = size; tmpC.height = size;
    const tmpCtx = tmpC.getContext('2d');
    for (let i = state.layers.length - 1; i >= 0; i--) {
        const l = state.layers[i];
        if (!l.visible) continue;
        const lc = document.createElement('canvas');
        lc.width = size; lc.height = size;
        lc.getContext('2d').putImageData(l.data, 0, 0);
        tmpCtx.globalAlpha = l.opacity / 100;
        tmpCtx.drawImage(lc, 0, 0);
    }
    tmpCtx.globalAlpha = 1;
    const pixel = tmpCtx.getImageData(x, y, 1, 1).data;
    if (pixel[3] > 0) {
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        state.currentColor = hex;
        $('#color-picker').value = hex;
        $('#color-hex').value = hex;
        updateColorPreview();
        highlightPaletteColor();
    }
    // Switch back to pencil
    state.currentTool = 'pencil';
    $$('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'pencil'));
}

// ============================================================
// Event Bindings
// ============================================================
function bindEvents() {
    // Canvas events
    canvasWrapper.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);

    // Touch support
    canvasWrapper.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        onCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
    });
    window.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        onCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    });
    window.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        onCanvasMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
    });

    // Tools
    $$('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentTool = btn.dataset.tool;
            $$('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Brush size
    $('#brush-size').addEventListener('input', (e) => {
        state.brushSize = parseInt(e.target.value);
        $('#brush-size-label').textContent = state.brushSize + 'px';
    });

    // Opacity
    $('#opacity').addEventListener('input', (e) => {
        state.opacity = parseInt(e.target.value);
        $('#opacity-label').textContent = state.opacity + '%';
    });

    // Color picker
    $('#color-picker').addEventListener('input', (e) => {
        state.currentColor = e.target.value;
        $('#color-hex').value = e.target.value;
        updateColorPreview();
        highlightPaletteColor();
    });

    $('#color-hex').addEventListener('change', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            state.currentColor = val;
            $('#color-picker').value = val;
            updateColorPreview();
            highlightPaletteColor();
        }
    });

    // Canvas size
    $('#canvas-size').addEventListener('change', (e) => {
        state.canvasSize = parseInt(e.target.value);
        state.layers = [];
        state.frames = [];
        state.activeLayerIdx = 0;
        state.activeFrameIdx = 0;
        state.undoStack = [];
        state.redoStack = [];
        setupCanvas();
        addLayer('Layer 1');
        saveFrameState();
        renderLayers();
        renderFrames();
        fitZoom();
    });

    // Top buttons
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-redo').addEventListener('click', redo);
    $('#btn-clear').addEventListener('click', () => {
        pushUndo();
        const size = state.canvasSize;
        state.layers[state.activeLayerIdx].data = new ImageData(size, size);
        compositeAndDraw();
        renderLayers();
    });
    $('#btn-grid-toggle').addEventListener('click', () => {
        state.showGrid = !state.showGrid;
        drawGrid();
    });
    $('#btn-export-png').addEventListener('click', exportPNG);
    $('#btn-export-gif').addEventListener('click', exportGIF);

    // Layer buttons
    $('#btn-add-layer').addEventListener('click', () => { pushUndo(); addLayer(); });
    $('#btn-delete-layer').addEventListener('click', deleteLayer);
    $('#btn-merge-down').addEventListener('click', mergeDown);
    $('#btn-duplicate-layer').addEventListener('click', duplicateLayer);

    // Frame buttons
    $('#btn-add-frame').addEventListener('click', addFrame);
    $('#btn-delete-frame').addEventListener('click', deleteFrame);
    $('#btn-duplicate-frame').addEventListener('click', duplicateFrame);
    $('#btn-play').addEventListener('click', togglePlay);

    // FPS
    $('#fps').addEventListener('change', (e) => {
        state.fps = Math.max(1, Math.min(60, parseInt(e.target.value) || 8));
        e.target.value = state.fps;
    });

    // Zoom
    $('#zoom-in').addEventListener('click', () => {
        state.zoom = Math.min(state.zoom + Math.max(1, Math.floor(state.zoom * 0.25)), 64);
        updateCanvasDisplay();
    });
    $('#zoom-out').addEventListener('click', () => {
        state.zoom = Math.max(1, state.zoom - Math.max(1, Math.floor(state.zoom * 0.25)));
        updateCanvasDisplay();
    });
    $('#zoom-fit').addEventListener('click', fitZoom);

    // Mouse wheel zoom
    canvasWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            state.zoom = Math.min(state.zoom + Math.max(1, Math.floor(state.zoom * 0.15)), 64);
        } else {
            state.zoom = Math.max(1, state.zoom - Math.max(1, Math.floor(state.zoom * 0.15)));
        }
        updateCanvasDisplay();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
            if (key === 'z') { e.preventDefault(); undo(); }
            if (key === 'y') { e.preventDefault(); redo(); }
            return;
        }
        const toolMap = { b: 'pencil', e: 'eraser', g: 'fill', i: 'eyedropper', l: 'line', r: 'rect', c: 'circle', v: 'move' };
        if (toolMap[key]) {
            state.currentTool = toolMap[key];
            $$('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === toolMap[key]));
        }
    });

    // Window resize
    window.addEventListener('resize', () => {
        fitZoom();
    });
}

// ============================================================
// Start
// ============================================================
document.addEventListener('DOMContentLoaded', init);
