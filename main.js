import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const initialCameraPosition = new THREE.Vector3(8.584, 10.007, -3.618);
const initialCameraTarget = new THREE.Vector3(2.134, 3.857, 2.622);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xded8c9);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.copy(initialCameraPosition);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.target.copy(initialCameraTarget);
controls.update();

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        console.log("Cámara Posición:", camera.position);
        console.log("Cámara Target:", controls.target);
    }
});

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const loader = new GLTFLoader();
const interactables = [];
let tele, whiteboard, lil;

function setupInteractable(obj) {
    interactables.push(obj);
    obj.traverse(c => {
        if (c.isMesh) {
            c.material = c.material.clone();
            if (!c.material.emissive) c.material.emissive = new THREE.Color(0x000000);
            c.userData.originalEmissive = c.material.emissive.clone();
            c.userData.root = obj;
        }
    });
}

loader.load('models/House.glb', (gltf) => { scene.add(gltf.scene); });
loader.load('models/Tele1.glb', gltf => { tele = gltf.scene; scene.add(tele); setupInteractable(tele); });
loader.load('models/Whiteboard.glb', gltf => { whiteboard = gltf.scene; scene.add(whiteboard); setupInteractable(whiteboard); });

loader.load('models/Lil.glb', gltf => { 
    lil = gltf.scene; 
    lil.scale.set(0.8, 0.8, 0.8); 
    // Posición Final: X: 0.7, Y: 0.9, Z: 0.0
    lil.position.set(0.7, 0.9, 0.0); 
    scene.add(lil); 
    setupInteractable(lil); 
});

let highlightedObject = null, inFocus = false, camMoving = false, pendingOverlay = false;
const camSpeed = 0.08;
const camTargetPos = new THREE.Vector3();
const camTargetLookAt = new THREE.Vector3();

const exitBtn = document.createElement('button');
exitBtn.innerHTML = "✕";
Object.assign(exitBtn.style, {
    position:'absolute', left:'20px', top:'20px', width:'40px', height:'40px',
    borderRadius:'50%', cursor:'pointer', background:'white', border:'none',
    boxShadow:'0 2px 10px rgba(0,0,0,0.3)', display:'none', zIndex:'1001'
});
document.body.appendChild(exitBtn);

exitBtn.onclick = () => {
    moveCamera(initialCameraPosition, initialCameraTarget, false);
    inFocus = false;
    exitBtn.style.display = 'none';
    document.getElementById("overlay").style.display = 'none';
    controls.enablePan = controls.enableRotate = controls.enableZoom = true;
    stopCarousel();
};

const overlay = document.getElementById("overlay");
const slidesContainer = document.getElementById("slidesContainer");
const slides = document.querySelectorAll(".slide");
let currentIndex = 0, interval;

function showSlide(idx) {
    if (idx >= slides.length) currentIndex = 0;
    else if (idx < 0) currentIndex = slides.length - 1;
    else currentIndex = idx;
    slidesContainer.style.transform = `translateX(-${currentIndex * 100}%)`;
    slides.forEach((s, i) => {
        const v = s.querySelector("video");
        if (v) { v.pause(); if (i === currentIndex) v.play(); }
    });
}

function startCarousel() { stopCarousel(); interval = setInterval(() => showSlide(currentIndex + 1), 4000); }
function stopCarousel() { clearInterval(interval); }

document.getElementById("next").onclick = (e) => { e.stopPropagation(); showSlide(currentIndex + 1); startCarousel(); };
document.getElementById("prev").onclick = (e) => { e.stopPropagation(); showSlide(currentIndex - 1); startCarousel(); };

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function highlight(obj) { obj.traverse(c => { if(c.isMesh) { c.material.emissive.setHex(0xffffff); c.material.emissiveIntensity = 0.15; }}); }
function resetHighlight(obj) { obj.traverse(c => { if(c.isMesh) { c.material.emissive.copy(c.userData.originalEmissive); c.material.emissiveIntensity = 1.0; }}); }

window.addEventListener('click', () => {
    if (inFocus || !highlightedObject) return;
    if (highlightedObject === tele) {
        moveCamera(new THREE.Vector3(3.9, 5.7, 1.2), new THREE.Vector3(3.8, 5.7, 1.2), true);
    } 
    else if (highlightedObject === whiteboard) {
        moveCamera(new THREE.Vector3(3.5, 6.9, 1.6), new THREE.Vector3(3.5, 6.9, 1.7), false);
    } 
    else if (highlightedObject === lil) {
        moveCamera(
            new THREE.Vector3(2.993805908696181, 5.765681401128434, -0.22596885113171716), 
            new THREE.Vector3(2.9940417052375192, 3.8570029259268197, -0.28799824907079985), 
            false
        );
    }
});

function moveCamera(pos, target, showUI) {
    camTargetPos.copy(pos);
    camTargetLookAt.copy(target);
    camMoving = true;
    pendingOverlay = showUI;
    inFocus = true;
    exitBtn.style.display = 'block';
    controls.enablePan = controls.enableRotate = controls.enableZoom = false;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (!inFocus) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables, true);
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while(obj.parent && !obj.userData.root) obj = obj.parent;
            const root = obj.userData.root;
            if (highlightedObject !== root) {
                if (highlightedObject) resetHighlight(highlightedObject);
                highlightedObject = root;
                highlight(highlightedObject);
            }
            document.body.style.cursor = 'pointer';
        } else {
            if (highlightedObject) resetHighlight(highlightedObject);
            highlightedObject = null;
            document.body.style.cursor = 'default';
        }
    } else {
        if (highlightedObject) resetHighlight(highlightedObject);
        highlightedObject = null;
        document.body.style.cursor = 'default';
    }
    if (camMoving) {
        camera.position.lerp(camTargetPos, camSpeed);
        controls.target.lerp(camTargetLookAt, camSpeed);
        if (camera.position.distanceTo(camTargetPos) < 0.01) {
            camera.position.copy(camTargetPos);
            controls.target.copy(camTargetLookAt);
            camMoving = false;
            if (pendingOverlay) {
                overlay.style.display = 'flex';
                showSlide(0); startCarousel();
            }
        }
    }
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
