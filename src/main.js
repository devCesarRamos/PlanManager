import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Mapeamento simples: exercício → músculos afetados
// O nome "músculo" tem de coincidir com o nome do mesh no modelo
const exerciseMap = {
  bench_press: ['Object_11',],
  squat: ['Object_7', 'Object_9'],
  bicep_curl: ['Object_11', 'Object_13'],
};

// Carga atual por músculo
const muscleLoad = {};

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 50, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Load model
const loader = new GLTFLoader();
loader.load('/model.glb', (gltf) => {
  const model = gltf.scene;
  model.scale.set(2, 2, 2);
  model.position.y = -1;
  scene.add(model);
  // DEBUG: listar todos os nomes de meshes no modelo
  model.traverse((child) => {
    if (child.isMesh) {
      console.log('Mesh encontrado:', child.name);
    }
  });

  console.log('✅ Modelo carregado!');

  document.getElementById('add-exercise').addEventListener('click', () => {
    const selected = document.getElementById('exercise-select').value;
    if (!selected || !exerciseMap[selected]) return;

    exerciseMap[selected].forEach((muscleName) => {
      const mesh = model.getObjectByName(muscleName);
      if (mesh && mesh.isMesh) {
        mesh.material.color.set('red'); // força cor vermelha
      } else {
        console.warn('Músculo não encontrado:', muscleName);
      }
    });
  });
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
