# Animus Space: 3D Notetaker

Tasks float as glowing nodes in a 3D space that you move **with your hands**. Your webcam tracks your hand, a pinch picks up a node, and when you let go the connected tasks settle back into a constellation.

## How it works

- **Hand tracking:** MediaPipe Tasks Vision finds hand landmarks in the webcam feed, and a low-pass filter smooths out the jitter (`handTracker.ts`).
- **Pinch to grab:** a ray from the camera through the on-screen reticle picks the task node it hits. A pinch grabs the node and drags it; releasing the pinch lets it go (`scene.ts`).
- **Task nodes and threads:** each task is a glowing node, and `DataThread` links related nodes with spring-like forces so the layout settles on its own (`taskNode.ts`).
- **Atmosphere:** Babylon.js with an orbital camera, a glow layer, bloom post-processing and ambient particles.

## Tech

TypeScript · Vite · Babylon.js 8 · MediaPipe Tasks Vision

## Run locally

```bash
npm install
npm run dev
```

Open the page and allow webcam access. Hold up one hand, point the reticle at a node, pinch to grab it, move it, then release.

## Project layout

```
index.ts        boots the webcam and the scene
scene.ts        AnimusSpace: camera, rendering, pinch interaction
handTracker.ts  MediaPipe hand landmarks + smoothing
taskNode.ts     TaskNode and DataThread
```

## Ideas

- Create and edit task text by voice
- Save and load constellations
- Turn on Havok physics (already stubbed in `scene.ts`)
