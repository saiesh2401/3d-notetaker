import * as BABYLON from "@babylonjs/core";

export class TaskNode {
    public mesh: BABYLON.Mesh;
    public material: BABYLON.StandardMaterial;
    public priority: number;
    private scene: BABYLON.Scene;
    private time: number = 0;
    public physicsBody?: BABYLON.PhysicsBody;

    constructor(name: string, position: BABYLON.Vector3, priority: number, scene: BABYLON.Scene) {
        this.scene = scene;
        this.priority = priority;

        // Mesh: A low-poly sphere
        this.mesh = BABYLON.MeshBuilder.CreateSphere(name, { segments: 8, diameter: 2 }, scene);
        this.mesh.position = position;

        // Material: Emissive material driven by priority
        this.material = new BABYLON.StandardMaterial(`${name}_mat`, scene);
        this.material.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        // Base emissive color (e.g., Animus cyan/blue)
        const baseColor = new BABYLON.Color3(0.0, 0.8, 1.0);
        this.material.emissiveColor = baseColor.scale(this.priority);
        this.mesh.material = this.material;

        // Setup physics body for force-directed layout (using Havok Physics engine)
        if (scene.isPhysicsEnabled()) {
            const shape = new BABYLON.PhysicsShapeSphere(new BABYLON.Vector3(0, 0, 0), 1, scene);
            this.physicsBody = new BABYLON.PhysicsBody(this.mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
            this.physicsBody.shape = shape;
            this.physicsBody.setMassProperties({ mass: 1 });
        }

        // Behavior: Nodes should gently "pulse" using a Sine wave on the emissiveColor
        scene.onBeforeRenderObservable.add(() => {
            this.time += scene.getEngine().getDeltaTime() * 0.001;
            // Pulse between 0.5 and 1.0 intensity based on priority
            const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.0);
            this.material.emissiveColor = baseColor.scale(this.priority * pulse);
        });

        /*
         * Implementation Advice (Engineers):
         * For the "Glitch" (Overdue) effect, apply a Node Material Editor (NME)
         * shader here that displaces vertices based on a noise texture instead 
         * of modifying mesh vertex data directly for performance.
         */
    }
}

/**
 * Creates and dynamically updates a GreasedLine between two TaskNodes.
 */
export function DataThread(nodeA: TaskNode, nodeB: TaskNode, scene: BABYLON.Scene) {
    const points = [nodeA.mesh.position, nodeB.mesh.position];

    // Create the GreasedLine between two points
    // Note: babylonjs uses CreateGreasedLine instead of GreasedLineMeshBuilder in modern v6+ versions
    const line = BABYLON.CreateGreasedLine(
        `thread_${nodeA.mesh.name}_${nodeB.mesh.name}`,
        { points: points, updatable: true },
        {
            width: 0.1,
            color: new BABYLON.Color3(0.5, 0.5, 1.0)
        },
        scene
    );

    // Update line dynamically if a node is moved
    scene.onBeforeRenderObservable.add(() => {
        const updatedPoints = [nodeA.mesh.position, nodeB.mesh.position];
        BABYLON.CreateGreasedLine(
            `thread_${nodeA.mesh.name}_${nodeB.mesh.name}`,
            { points: updatedPoints, instance: line },
            undefined, // Material options not needed for update
            scene
        );

        // Force-Directed Layout: Havok Physics attract logic between connected nodes
        // Alternatively, you can use Physics6DoFConstraint, but a generic applyForce approach provides
        // "springy" constellations dynamically.
        if (nodeA.physicsBody && nodeB.physicsBody) {
            const dir = nodeB.mesh.position.subtract(nodeA.mesh.position);
            const dist = dir.length();
            const restLength = 5.0; // desired distance between nodes
            const springK = 0.5; // Spring constant

            if (dist > 0.01) {
                const forceMag = (dist - restLength) * springK;
                const force = dir.normalize().scale(forceMag);
                nodeA.physicsBody.applyForce(force, nodeA.mesh.position);
                nodeB.physicsBody.applyForce(force.scale(-1), nodeB.mesh.position);
            }
        }
    });

    return line;
}
