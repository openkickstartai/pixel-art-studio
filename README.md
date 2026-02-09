# 🎨 Pixel Art Studio

A feature-rich, browser-based pixel art editor. No build tools, no dependencies, no server required — just clone and open `index.html`.

![Pixel Art Studio](https://img.shields.io/badge/Made%20with-HTML%2FCSS%2FJS-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **Drawing Tools** — Pencil, Eraser, Fill Bucket, Eyedropper, Line, Rectangle, Circle, Move
- **Layer System** — Add, delete, duplicate, merge, toggle visibility, per-layer opacity
- **Animation Frames** — Create frame-by-frame animations with adjustable FPS and live preview
- **Color Palette** — 32-color PICO-8 inspired palette + full color picker + hex input
- **Export** — Save as PNG or animated GIF (pure JS, no external libraries)
- **Undo/Redo** — Full history with Ctrl+Z / Ctrl+Y
- **Zoom & Grid** — Mouse wheel zoom, fit-to-screen, toggleable pixel grid
- **Canvas Sizes** — 8×8, 16×16, 32×32, 64×64
- **Keyboard Shortcuts** — B (Pencil), E (Eraser), G (Fill), I (Eyedropper), L (Line), R (Rect), C (Circle), V (Move)
- **Touch Support** — Works on tablets and touch devices

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/pixel-art-studio.git
cd pixel-art-studio
# Just open index.html in your browser!
open index.html
# Or use any local server:
python3 -m http.server 8080
```

No `npm install`, no build step, no configuration. It just works.

## 📁 Project Structure

```
pixel-art-studio/
├── index.html          # Main entry point
├── css/
│   └── style.css       # All styles (dark theme)
├── js/
│   ├── app.js          # Core application logic
│   └── gif.js          # Lightweight GIF encoder
├── LICENSE
└── README.md
```

## 🎮 How to Use

1. **Select a tool** from the left toolbar (or use keyboard shortcuts)
2. **Pick a color** from the palette or use the color picker
3. **Draw** on the canvas
4. **Add layers** for complex artwork
5. **Create frames** for animations
6. **Export** your creation as PNG or GIF

## 🖼️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `B` | Pencil tool |
| `E` | Eraser tool |
| `G` | Fill bucket |
| `I` | Eyedropper |
| `L` | Line tool |
| `R` | Rectangle tool |
| `C` | Circle tool |
| `V` | Move tool |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## 📄 License

MIT License — feel free to use, modify, and distribute.

## 🤝 Contributing

Pull requests are welcome! Feel free to open issues for bugs or feature requests.
