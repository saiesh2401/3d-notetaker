import { AnimusSpace } from "./scene.js";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const video = document.getElementById("webcam") as HTMLVideoElement;

// Initialize when the webcam is ready
async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        video.addEventListener("loadeddata", () => {
            // Give it a small delay to ensure video dimensions are ready
            setTimeout(() => {
                new AnimusSpace(canvas, video);
            }, 100);
        });
    } catch (err) {
        console.error("Failed to access webcam:", err);
        alert("Webcam access is required for hand tracking.");
    }
}

init();
