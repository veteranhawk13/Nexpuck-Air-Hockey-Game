# 🕹️ NexPuck

A retro pixel-art arcade air hockey game built with vanilla HTML, CSS, and JavaScript — complete with CRT scanlines, chunky pixel graphics, and an old-school arcade cabinet vibe.

![Made with HTML CSS JS](https://img.shields.io/badge/Made%20with-HTML%2FCSS%2FJS-yellow)

## 🎮 Features

- Retro arcade cabinet UI with scanlines, vignette, and pixel-font styling (Press Start 2P + VT323)
- Smooth canvas-based physics for puck and paddle movement
- CPU opponent with adjustable difficulty
- Score tracking, goal flash effects, and win/game-over overlays
- Pause/resume support (via button or `P` / `Esc`)
- Simple procedural sound effects and background music
- Fully responsive canvas that resizes with the window
- Touch support for mobile play

## 📂 Project Structure

```
nexpuck/
├── index.html   # Page markup
├── style.css    # Arcade cabinet & CRT styling
├── script.js    # Game logic, physics, AI, rendering
└── README.md
```

## 🚀 Getting Started

No build tools or dependencies required — it's plain HTML/CSS/JS.

1. Clone the repo:
   ```bash
   git clone https://github.com/<your-username>/nexpuck.git
   cd nexpuck
   ```
2. Open `index.html` in your browser (double-click it, or use a local server):
   ```bash
   npx serve .
   ```
3. Click **START** and play!

## 🕹️ Controls

| Action        | Input                          |
|---------------|---------------------------------|
| Move paddle   | Mouse / touch drag              |
| Pause / Resume| `P`, `Esc`, or Pause button     |
| Change difficulty | Difficulty button (before starting) |
| Restart       | Restart button                  |

## 🛠️ Built With

- HTML5 Canvas
- CSS3 (custom properties, animations)
- Vanilla JavaScript (no frameworks or libraries)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙌 Credits

Designed and developed as a retro arcade-style air hockey game — pixel art, CRT effects, and all.
