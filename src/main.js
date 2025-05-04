import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { db } from './firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';

const container = document.getElementById('container');
const exerciseSelect = document.getElementById('exercise');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Adicionar estado global
const appState = {
  currentClient: null,
  modelLoaded: false,
  musclesHighlighted: false,
};

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
camera.position.set(0, 10, 110);

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
let originalColors = {};

const loader = new GLTFLoader();
async function initializeApp() {
  try {
    // Carrega clientes primeiro (interface fica responsiva mais rápido)
    await loadClients();

    // Depois carrega o modelo 3D
    const gltf = await new Promise((resolve, reject) => {
      loader.load('muscle_model_separated.glb', resolve, undefined, reject);
    });

    model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh) {
        // Guarda a cor original de cada músculo
        originalColors[child.name] = child.material.color.clone();
        child.material = child.material.clone();
      }
    });
    loadClients().catch(console.error);
    animate();
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    alert('Ocorreu um erro ao carregar a aplicação');
  }
}

// Inicia tudo
initializeApp();

// Contador para o número de vezes que cada músculo é utilizado
const muscleUsage = {};

// Função para pintar o músculo com base no uso
async function paintMusclesForExercise(clientId) {
  if (!model || !clientId) return;

  try {
    const clientRef = doc(db, 'clientes', clientId);
    const clientSnap = await getDoc(clientRef);

    if (!clientSnap.exists()) return;

    // Objeto para acumular a intensidade por músculo
    const muscleIntensity = {};

    // 1. Calcula a intensidade total para cada músculo
    const exercises =
      clientSnap.data().planosTreino?.planoPadrao?.exercicios || {};

    for (const [exerciseName, exerciseData] of Object.entries(exercises)) {
      const muscles = exerciseMap[exerciseName];
      if (!muscles) continue;

      muscles.forEach((muscleName) => {
        if (!muscleIntensity[muscleName]) {
          muscleIntensity[muscleName] = 0;
        }
        muscleIntensity[muscleName] += exerciseData.vezesRealizado;
      });
    }

    // 2. Aplica as cores baseado no total acumulado
    for (const [muscleName, total] of Object.entries(muscleIntensity)) {
      const mesh = model.getObjectByName(muscleName);
      if (mesh) {
        const intensity = Math.min(0.9, total * 0.1); // Reduzir para 0.05 talvez?
        const color = new THREE.Color(1 - intensity, 1 - intensity, 1);
        mesh.material.color.copy(color);
      }
    }
  } catch (error) {
    console.error('Erro ao pintar músculos:', error);
  }
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

// Listener para o botão "Adicionar"
document
  .getElementById('add-exercise')
  .addEventListener('click', async function () {
    const clientId = document.getElementById('client-select').value;
    const exercise = document.getElementById('exercise').value;

    if (!clientId) return alert('Selecione um cliente primeiro!');
    if (!exercise) return alert('Selecione um exercício!');

    const clientRef = doc(db, 'clientes', clientId);

    try {
      // Primeiro obtemos o valor atual
      const clientSnap = await getDoc(clientRef);

      if (!clientSnap.exists()) {
        alert('Cliente não encontrado!');
        return;
      }

      const currentData = clientSnap.data();
      const currentCount =
        currentData.planosTreino?.planoPadrao?.exercicios?.[exercise]
          ?.vezesRealizado || 0;

      // Atualiza incrementando o valor existente
      await updateDoc(clientRef, {
        [`planosTreino.planoPadrao.exercicios.${exercise}`]: {
          nome: exercise,
          vezesRealizado: currentCount + 1,
          ultimaData: new Date().toISOString(),
        },
      });

      // Atualiza as cores dos músculos (versão nova que pinta todos os músculos)
      await paintMusclesForExercise(clientId);
      alert(`Exercício adicionado! Total: ${currentCount + 1} vezes`);
    } catch (error) {
      console.error('Erro ao adicionar exercício:', error);
      alert('Erro ao atualizar o exercício: ' + error.message);
    }
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

async function addClient(nome, email, telemovel) {
  try {
    // Verifica se cliente já existe
    const querySnapshot = await getDocs(
      query(
        collection(db, 'clientes'),
        where('email', '==', email),
        where('telemovel', '==', telemovel)
      )
    );

    if (!querySnapshot.empty) {
      alert('Já existe um cliente com este email ou telemovel!');
      return null;
    }

    const docRef = await addDoc(collection(db, 'clientes'), {
      nome: nome,
      email: email,
      telemovel: telemovel,
      dataRegisto: new Date().toISOString(),
      planosTreino: {
        planoPadrao: {
          nome: 'Plano Padrão',
          exercicios: {},
        },
      },
    });

    // Adiciona ao dropdown imediatamente
    const option = document.createElement('option');
    option.value = docRef.id;
    option.textContent = nome;
    document.getElementById('client-select').appendChild(option);

    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar cliente:', error);
    return null;
  }
}

async function loadClients() {
  try {
    const clientSelect = document.getElementById('client-select');
    clientSelect.innerHTML =
      '<option value="" disabled selected>Selecione um cliente</option>';

    const querySnapshot = await getDocs(collection(db, 'clientes'));
    querySnapshot.forEach((doc) => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.data().nome;
      clientSelect.appendChild(option);
    });

    // Limpa a seleção após remoção
    clientSelect.value = '';
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
  }
}

// Carregar clientes quando a página carrega
document.addEventListener('DOMContentLoaded', loadClients);

// Botão para mostrar formulário de novo cliente
document.getElementById('add-client').addEventListener('click', () => {
  document.getElementById('client-form').style.display = 'block';
});

// Event listener do botão salvar (versão final)
document.getElementById('save-client').addEventListener('click', async () => {
  const nome = document.getElementById('client-name').value.trim();
  const email = document.getElementById('client-email').value.trim();
  const telemovel = document.getElementById('client-phone').value.trim();

  if (!nome || !email || !telemovel) {
    alert('Preencha todos os campos!');
    return;
  }

  // Validação simples do telemovel
  if (!/^[9][0-9]{8}$/.test(telemovel)) {
    alert('Número de telemóvel inválido! Deve começar com 9 e ter 9 dígitos.');
    return;
  }

  const saveBtn = document.getElementById('save-client');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  const clientId = await addClient(nome, email, telemovel);

  if (clientId) {
    document.getElementById('client-form').style.display = 'none';
    document.getElementById('client-name').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('client-phone').value = '';
    alert('Cliente adicionado com sucesso!');
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar';
});

document
  .getElementById('client-select')
  .addEventListener('change', async (e) => {
    const clientId = e.target.value;
    appState.currentClient = e.target.value;
    document.getElementById('remove-client').disabled = !clientId;
    if (!clientId || !model) return;

    // 1. RESETA para as cores originais
    model.traverse((child) => {
      if (child.isMesh && originalColors[child.name]) {
        child.material.color.copy(originalColors[child.name]);
      }
    });

    // 2. Aplica o novo plano de treino
    try {
      const clientRef = doc(db, 'clientes', clientId);
      const clientSnap = await getDoc(clientRef);

      if (clientSnap.exists()) {
        const exercises =
          clientSnap.data().planosTreino?.planoPadrao?.exercicios || {};

        // Objeto para acumular o total de sessões por músculo
        const muscleSessions = {};

        // Calcula o total de sessões para cada músculo
        for (const [exerciseName, exerciseData] of Object.entries(exercises)) {
          const muscles = exerciseMap[exerciseName];
          if (!muscles) continue;

          muscles.forEach((muscleName) => {
            if (!muscleSessions[muscleName]) {
              muscleSessions[muscleName] = 0;
            }
            muscleSessions[muscleName] += exerciseData.vezesRealizado;
          });
        }

        // Aplica as cores baseadas no total acumulado
        for (const [muscleName, totalSessions] of Object.entries(
          muscleSessions
        )) {
          const mesh = model.getObjectByName(muscleName);
          if (mesh) {
            const intensity = Math.min(0.9, totalSessions * 0.1); // Mesmo fator usado ao adicionar
            const color = new THREE.Color(1 - intensity, 1 - intensity, 1);
            mesh.material.color.copy(color);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar plano:', error);
    }
  });

// Desabilita o botão inicialmente
document.getElementById('remove-client').disabled = true;

// Cancelar formulário
document.getElementById('cancel-client').addEventListener('click', () => {
  document.getElementById('client-form').style.display = 'none';
});

async function removeClient(clientId) {
  if (!clientId) return;

  try {
    // Confirmação antes de remover
    const confirmDelete = confirm(
      'Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.'
    );
    if (!confirmDelete) return;

    const clientRef = doc(db, 'clientes', clientId);
    await deleteDoc(clientRef);

    // Remove do dropdown
    const clientSelect = document.getElementById('client-select');
    const optionToRemove = clientSelect.querySelector(
      `option[value="${clientId}"]`
    );
    if (optionToRemove) {
      clientSelect.removeChild(optionToRemove);
    }

    alert('Cliente removido com sucesso!');
  } catch (error) {
    console.error('Erro ao remover cliente:', error);
    alert('Erro ao remover cliente: ' + error.message);
  }
}

document.getElementById('remove-client').addEventListener('click', async () => {
  const clientId = document.getElementById('client-select').value;

  if (!clientId) {
    alert('Selecione um cliente para remover!');
    return;
  }

  await removeClient(clientId);
});

