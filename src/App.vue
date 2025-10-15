<template>
  <div v-show="isMenuHidden" class="fixed text-white text-xl right-0 w-32">
    {{ msToTime((time * 1000) - timeSinceStart) }}
  </div>
  <div v-show="!isMenuHidden" class="bg w-screen h-screen fixed bg-black opacity-90 flex items-center justify-center flex-col gap-4">
    <p class="text-white text-6xl mb-10">
      Project Float
    </p>
    <p class="text-white text-xl">Best times:</p>
    <div class="flex flex-col gap-1 max-h-24 overflow-auto">
      <p class="text-white text-xl" v-for="time in completionTimes">
        {{ msToTime(time) }}
      </p>
    </div>

    <button v-if="timeSincePause === 0" @click="initializeLevel()" class="opacity-1 bg-white h-10 w-20 rounded">
      Start
    </button>
    <button v-if="timeSincePause > 0 && threejsWorld" @click="lockCursor()" class="opacity-1 bg-white h-10 w-20 rounded">
      Resume
    </button>
    <button v-if="threejsWorld" @click="resetScene()" class="opacity-1 bg-white h-10 w-20 rounded">
      Reset
    </button>
  </div>
  <canvas id="myThreeJsCanvas" ref="threeJsCanvas" @dblclick="!threeJsCanvas.pointerLockElement ? threeJsCanvas.requestPointerLock() : undefined"></canvas>
</template>

<script setup>

import {ref} from "vue";
import ThreejsWorld from "./lib/ThreejsInit.js";
import PhysicsWorld from "./lib/CannonInit.js";
import PointerControls from './lib/PointerControls.js';
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
// import CannonDebugger from "cannon-es-debugger";
import {Box3, Vector3 as ThreeVector3} from "three";
import {Body, Box, Vec3 as CannonVec3} from "cannon-es";

// Game Variables
let threejsWorld;
let physicsWorld;
let controls;
let animationId;
const threeJsCanvas = ref(null);
const time = ref(0);
const timeSinceStart = ref(0);
const timeSinceResume = ref(0);
const timeSincePause = ref(0);
// Every level needs an endPointBody and a global binding is needed to detect which body should end the level;
let endPointBody;

const levelBoxes = [];
const levelMeshes = [];

// Vue Variables
const isMenuHidden = ref(false);
const completionTimes = ref([]);
let timedPointerLock;

// let cannonDebugger;

function initializeLevel() {
  threejsWorld = new ThreejsWorld('myThreeJsCanvas');
  physicsWorld = new PhysicsWorld();

  threejsWorld.initialize();
  physicsWorld.initialize();

  // Allows us to see cannon-es objects as meshes
  // cannonDebugger = new CannonDebugger(threejsWorld.scene, physicsWorld.world, {})

  controls = new PointerControls(threejsWorld.camera, physicsWorld.rigidBody);
  threejsWorld.scene.add(controls.getObject());

  loadLevel1();

  animate();

  lockCursor();

  timeSinceStart.value = performance.now();

  document.addEventListener('pointerlockchange', pauseGame);
  physicsWorld.world.addEventListener('postStep', detectCollision);
}

function lockCursor() {
  isMenuHidden.value = true;
  physicsWorld.canMoveCharacter = true;

  if(controls){
    if(threeJsCanvas.value){
      timedPointerLock = setTimeout(() => {
        threeJsCanvas.value.requestPointerLock()
      }, 1000);
    }
    controls.mouseMoveEnabled = true;
  }

  if(timeSinceStart.value > 0){
    timeSinceResume.value = performance.now();

    timeSinceStart.value += (timeSinceResume.value - timeSincePause.value);
  }
}

