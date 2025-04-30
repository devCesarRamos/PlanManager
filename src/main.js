import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('container');
const exerciseSelect = document.getElementById('exercise');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const exerciseMap = {
  bench_press: [
    'PectoralisMajor_L',
    'PectoralisMajor_R',
    'TricepsBrachii_L',
    'TricepsBrachii_R',
    'Deltoids',
  ],
  incline_press: [
    'PectoralisMajor_L',
    'PectoralisMajor_R',
    'TricepsBrachii_L',
    'TricepsBrachii_R',
    'Deltoids',
  ],
  pull_ups: [
    'LatissimusDorsi',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Forearms',
    'Trapezius',
  ],
  overhead_press: [
    'Deltoids',
    'TricepsBrachii_L',
    'TricepsBrachii_R',
    'Forearms',
  ],
  dips: [
    'Deltoids',
    'TricepsBrachii_L',
    'TricepsBrachii_R',
    'PectoralisMajor_L',
    'PectoralisMajor_R',
  ],
  unilateral_row: [
    'LatissimusDorsi',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Trapezius',
    'Forearms',
  ],
  barbell_row: [
    'LatissimusDorsi',
    'Trapezius',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Forearms',
  ],
  bicep_curl: ['BicepsBrachii_L', 'BicepsBrachii_R', 'Forearms'],
  hammer_curl: ['BicepsBrachii_L', 'BicepsBrachii_R', 'Forearms'],
  tricep_extension: ['TricepsBrachii_L', 'TricepsBrachii_R', 'Forearms'],
  skull_crusher: ['TricepsBrachii_L', 'TricepsBrachii_R', 'Forearms'],
  hanging_leg_raises: [
    'RectusAbdominis_L',
    'RectusAbdominis_R',
    'TibialisAnterior',
  ],
  ab_wheel: ['RectusAbdominis_L', 'RectusAbdominis_R', 'TibialisAnterior'],

  trap_bar_deadlift: [
    'GluteusMaximus',
    'Hamstrings',
    'Quadriceps',
    'Quadriceps',
    'Forearms',
    'Trapezius',
  ],
  squat: ['GluteusMaximus', 'Quadriceps', 'Quadriceps', 'Hamstrings'],
  bulgarian_split_squat: [
    'GluteusMaximus',
    'Quadriceps',
    'Quadriceps',
    'Hamstrings',
  ],
  romanian_deadlift: ['GluteusMaximus', 'Hamstrings', 'Forearms'],
  hip_thrust: ['GluteusMaximus', 'Hamstrings', 'Quadriceps'],

  sprints: [],
  circuit_training: [
    'Quadriceps',
    'Quadriceps',
    'GluteusMaximus',
    'Hamstrings',
    'Forearms',
    'TibialisAnterior',
  ],
};

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1); // Luz vindo da direção (1, 1, 1)
scene.add(light);

// Adicionar luz ambiente para iluminar as áreas mais escuras
const ambientLight = new THREE.AmbientLight(0x404040, 1); // Luz suave em toda a cena
scene.add(ambientLight);
// Segunda luz direcional para iluminar o lado oposto
const backLight = new THREE.DirectionalLight(0xffffff, 1);
backLight.position.set(-1, 1, -1); // Luz vinda de trás
scene.add(backLight);

// Carregar o modelo
let model;

const loader = new GLTFLoader();
loader.load('muscle_model_separated.glb', function (gltf) {
  model = gltf.scene;
  scene.add(model);

  model.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone(); // Garante que cada músculo pode ter cor independente
      console.log('Mesh encontrado:', child.name);
    }
  });

  console.log('Modelo carregado!');
  animate();
});

// Função para pintar músculos
function paintMusclesForExercise(exercise) {
  if (!model) return;

  // Resetar todas as cores
  model.traverse((child) => {
    if (child.isMesh) {
      child.material.color.set(0xffffff);
    }
  });

  const muscles = exerciseMap[exercise];
  if (!muscles) return;

  muscles.forEach((muscleName) => {
    const mesh = model.getObjectByName(muscleName);
    if (mesh) {
      mesh.material.color.set('red');
    } else {
      console.warn(`Músculo não encontrado: ${muscleName}`);
    }
  });
}

// Geração dinâmica do dropdown de exercícios
Object.keys(exerciseMap).forEach((exercise) => {
  const option = document.createElement('option');
  option.value = exercise;
  option.textContent = exercise
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  exerciseSelect.appendChild(option);
});

// Listener para mudar a cor ao selecionar exercício
exerciseSelect.addEventListener('change', (e) => {
  const selected = e.target.value;
  paintMusclesForExercise(selected);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
