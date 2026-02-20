import * as BABYLON from "@babylonjs/core";
import { HandTracker } from "./handTracker.js";
import { TaskNode, DataThread } from "./taskNode.js";

export class AnimusSpace {
    private engine: BABYLON.Engine;
    private scene: BABYLON.Scene;
    private camera!: BABYLON.ArcRotateCamera;
    private handTracker!: HandTracker;
    private draggedNode: TaskNode | null = null;
    private nodes: TaskNode[] = [];

    constructor(canvas: HTMLCanvasElement, videoElement: HTMLVideoElement) {
        this.engine = new BABYLON.Engine(canvas, true);
        this.scene = new BABYLON.Scene(this.engine);

        this.initEnvironment();
        this.initPhysics();
        this.initInteraction(videoElement);
        this.spawnConstellation();

        this.engine.runRenderLoop(() => {
            this.scene.render();

            // Interaction: Parent or target the TaskNode via Lerp to allow dragging
            if (this.draggedNode) {
                this.draggedNode.mesh.position = BABYLON.Vector3.Lerp(
                    this.draggedNode.mesh.position,
                    this.handTracker.reticle.position,
                    0.2
                );
                // Zero-out physics while dragging so Havok doesn't pull it out of hand
                if (this.draggedNode.physicsBody) {
                    this.draggedNode.physicsBody.setLinearVelocity(BABYLON.Vector3.Zero());
                    this.draggedNode.physicsBody.setAngularVelocity(BABYLON.Vector3.Zero());
                }
            }
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private initEnvironment() {
        // Environment & Aesthetics: #050505 clear color
        this.scene.clearColor = BABYLON.Color4.FromHexString("#050505FF");

        // Camera setup - Using an orbital camera for better 3D map viewing
        this.camera = new BABYLON.ArcRotateCamera("mainCam", Math.PI / 2, Math.PI / 2, 20, BABYLON.Vector3.Zero(), this.scene);
        this.camera.attachControl(this.engine.getRenderingCanvas(), true);

        // Settings for smoother orbital controls
        this.camera.wheelPrecision = 50;
        this.camera.minZ = 0.1;

        // Fixing inverted rotation controls
        this.camera.angularSensibilityX = -1000;
        this.camera.angularSensibilityY = -1000;

        const hemiLight = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        hemiLight.intensity = 0.3;

        // GlowLayer
        const glowLayer = new BABYLON.GlowLayer("glow", this.scene);
        glowLayer.intensity = 1.2;

        // DefaultRenderingPipeline with Bloom enabled
        const pipeline = new BABYLON.DefaultRenderingPipeline("pipeline", true, this.scene, [this.camera]);
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.6;
        pipeline.bloomWeight = 0.8;

        // Subtle ParticleSystem to simulate "ambient dust"
        const particleSystem = new BABYLON.ParticleSystem("dust", 2000, this.scene);
        // Removed particleTexture to avoid 404, fallback to default texture

        const emitter = new BABYLON.BoxParticleEmitter();
        emitter.direction1 = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        emitter.direction2 = new BABYLON.Vector3(0.1, 0.1, 0.1);
        emitter.minEmitBox = new BABYLON.Vector3(-20, -20, -20);
        emitter.maxEmitBox = new BABYLON.Vector3(20, 20, 20);

        particleSystem.particleEmitterType = emitter;
        particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 0.2);
        particleSystem.color2 = new BABYLON.Color4(1, 1, 1, 0.1);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        particleSystem.minSize = 0.05;
        particleSystem.maxSize = 0.15;
        particleSystem.minLifeTime = 2.0;
        particleSystem.maxLifeTime = 5.0;
        particleSystem.emitRate = 100;
        particleSystem.start();
    }

    private initPhysics() {
        // Assume HavokPhysics is loaded in scope context
        // const havokInstance = await HavokPhysics();
        // const hk = new BABYLON.HavokPlugin(true, havokInstance);
        // Zero gravity for space layout
        // this.scene.enablePhysics(new BABYLON.Vector3(0, 0, 0), hk); 
    }

    private initInteraction(videoElement: HTMLVideoElement) {
        this.handTracker = new HandTracker(this.scene, this.camera, videoElement);

        // Interaction (The Bridge)
        this.handTracker.onPinchStart.add(() => {
            // Raycaster that shoots from the camera through the Reticle
            const ray = BABYLON.Ray.CreateNewFromTo(
                this.camera.position,
                this.handTracker.reticle.position
            );

            // If ON_PINCH_START is active and a TaskNode is hit
            const hit = this.scene.pickWithRay(ray, (mesh) => mesh.name.startsWith("TaskNode"));
            if (hit && hit.pickedMesh) {
                this.draggedNode = this.nodes.find(n => n.mesh === hit.pickedMesh) || null;
            }
        });

        this.handTracker.onPinchEnd.add(() => {
            if (this.draggedNode) {
                // When PINCH_END occurs, release the node
                // Trigger a force-directed update to settle the constellation
                if (this.draggedNode.physicsBody) {
                    // Slight physical nudge allows Havok to settle it smoothly 
                    // alongside the spring forces applied in DataThread
                    this.draggedNode.physicsBody.applyImpulse(
                        new BABYLON.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
                        this.draggedNode.mesh.absolutePosition
                    );
                }
                this.draggedNode = null;
            }
        });
    }

    private spawnConstellation() {
        // Initial setup for demonstration
        const node1 = new TaskNode("TaskNode_1", new BABYLON.Vector3(-4, 2, 0), 1.0, this.scene);
        const node2 = new TaskNode("TaskNode_2", new BABYLON.Vector3(4, -2, 0), 0.8, this.scene);
        const node3 = new TaskNode("TaskNode_3", new BABYLON.Vector3(0, 5, 2), 0.6, this.scene);

        this.nodes.push(node1, node2, node3);

        // DataThread function updates dynamically
        DataThread(node1, node2, this.scene);
        DataThread(node2, node3, this.scene);
    }
}