function animate() {
  physicsWorld.isGamePaused = isMenuHidden.value;
  animationId = requestAnimationFrame(animate)
  time.value = performance.now() / 1000
  const dt = time.value - physicsWorld.lastCallTime

  controls.update(dt)

  //Every frame, store the camera rotation inside the physics world.
  physicsWorld.threeQuaternion = controls.quaternion;

  physicsWorld.lastCallTime = time.value
  physicsWorld.world.step(physicsWorld.timeStep, dt)

  // Update box positions
  for (let i = 0; i < levelBoxes.length; i++) {
    levelMeshes[i].position.copy(levelBoxes[i].position)
    levelMeshes[i].quaternion.copy(levelBoxes[i].quaternion)
  }

  if(threejsWorld) {
    threejsWorld.renderer.render(threejsWorld.scene, threejsWorld.camera)
    threejsWorld.stats.update()
  }
  // Updates debug meshes
  // cannonDebugger.update();
}

function loadLevel1(){
  const url = new URL('./assets/scene.gltf', import.meta.url)

  const loader = new GLTFLoader();
  loader.load(
      url.href,
      (gltf) => {
        const gltfscene = gltf.scene;

        gltfscene.traverse((child) => {
          if (child.isMesh) {
            // Visual representation (Three.js mesh)
            const mesh = child;

            // Determine physics shape
            const boundingBox = new Box3().setFromObject(mesh);
            const size = new ThreeVector3();
            boundingBox.getSize(size); // Get size of the mesh

            // Create a corresponding physics shape (Box in this case)
            const halfExtents = new CannonVec3(size.x / 2, size.y / 2, size.z / 2);
            const shape = new Box(halfExtents);

            // Create a physics body for the mesh
            const body = new Body({
              mass: 0, // Static level parts have mass = 0
              shape: shape,
              material: physicsWorld.physicsMaterial
            });

            // Match position and rotation of the physics body with the mesh
            body.position.copy(mesh.position);
            body.quaternion.copy(mesh.quaternion);

            // Add the physics body to the Cannon.js world
            physicsWorld.world.addBody(body);

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            levelBoxes.push(body);
            levelMeshes.push(mesh);

            if(child.userData.name === 'End_point') {
              endPointBody = body;
            }
          }

        });
        threejsWorld.scene.add(gltfscene); // Add the loaded GLTF scene to your Three.js scene
      }
  );
}

function destroyScene() {
  clearTimeout(timedPointerLock);
  timeSinceStart.value = 0;
  timeSinceResume.value = 0;
  timeSincePause.value = 0;

  if (document.pointerLockElement){
    document.exitPointerLock();
  }

  isMenuHidden.value = false;
  physicsWorld.canMoveCharacter = false;

  if (controls) {
    controls.mouseMoveEnabled = false;
  }

  document.removeEventListener('pointerlockchange', pauseGame);
  physicsWorld.world.removeEventListener('postStep', detectCollision);
  // Dispose of Three.js resources
  threejsWorld.scene.traverse((object) => {
    object.dispose;
  });

  cancelAnimationFrame(animationId);
  animationId = null;

  // Nullify references
  threejsWorld = null;
  physicsWorld = null;
}

function resetScene() {
  destroyScene();
  initializeLevel();
}

function pauseGame() {
  if (!document.pointerLockElement){
    isMenuHidden.value = false;
    physicsWorld.canMoveCharacter = false;
    if (controls) {
      controls.mouseMoveEnabled = false;
    }

    if(timeSinceStart.value > 0){
      timeSincePause.value = performance.now();
    }
  }
}

function detectCollision() {
  physicsWorld.world.contacts.forEach((contact) => {
    const bodies = [contact.bi, contact.bj];

    if (physicsWorld && bodies.includes(physicsWorld.rigidBody) && bodies.includes(endPointBody)) {
      completionTimes.value.push((time.value * 1000) - timeSinceStart.value);
      completionTimes.value.sort();

      destroyScene();
    }
  });
}

// Helper functions (can work anywhere)
function msToTime(ms) {
  // Extract hours, minutes, seconds, and remaining milliseconds
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  const milliseconds = ms % 1000;

  // Format them so hours, minutes, and seconds each have at least two digits
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}.${milliseconds.toFixed(0)}`;
}
</script>