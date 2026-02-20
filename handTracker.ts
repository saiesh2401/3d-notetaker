import * as BABYLON from "@babylonjs/core";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * Smoothing (Crucial): Low-Pass Filter (Exponential Moving Average) 
 * or alternatively a 1-Euro Filter to reduce MediaPipe noise/jitter, 
 * maintaining the "premium" Animus feel.
 */
class LowPassFilter {
    private alpha: number;
    private lastVal: BABYLON.Vector3 | null = null;

    constructor(alpha: number = 0.15) {
        this.alpha = alpha; // 0 < alpha <= 1 (lower = smoother but more lagish)
    }

    public filter(val: BABYLON.Vector3): BABYLON.Vector3 {
        if (!this.lastVal) {
            this.lastVal = val.clone();
            return val;
        }
        this.lastVal = BABYLON.Vector3.Lerp(this.lastVal, val, this.alpha);
        return this.lastVal;
    }
}

export class HandTracker {
    private scene: BABYLON.Scene;
    private camera: BABYLON.Camera;
    private handLandmarker!: HandLandmarker;
    public reticle: BABYLON.Mesh;
    private filter: LowPassFilter;

    // Custom Events
    public onPinchStart: BABYLON.Observable<void> = new BABYLON.Observable<void>();
    public onPinchEnd: BABYLON.Observable<void> = new BABYLON.Observable<void>();

    private isPinching: boolean = false;
    private videoElement: HTMLVideoElement;

    constructor(scene: BABYLON.Scene, camera: BABYLON.Camera, videoElement: HTMLVideoElement) {
        this.scene = scene;
        this.camera = camera;
        this.videoElement = videoElement;
        this.filter = new LowPassFilter(0.15); // Adjust for smoothness vs responsiveness

        // Map the Index Finger Tip (Landmark 8) to a small 3D "Reticle" mesh
        this.reticle = BABYLON.MeshBuilder.CreateSphere("reticle", { diameter: 0.05 }, scene);
        const reticleMat = new BABYLON.StandardMaterial("reticleMat", scene);
        reticleMat.emissiveColor = new BABYLON.Color3(1, 0, 0); // Temporary color for Reticle visibility
        this.reticle.material = reticleMat;

        this.initMediaPipe();
    }

    private async initMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        // Start tracking loop
        this.scene.onBeforeRenderObservable.add(() => this.detectHands());
    }

    private detectHands() {
        if (!this.handLandmarker || !this.videoElement || this.videoElement.readyState < 2) return;

        const startTimeMs = performance.now();
        const results = this.handLandmarker.detectForVideo(this.videoElement, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0 && results.landmarks[0]) {
            const hand = results.landmarks[0];
            const indexTip = hand[8]; // Index Finger Tip
            const thumbTip = hand[4]; // Thumb Tip

            this.updateReticlePosition(indexTip);
            this.checkPinchLogic(indexTip, thumbTip);
        }
    }

    private updateReticlePosition(indexTip: any) {
        const engine = this.scene.getEngine();

        // MediaPipe coords are 0.0-1.0. Invert X so moving hand left moves reticle left.
        const screenX = (1.0 - indexTip.x) * engine.getRenderWidth();
        const screenY = indexTip.y * engine.getRenderHeight();

        // Convert to 3D world space relative to the camera
        // Using Z = 0.999 keeps the reticle right in front of the camera instead of scaling weirdly
        const rawWorldPos = BABYLON.Vector3.Unproject(
            new BABYLON.Vector3(screenX, screenY, 0.999),
            engine.getRenderWidth(),
            engine.getRenderHeight(),
            BABYLON.Matrix.Identity(),
            this.camera.getViewMatrix(),
            this.camera.getProjectionMatrix()
        );

        // Apply Smoothing
        const smoothPos = this.filter.filter(rawWorldPos);
        this.reticle.position = smoothPos;
    }

    private checkPinchLogic(indexTip: any, thumbTip: any) {
        // Calculate the distance between Landmark 8 and Landmark 4 (Thumb)
        const dx = indexTip.x - thumbTip.x;
        const dy = indexTip.y - thumbTip.y;
        const dz = indexTip.z - thumbTip.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const PINCH_THRESHOLD = 0.03;

        // Fire custom ON_PINCH_START event
        if (distance < PINCH_THRESHOLD && !this.isPinching) {
            this.isPinching = true;
            this.onPinchStart.notifyObservers();
        }
        // Pinch End
        else if (distance >= PINCH_THRESHOLD && this.isPinching) {
            this.isPinching = false;
            this.onPinchEnd.notifyObservers();
        }
    }
}
