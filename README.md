# Inhouse Recorder

A local-first, collaborative screen recording desktop application designed for macOS (optimized for Apple Silicon). **Inhouse Recorder** allows you to record your screen, webcam, and audio, and host collaborative recording rooms where other participants can join and stream their cameras and screens directly into your recording session. All recordings are stored locally on your machine with zero restrictions.

---

## Key Features

1. **Dashboard & Library**:
   - Manage your past recordings in a responsive grid.
   - Built-in custom playback overlay.
   - Download/export recordings to any folder on your machine or show them in Finder.
   - Device preferences settings: resolution adjustments (1080p/720p) and frame rates (30/60 FPS).
2. **Camera Floating Bubble**:
   - Circular borderless web camera overlay.
   - Fully draggable to any screen coordinate.
   - Quick-toggle sizes (S/M/L) and mirror filters.
3. **Collaboration Rooms**:
   - Host collaborative recording rooms over the local network.
   - Share invitation links to let remote/network guests join via web browsers.
   - Capture guest webcams and screen shares directly inside your local recording container.
4. **Recording Controller Pill**:
   - Sleek glassmorphic pill overlay containing live recording states and duration timers.
   - Live frequency-based sound wave visualizer analyzing microphone inputs.
   - Actions to Pause/Resume, Mute Mic, Toggle Camera, Finish & Save, or Cancel.

---

## Tech Stack & Architecture

- **Shell Framework**: Electron (Desktop Integration, Multi-window overlay coordinates)
- **Frontend Logic**: Vanilla HTML5, CSS3, and ES6 Javascript
- **Signal Broker**: Built-in HTTP & WebSocket Server (`ws`)
- **Streaming Pipeline**: WebRTC PeerConnection streams for cameras and screen captures, compiled locally via the `MediaRecorder` API.
- **Local Playback**: Safe custom `video-stream://` protocol integration serving local files.

---

## Installation & Setup

### Prerequisites
- macOS (Apple Silicon `arm64`)
- Node.js (v18+) & npm

### Development Launch
1. Clone the repository to your local computer.
2. Navigate to the project root directory and install dependencies:
   ```bash
   npm install
   ```
3. Run the application:
   ```bash
   npm start
   ```

### Packaging & Compilation
To compile the application into a standalone `.dmg` installer for Apple Silicon Macs, run:
```bash
npm run dist
```
This generates the installation bundle inside the `dist/` directory.

---

## macOS Permission Configuration
On first launch, the application will prompt you for macOS system permissions:
- **Screen Recording**: Required to capture your display or selected window.
- **Camera**: Required to display the camera bubble.
- **Microphone**: Required to record voice overlays and display the live sound wave indicator.

For guest browser users joining a collaborative room, standard browser media access prompts must be accepted.
