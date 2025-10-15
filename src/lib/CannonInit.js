import {
    Body,
    ContactMaterial,
    Cylinder,
    GSSolver,
    Material,
    Plane,
    Sphere,
    SplitSolver,
    Vec3,
    World,
    Quaternion as CannonQuaternion
} from "cannon-es";
import {Euler, Quaternion as ThreeQuaternion} from "three";

export default class CannonInit {
    constructor(threeQuaternion = new ThreeQuaternion) {
        this.world = undefined;
        this.timeStep = 1 / 120;
        this.rigidBody = undefined;
        this.physicsMaterial = undefined;
        this.keyPressed = {};
        this.canJump = true;
        this.threeQuaternion = threeQuaternion;
        this.canMoveCharacter = false;
        this.isGamePaused = false;
    }

    initialize() {
        this.setupWorld();
        this.setupInputHandler();
        this.createGround();
        this.createKinematicCharacter();
        this.startSimulation();
    }

    setupWorld() {
        this.world = new World()

        // Tweak contact properties.
        // Contact stiffness - use to make softer/harder contacts
        this.world.defaultContactMaterial.contactEquationStiffness = 1e9

        // Stabilization time in number of time steps
        this.world.defaultContactMaterial.contactEquationRelaxation = 4

        const solver = new GSSolver()
        solver.iterations = 7
        solver.tolerance = 0.1
        this.world.solver = new SplitSolver(solver)
        // use this to test non-split solver
        // world.solver = solver

        // The player might use kinematic movement but the rest should still use cannon-es physics
        this.world.gravity.set(0, -40, 0)

        this.physicsMaterial = new Material('physics')
        const physics_physics = new ContactMaterial(this.physicsMaterial, this.physicsMaterial, {
            friction: 0.0,
            restitution: 0.0,
        })

        // We must add the contact materials to the world
        this.world.addContactMaterial(physics_physics)
    }

    setupInputHandler() {
        window.addEventListener('keydown', (event) => {
            this.keyPressed[event.key] = true;
        });

        window.addEventListener('keyup', (event) => {
            this.keyPressed[event.key] = false;
        });

    }

    createGround() {
        const groundShape = new Plane()
        const groundBody = new Body({ mass: 0, material: this.physicsMaterial })
        groundBody.addShape(groundShape)
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
        this.world.addBody(groundBody)
    }

    createKinematicCharacter(){
        const radius = 0.5; // Radius of the capsule
        const height = 2; // Height of the capsule (excluding the hemispheres)
        this.rigidBody = this.createCapsule(radius, height);

        this.rigidBody.position.set(-2, 1.5, 15)
        this.rigidBody.linearDamping = 0.9
        this.rigidBody.angularDamping = 0.9
        this.world.addBody(this.rigidBody)

        const contactNormal = new Vec3() // Normal in the contact, pointing *out* of whatever the player touched
        const upAxis = new Vec3(0, 1, 0)
        // Collide event checks if player is touching the ground
        this.rigidBody.addEventListener('collide', (event) => {
            const { contact } = event

            // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
            // We do not yet know which one is which! Let's check.
            if (contact.bi.id === this.rigidBody.id) {
                // bi is the player body, flip the contact normal
                contact.ni.negate(contactNormal)
            } else {
                // bi is something else. Keep the normal as it is
                contactNormal.copy(contact.ni)
            }

            // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
            if (contactNormal.dot(upAxis) > 0.5) {
                // Use a "good" threshold value between 0 and 1 here!
                this.canJump = true
            }
        })
    }

    createCapsule(radius, cylinderHeight) {
        const capsuleBody = new Body({
            mass: 1, // We use kinematic movement but still want to use all other physics
            fixedRotation: true // Always keep the player straight. So it does not fall/rotate after receiving force from another object.
        });

        // Add the cylinder part
        const cylinderShape = new Cylinder(radius, radius, cylinderHeight, 8);
        const cylinderQuaternion = new CannonQuaternion();
        cylinderQuaternion.setFromAxisAngle(new Vec3(0, 0, 0), Math.PI / 2); // Rotate to align with Y-axis
        capsuleBody.addShape(cylinderShape, new Vec3(0, 0, 0), cylinderQuaternion);

        // Add the top sphere
        const topSphere = new Sphere(radius);
        capsuleBody.addShape(topSphere, new Vec3(0, cylinderHeight / 2, 0));

        // Add the bottom sphere
        const bottomSphere = new Sphere(radius);
        capsuleBody.addShape(bottomSphere, new Vec3(0, -cylinderHeight / 2, 0));

        return capsuleBody;
    }

    startSimulation() {
        const movementSpeed = 0.1; // Movement speed

        // Simulation loop
        const simulate = () => {
            // Movement vector based on input
            const movement = new Vec3();

            if(this.canMoveCharacter){
                // Apply input-based movement (only when keys are pressed)
                if (this.keyPressed["w"]) movement.z -= movementSpeed; // Forward
                if (this.keyPressed["s"]) movement.z += movementSpeed; // Backward
                if (this.keyPressed["a"]) movement.x -= movementSpeed; // Left
                if (this.keyPressed["d"]) movement.x += movementSpeed; // Right
                if (this.keyPressed[" "]) {
                    if(this.canJump){
                        this.rigidBody.velocity.y += 24;
                        this.canJump = false;
                    }
                }
            }


            // Move the character and normalize
            if (movement.length() > 0) {
                movement.normalize();
                movement.scale(movementSpeed, movement); // Scale to the correct speed
            }

            // 1. Extract only the Yaw (horizontal rotation) from threeQuaternion
            const euler = new Euler();
            euler.setFromQuaternion(this.threeQuaternion, 'YXZ'); // 'YXZ' order ensures correct yaw extraction

            const yawQuaternion = new ThreeQuaternion();
            yawQuaternion.setFromEuler(new Euler(0, euler.y, 0)); // Keep only Yaw rotation

            // 2. Convert the new Yaw-only quaternion to CANNON.Quaternion
            const cannonQuaternion = new CannonQuaternion(yawQuaternion.x, yawQuaternion.y, yawQuaternion.z, yawQuaternion.w);

            // 3. Rotate movement vector using only the yaw rotation
            const rotatedMovement = new Vec3();

            // Quaternion is applied on the first parameter.
            // The result is stored in the second parameter.
            cannonQuaternion.vmult(movement, rotatedMovement); // Apply only yaw rotation

            // 4. Apply to physics body position
            this.rigidBody.position.vadd(rotatedMovement, this.rigidBody.position);

            // Step the physics world
            if(this.isGamePaused) this.world.step(this.timeStep);

            // Repeat simulation
            requestAnimationFrame(simulate);
        };

        simulate();
    }
}