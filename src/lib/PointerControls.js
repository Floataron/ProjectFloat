import {Euler, EventDispatcher, Object3D, Quaternion} from "three";
import {Vec3} from "cannon-es";

/**
 * @author mrdoob / http://mrdoob.com/
 * @author schteppe / https://github.com/schteppe
 */
export default class PointerLockControlsCannon extends EventDispatcher {
    constructor(camera, cannonBody) {
        super()
        this.mouseMoveEnabled = false
        this.cannonBody = cannonBody
        // Pitch handles up and down rotation
        this.pitchObject = new Object3D()
        this.pitchObject.add(camera)
        // Yaw handles left and right rotation
        this.yawObject = new Object3D()
        // Set player height to 2
        this.yawObject.position.y = 2
        this.yawObject.add(this.pitchObject)
        // Quaternions prevent rotation issues like gimbal lock.
        this.quaternion = new Quaternion()
        // Moves the camera to the cannon.js object position and adds velocity to the object if the run key is down
        this.euler = new Euler()
        // Creates a temporary third person view for better debugging
        // Remove for first person camera!!!
        // camera.position.set(0, 1, 5);
        camera.position.set(0, 0.8, 0);
        this.connect()
    }

    // Adds all events listeners
    connect() {
        document.addEventListener('mousemove', this.onMouseMove)
    }

    // Removes all events listeners, as we don't want them while in the pause screen for example.
    disconnect() {
        document.removeEventListener('mousemove', this.onMouseMove)
    }

    dispose() {
        this.disconnect()
    }

    // Updates the camera on mouse movement
    onMouseMove = (event) => {
        if (!this.mouseMoveEnabled) {
            return
        }

        const { movementX, movementY } = event
        // Horizontal mouse movement adjusts the yaw object, which is responsible for horizontal rotation
        this.yawObject.rotation.y -= movementX * 0.002
        // Vertical mouse movement adjusts the pitch object, which is responsible for vertical rotation
        this.pitchObject.rotation.x -= movementY * 0.002
        // I THINK this makes sure we stop rotating vertically when looking all the way down or all the way up
        this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x))
    }

    getObject() {
        return this.yawObject
    }

    update(deltaTime) {
        if (this.mouseMoveEnabled === false) {
            return
        }

        const direction = new Vec3();

        direction.normalize();

        // Convert velocity to world coordinates
        this.euler.x = this.pitchObject.rotation.x // Up/down rotation
        this.euler.y = this.yawObject.rotation.y // Up/down rotation
        this.euler.order = 'XYZ' // Apply rotations in X, Y, Z order

        // Quaternions prevent rotation issues like gimbal lock.
        // The quaternion is derived from the Euler angles and is used to rotate the player’s movement vector.
        this.quaternion.setFromEuler(this.euler)

        this.yawObject.position.copy(this.cannonBody.position)
    }
}

