import Stats from 'three/examples/jsm/libs/stats.module';
import {
    AmbientLight,
    Fog, Mesh,
    MeshStandardMaterial,
    PCFSoftShadowMap,
    PerspectiveCamera, PlaneGeometry,
    Scene,
    SpotLight,
    WebGLRenderer
} from "three";

export default class ThreejsInit {
    constructor(canvasId) {
        // NOTE: Core components to initialize Three.js app.
        this.scene = undefined;
        this.camera = undefined;
        this.renderer = undefined;

        // NOTE: Camera params;
        this.canvasId = canvasId;

        // NOTE: Additional components.
        this.stats = undefined;

        // NOTE: Lighting is basically required.
        this.ambientLight = new AmbientLight(0xffffff, 0.2);
        this.spotlight = new SpotLight(0xffffff, 100, 0, Math.PI / 4, 1);

        // Generic material
        this.material = new MeshStandardMaterial({ color: 0xdddddd });
    }

    initialize(){
        const canvas = document.getElementById(this.canvasId);

        // Camera
        this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

        // Scene
        this.scene = new Scene();
        this.scene.fog = new Fog(0x000000, 0, 200)

        // Renderer
        this.renderer = new WebGLRenderer({ antialias: true, canvas: canvas});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(this.scene.fog.color);

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = PCFSoftShadowMap;

        document.body.appendChild(this.renderer.domElement);

        // Stats
        this.stats = Stats();
        document.body.appendChild(this.stats.dom);

        // Light
        this.scene.add(this.ambientLight)

        this.spotlight.position.set(10, 30, 20)
        this.spotlight.target.position.set(0, 0, 0)

        this.spotlight.castShadow = true

        this.spotlight.shadow.camera.near = 10
        this.spotlight.shadow.camera.far = 100
        this.spotlight.shadow.camera.fov = 30

        // this.spotlight.shadow.bias = -0.0001
        this.spotlight.shadow.mapSize.width = 2048
        this.spotlight.shadow.mapSize.height = 2048

        this.scene.add(this.spotlight)

        // Floor
        const floorGeometry = new PlaneGeometry(300, 300, 100, 100)
        floorGeometry.rotateX(-Math.PI / 2)
        const floor = new Mesh(floorGeometry, this.material)
        floor.receiveShadow = true

        this.scene.add(floor)

        window.addEventListener('resize', () => this.onWindowResize(), false);

    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}