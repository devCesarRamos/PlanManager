import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { db, auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
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
  onSnapshot,
  deleteField,
} from 'firebase/firestore';

const container = document.getElementById('container');
const exerciseSelect = document.getElementById('exercise');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

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
    'Trapezius',
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
  tricep_extension: ['TricepsBrachii_L', 'TricepsBrachii_R'],
  skull_crusher: ['TricepsBrachii_L', 'TricepsBrachii_R'],
  hanging_leg_raises: ['RectusAbdominis_L', 'RectusAbdominis_R'],
  ab_wheel: ['RectusAbdominis_L', 'RectusAbdominis_R'],
  trap_bar_deadlift: [
    'GluteusMaximus',
    'Hamstrings',
    'Quadriceps',
    'Forearms',
    'Trapezius',
  ],
  squat: ['GluteusMaximus', 'Quadriceps', 'Hamstrings'],
  bulgarian_split_squat: ['GluteusMaximus', 'Quadriceps', 'Hamstrings'],
  romanian_deadlift: ['GluteusMaximus', 'Hamstrings', 'Forearms'],
  hip_thrust: ['GluteusMaximus', 'Hamstrings'],
  treadmill: [],
  circuit_training: [
    'Quadriceps',
    'GluteusMaximus',
    'Hamstrings',
    'Forearms',
    'TibialisAnterior',
  ],
  leg_extension: ['Quadriceps'],
  leg_curl: ['Hamstrings'],
  facepulls: ['Deltoids', 'Trapezius', 'Forearms'],
  zercher_squat: [
    'Quadriceps',
    'GluteusMaximus',
    'Hamstrings',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Forearms',
  ],
  lateral_zercher_squat: [
    'GluteusMaximus',
    'Quadriceps',
    'Hamstrings',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Forearms',
  ],
  lateral_raises: ['Deltoids'],
  lunges: ['Quadriceps', 'GluteusMaximus', 'Hamstrings'],
  split_squat: ['Quadriceps', 'GluteusMaximus', 'Hamstrings'],
  machine_row: [
    'LatissimusDorsi',
    'Trapezius',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Forearms',
  ],
  sled: ['Quadriceps', 'GluteusMaximus', 'Hamstrings', 'TibialisAnterior'],
  carries: ['Trapezius', 'Forearms', 'GluteusMaximus', 'TibialisAnterior'],
  walking_ohp: [
    'Deltoids',
    'TricepsBrachii_L',
    'TricepsBrachii_R',
    'Trapezius',
    'Forearms',
  ],
  walking_zercher: [
    'Quadriceps',
    'GluteusMaximus',
    'Hamstrings',
    'BicepsBrachii_L',
    'BicepsBrachii_R',
    'Forearms',
  ],
  tricep_overhead_extension: ['TricepsBrachii_L', 'TricepsBrachii_R'],
};

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 10, 110);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.enablePan = false;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 1.2;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 1.8;
controls.minDistance = 20;
controls.maxDistance = 200;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

const backLight = new THREE.DirectionalLight(0xffffff, 1);
backLight.position.set(-1, 1, -1);
scene.add(backLight);

let model;
let originalColors = {};
let legendVisible = false;
let workoutPlanCollapsed = false;

const loader = new GLTFLoader();

async function initializeApp() {
  try {
    await loadClients();

    const gltf = await new Promise((resolve, reject) => {
      loader.load('muscle_model_separated.glb', resolve, undefined, reject);
    });

    model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh) {
        originalColors[child.name] = child.material.color.clone();
        child.material = child.material.clone();
      }
    });

    animate();
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    showToast('Ocorreu um erro ao carregar a aplicação');
  }

  // Auth state listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('controls').style.display = 'flex';
      document.getElementById('container').style.display = 'block';
      document.getElementById('stats-panel').style.display = 'block';
      document.getElementById('legend-panel').style.display = 'block';
      document.getElementById('toggle-stats').style.display = 'block';
      document.getElementById('toggle-legend').style.display = 'block';
    } else {
      document.getElementById('login-form').style.display = 'block';
      document.getElementById('controls').style.display = 'none';
      document.getElementById('container').style.display = 'none';
      document.getElementById('stats-panel').style.display = 'none';
      document.getElementById('legend-panel').style.display = 'none';
      document.getElementById('toggle-stats').style.display = 'none';
      document.getElementById('toggle-legend').style.display = 'none';
    }
  });
}

initializeApp();

const muscleUsage = {};
const RPE_VOLUME_SATURATION = 24;

function calcMuscleIntensityFromRPE(exercises) {
  const muscleLoad = {};

  for (const [exerciseName, exerciseData] of Object.entries(exercises)) {
    const muscles = exerciseMap[exerciseName];
    if (!muscles || !exerciseData.vezesRealizado) continue;

    const avgRpe =
      exerciseData.rpeTotal && exerciseData.vezesRealizado > 0
        ? exerciseData.rpeTotal / exerciseData.vezesRealizado
        : 0;

    if (avgRpe <= 0) continue;

    const load = avgRpe * exerciseData.vezesRealizado;

    muscles.forEach((muscleName) => {
      muscleLoad[muscleName] = (muscleLoad[muscleName] || 0) + load;
    });
  }

  const muscleIntensity = {};
  for (const [muscleName, load] of Object.entries(muscleLoad)) {
    muscleIntensity[muscleName] = Math.min(0.9, load / RPE_VOLUME_SATURATION);
  }

  return muscleIntensity;
}

function calcMuscleIntensityFromToday(exercises) {
  const today = new Date().toDateString();
  const muscleLoad = {};

  for (const [exerciseName, exerciseData] of Object.entries(exercises)) {
    const muscles = exerciseMap[exerciseName];
    if (!muscles) continue;

    const todaySession = (exerciseData.sessions || []).find(
      (s) => new Date(s.date).toDateString() === today,
    );
    if (!todaySession) continue;

    const sets = todaySession.sets || [];
    if (sets.length === 0) continue;

    const avgRpe = sets.reduce((sum, s) => sum + (s.rpe || 0), 0) / sets.length;
    const load = avgRpe * sets.length;

    muscles.forEach((muscleName) => {
      muscleLoad[muscleName] = (muscleLoad[muscleName] || 0) + load;
    });
  }

  const muscleIntensity = {};
  for (const [muscleName, load] of Object.entries(muscleLoad)) {
    muscleIntensity[muscleName] = Math.min(0.9, load / RPE_VOLUME_SATURATION);
  }

  return muscleIntensity;
}

async function paintMusclesForExercise(clientId) {
  if (!model || !clientId) return;

  try {
    const clientRef = doc(db, 'clientes', clientId);
    const clientSnap = await getDoc(clientRef);

    if (!clientSnap.exists()) return;

    const exercises =
      clientSnap.data().planosTreino?.planoPadrao?.exercicios || {};

    const muscleIntensity = calcMuscleIntensityFromToday(exercises);

    model.traverse((child) => {
      if (child.isMesh && originalColors[child.name]) {
        child.material.color.copy(originalColors[child.name]);

        if (muscleIntensity[child.name] > 0) {
          const intensity = muscleIntensity[child.name];
          const color = new THREE.Color(1 - intensity, 1 - intensity, 1);
          child.material.color.copy(color);
        }
      }
    });
  } catch (error) {
    console.error('Erro ao pintar músculos:', error);
  }
}

// Populate exercise dropdown
exerciseSelect.insertAdjacentHTML(
  'afterbegin',
  '<option value="" selected disabled>Selecionar exercício</option>',
);
Object.keys(exerciseMap).forEach((exercise) => {
  const option = document.createElement('option');
  option.value = exercise;
  option.textContent = exercise
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  exerciseSelect.appendChild(option);
});

// ── Exercise form ──────────────────────────────────────────────

function createSetRow(number, exerciseName) {
  const row = document.createElement('div');
  row.className = 'set-row';
  if (exerciseName === 'treadmill') {
    row.innerHTML = `
      <span class="set-label">Série ${number}</span>
      <input type="number" class="set-time" placeholder="Tempo (min)" min="0" step="0.1" />
      <input type="number" class="set-kms" placeholder="Kms" min="0" step="0.01" />
      <input type="number" class="set-kcal" placeholder="Kcal" min="0" />
    `;
  } else {
    row.innerHTML = `
      <span class="set-label">Série ${number}</span>
      <input type="number" class="set-reps" placeholder="Reps" min="1" />
      <input type="number" class="set-kg" placeholder="Kg" min="0" step="0.5" />
      <input type="number" class="set-rpe" placeholder="RPE" min="1" max="10" />
    `;
  }
  return row;
}

document.getElementById('add-exercise').addEventListener('click', () => {
  const exerciseName = document.getElementById('exercise').value;
  if (!exerciseName || !appState.currentClient) return;

  document.getElementById('exercise-form-name').textContent = exerciseName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const container = document.getElementById('sets-container');
  container.innerHTML = '';
  container.appendChild(createSetRow(1, exerciseName));

  document.getElementById('exercise-form').style.display = 'block';
});

document.getElementById('add-set-btn').addEventListener('click', () => {
  const exerciseName = document.getElementById('exercise').value;
  const container = document.getElementById('sets-container');
  container.appendChild(
    createSetRow(container.children.length + 1, exerciseName),
  );
});

document.getElementById('cancel-exercise').addEventListener('click', () => {
  document.getElementById('exercise-form').style.display = 'none';
});

document.getElementById('save-exercise').addEventListener('click', async () => {
  const exerciseName = document.getElementById('exercise').value;
  const setRows = document.querySelectorAll('.set-row');
  const sets = [];

  if (exerciseName === 'treadmill') {
    for (const row of setRows) {
      const time = parseFloat(row.querySelector('.set-time').value);
      const kms = parseFloat(row.querySelector('.set-kms').value);
      const kcal = parseFloat(row.querySelector('.set-kcal').value);

      if (isNaN(time) || isNaN(kms) || isNaN(kcal)) {
        showToast('Preenche tempo, kms e kcal de cada série', 'warning');
        return;
      }
      sets.push({ time, kms, kcal });
    }
  } else {
    for (const row of setRows) {
      const reps = parseInt(row.querySelector('.set-reps').value);
      const kg = parseFloat(row.querySelector('.set-kg').value) || 0;
      const rpe = parseFloat(row.querySelector('.set-rpe').value);

      if (!reps) {
        showToast('Preenche as repetições de cada série', 'warning');
        return;
      }
      if (!rpe || rpe < 1 || rpe > 10) {
        showToast('Insere um RPE válido (1–10) em cada série', 'warning');
        return;
      }
      sets.push({ reps, kg, rpe });
    }
  }

  if (sets.length === 0) {
    showToast('Adiciona pelo menos uma série', 'warning');
    return;
  }

  try {
    const clientRef = doc(db, 'clientes', appState.currentClient);
    const clientSnap = await getDoc(clientRef);
    const data = clientSnap.data();
    const existing = data.planosTreino?.planoPadrao?.exercicios?.[
      exerciseName
    ] || {
      vezesRealizado: 0,
      rpeTotal: 0,
      totalKg: 0,
      sessions: [],
    };

    const sessionKg = sets.reduce((sum, s) => sum + s.kg, 0);
    const sessionRpeTotal = sets.reduce((sum, s) => sum + s.rpe, 0);

    const today = new Date().toDateString();
    const existingSessions = existing.sessions || [];
    const todayIndex = existingSessions.findIndex(
      (s) => new Date(s.date).toDateString() === today,
    );

    let updatedSessions;
    if (todayIndex >= 0) {
      updatedSessions = existingSessions.map((s, i) =>
        i === todayIndex ? { ...s, sets: [...s.sets, ...sets] } : s,
      );
    } else {
      updatedSessions = [
        ...existingSessions,
        { date: new Date().toISOString(), sets },
      ];
    }

    await updateDoc(clientRef, {
      [`planosTreino.planoPadrao.exercicios.${exerciseName}`]: {
        vezesRealizado: existing.vezesRealizado + sets.length,
        rpeTotal: existing.rpeTotal + sessionRpeTotal,
        totalKg: (existing.totalKg || 0) + sessionKg,
        sessions: updatedSessions,
      },
    });

    document.getElementById('exercise-form').style.display = 'none';
    showToast('Exercício adicionado!', 'success');
    await paintMusclesForExercise(appState.currentClient);
  } catch (err) {
    console.error(err);
    showToast('Erro ao guardar exercício', 'error');
  }
});

// ── Remove exercise (today's data) ────────────────────────────

document
  .getElementById('remove-exercise')
  .addEventListener('click', async () => {
    const exerciseName = document.getElementById('exercise').value;
    if (!exerciseName || !appState.currentClient) return;

    const formattedName = exerciseName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    document.getElementById('remove-exercise-name').innerHTML =
      `Remover dados de hoje para <strong>${formattedName}</strong>?`;
    document.getElementById('remove-exercise-form').style.display = 'block';

    const confirmBtn = document.getElementById('confirm-remove-exercise');
    const cancelBtn = document.getElementById('cancel-remove-exercise');

    const handleConfirm = async () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);

      try {
        const today = new Date().toDateString();
        const clientRef = doc(db, 'clientes', appState.currentClient);
        const clientSnap = await getDoc(clientRef);
        const data = clientSnap.data();
        const existing =
          data.planosTreino?.planoPadrao?.exercicios?.[exerciseName];

        if (!existing) return;

        // Old data with no sessions at all — delete exercise entirely
        if (!existing.sessions || existing.sessions.length === 0) {
          await updateDoc(clientRef, {
            [`planosTreino.planoPadrao.exercicios.${exerciseName}`]:
              deleteField(),
          });
          showToast('Exercício removido', 'success');
          await paintMusclesForExercise(appState.currentClient);
          document.getElementById('remove-exercise-form').style.display =
            'none';
          return;
        }

        const todaySession = existing.sessions.find(
          (s) => new Date(s.date).toDateString() === today,
        );

        if (!todaySession) {
          showToast('Sem dados de hoje para remover', 'warning');
          document.getElementById('remove-exercise-form').style.display =
            'none';
          return;
        }

        const todaySets = todaySession.sets || [];
        const todayKg = todaySets.reduce((sum, s) => sum + (s.kg || 0), 0);
        const todayRpe = todaySets.reduce((sum, s) => sum + (s.rpe || 0), 0);

        const updatedSessions = existing.sessions.filter(
          (s) => new Date(s.date).toDateString() !== today,
        );

        if (updatedSessions.length === 0) {
          await updateDoc(clientRef, {
            [`planosTreino.planoPadrao.exercicios.${exerciseName}`]:
              deleteField(),
          });
        } else {
          await updateDoc(clientRef, {
            [`planosTreino.planoPadrao.exercicios.${exerciseName}`]: {
              ...existing,
              vezesRealizado: Math.max(
                0,
                existing.vezesRealizado - todaySets.length,
              ),
              rpeTotal: Math.max(0, existing.rpeTotal - todayRpe),
              totalKg: Math.max(0, (existing.totalKg || 0) - todayKg),
              sessions: updatedSessions,
            },
          });
        }

        showToast('Dados de hoje removidos', 'success');
        await paintMusclesForExercise(appState.currentClient);
        document.getElementById('remove-exercise-form').style.display = 'none';
      } catch (err) {
        console.error(err);
        showToast('Erro ao remover exercício', 'error');
      }
    };

    const handleCancel = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      document.getElementById('remove-exercise-form').style.display = 'none';
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });

// ── Three.js animate loop ──────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ── Clients ───────────────────────────────────────────────────

async function addClient(nome, email, telemovel) {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, 'clientes'),
        where('email', '==', email),
        where('telemovel', '==', telemovel),
      ),
    );

    if (!querySnapshot.empty) {
      showToast('Já existe um cliente com este email ou telemovel!');
      return null;
    }

    const docRef = await addDoc(collection(db, 'clientes'), {
      nome,
      email,
      telemovel,
      dataRegisto: new Date().toISOString(),
      planosTreino: {
        planoPadrao: {
          nome: 'Plano Padrão',
          exercicios: {},
        },
      },
    });

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
      '<option value="" disabled selected>Selecionar cliente</option>';

    const querySnapshot = await getDocs(collection(db, 'clientes'));
    querySnapshot.forEach((doc) => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.data().nome;
      clientSelect.appendChild(option);
    });

    clientSelect.value = '';
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
  }
}

document.getElementById('add-client').addEventListener('click', () => {
  document.getElementById('client-form').style.display = 'block';
});

document.getElementById('save-client').addEventListener('click', async () => {
  const nome = document.getElementById('client-name').value.trim();
  const email = document.getElementById('client-email').value.trim();
  const telemovel = document.getElementById('client-phone').value.trim();

  if (!nome || !email || !telemovel) {
    showToast('Preencha todos os campos!');
    return;
  }

  if (!/^[9][0-9]{8}$/.test(telemovel)) {
    showToast(
      'Número de telemóvel inválido! Deve começar com 9 e ter 9 dígitos.',
    );
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
    showToast('Cliente adicionado com sucesso!');
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Salvar';
});

document.getElementById('cancel-client').addEventListener('click', () => {
  document.getElementById('client-form').style.display = 'none';
});

document
  .getElementById('client-select')
  .addEventListener('change', async (e) => {
    const clientId = e.target.value;
    appState.currentClient = clientId;

    document.getElementById('remove-client').disabled = !clientId;

    await updateWorkoutPlanPanel(clientId);

    if (!clientId || !model) return;

    // Reset to original colours
    model.traverse((child) => {
      if (child.isMesh && originalColors[child.name]) {
        child.material.color.copy(originalColors[child.name]);
      }
    });

    // Paint with today's data
    await paintMusclesForExercise(clientId);

    // Update stats panel
    const clientSnap = await getDoc(doc(db, 'clientes', clientId));
    if (clientSnap.exists()) {
      updateStatsPanel(clientSnap.data());
    }
  });

document.getElementById('remove-client').disabled = true;

async function removeClient(clientId) {
  if (!clientId) return;

  const clientSelect = document.getElementById('client-select');
  const clientName = clientSelect.options[clientSelect.selectedIndex].text;

  document.getElementById('remove-client-name').textContent = clientName;
  document.getElementById('remove-client-form').style.display = 'block';

  const confirmBtn = document.getElementById('confirm-remove-client');
  const cancelBtn = document.getElementById('cancel-remove-client');

  const handleConfirm = async () => {
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);

    try {
      const clientRef = doc(db, 'clientes', clientId);
      await deleteDoc(clientRef);

      const optionToRemove = clientSelect.querySelector(
        `option[value="${clientId}"]`,
      );
      if (optionToRemove) {
        clientSelect.removeChild(optionToRemove);
      }

      showToast('Cliente removido com sucesso!', 'success');
      document.getElementById('workout-plan-panel').classList.add('hidden');
      document.getElementById('remove-client-form').style.display = 'none';
    } catch (error) {
      console.error('Erro ao remover cliente:', error);
      showToast('Erro ao remover cliente: ' + error.message, 'error');
    }
  };

  const handleCancel = () => {
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    document.getElementById('remove-client-form').style.display = 'none';
  };

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

document.getElementById('remove-client').addEventListener('click', async () => {
  const clientId = document.getElementById('client-select').value;

  if (!clientId) {
    showToast('Selecione um cliente para remover!');
    return;
  }

  await removeClient(clientId);
});

// ── Exercise dropdown state ───────────────────────────────────

document.getElementById('add-exercise').disabled = true;
document.getElementById('remove-exercise').disabled = true;

document.getElementById('exercise').addEventListener('change', function (e) {
  const exerciseSelected = e.target.value;

  document.querySelectorAll('.exercise-item').forEach((item) => {
    item.classList.remove('active-exercise');
  });

  if (exerciseSelected) {
    const exerciseName = exerciseSelected.replace(/_/g, ' ');
    document.querySelectorAll('.exercise-item').forEach((item) => {
      if (
        item.querySelector('.exercise-name')?.textContent.toLowerCase() ===
        exerciseName.toLowerCase()
      ) {
        item.classList.add('active-exercise');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  document.getElementById('add-exercise').disabled = !exerciseSelected;
  document.getElementById('remove-exercise').disabled = !exerciseSelected;
});

// ── Toast ─────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  if (duration) {
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

// ── Workout plan panel ────────────────────────────────────────

let unsubscribeWorkoutPlan = null;

async function updateWorkoutPlanPanel(clientId) {
  const panel = document.getElementById('workout-plan-panel');
  const clientNameDisplay = document.getElementById('client-name-display');
  const exercisesList = document.getElementById('exercises-list');

  if (unsubscribeWorkoutPlan) {
    unsubscribeWorkoutPlan();
    unsubscribeWorkoutPlan = null;
  }

  if (!clientId) {
    panel.classList.add('hidden');
    return;
  }

  try {
    const clientRef = doc(db, 'clientes', clientId);

    unsubscribeWorkoutPlan = onSnapshot(clientRef, (snapshot) => {
      if (snapshot.exists()) {
        const clientData = snapshot.data();
        const exercises =
          clientData.planosTreino?.planoPadrao?.exercicios || {};

        clientNameDisplay.textContent = clientData.nome;

        // Remember open states before re-render
        const openExercise = document.querySelector(
          '.exercise-item.detail-open .exercise-name',
        )?.textContent;
        const openDates = [
          ...document.querySelectorAll('.session-date.open'),
        ].map((el) => el.textContent.trim());

        exercisesList.innerHTML = '';

        // Calculate today's stats for each exercise
        const today = new Date().toDateString();
        const todayStats = {};

        Object.entries(exercises).forEach(([exerciseName, exerciseData]) => {
          const todaySession = (exerciseData.sessions || []).find(
            (s) => new Date(s.date).toDateString() === today,
          );

          if (todaySession) {
            const sets = todaySession.sets || [];

            if (exerciseName === 'treadmill') {
              const totalTime = sets.reduce((sum, s) => sum + (s.time || 0), 0);
              const totalKms = sets.reduce((sum, s) => sum + (s.kms || 0), 0);
              const totalKcal = sets.reduce((sum, s) => sum + (s.kcal || 0), 0);

              todayStats[exerciseName] = {
                avgRpe: '–',
                setsCount: sets.length,
                totalKg: 0,
                totalTime,
                totalKms,
                totalKcal,
              };
            } else {
              const avgRpe =
                sets.length > 0
                  ? (
                      sets.reduce((sum, s) => sum + (s.rpe || 0), 0) /
                      sets.length
                    ).toFixed(1)
                  : '–';
              const totalKg = sets.reduce((sum, s) => sum + (s.kg || 0), 0);

              todayStats[exerciseName] = {
                avgRpe,
                setsCount: sets.length,
                totalKg,
              };
            }
          }
        });

        const validExercises = Object.entries(exercises)
          .filter(([_, exerciseData]) => exerciseData.vezesRealizado > 0)
          .sort((a, b) => {
            const avgRpeA =
              a[1].rpeTotal && a[1].vezesRealizado
                ? a[1].rpeTotal / a[1].vezesRealizado
                : 0;
            const avgRpeB =
              b[1].rpeTotal && b[1].vezesRealizado
                ? b[1].rpeTotal / b[1].vezesRealizado
                : 0;
            return avgRpeB - avgRpeA;
          });

        if (validExercises.length === 0) {
          exercisesList.innerHTML =
            '<p style="color: rgba(255,255,255,0.6); padding: 15px;">Nenhum exercício registrado</p>';
        } else {
          validExercises.forEach(([exerciseName, exerciseData]) => {
            try {
              const todayData = todayStats[exerciseName];
            const avgRpe = todayData ? todayData.avgRpe : '–';
            const setsCount = todayData ? todayData.setsCount : 0;
            const totalKg = todayData ? todayData.totalKg : 0;

            const statText =
              exerciseName === 'treadmill'
                ? `Tempo ${todayData?.totalTime ?? 0} min · ${todayData?.totalKms ?? 0} km · ${todayData?.totalKcal ?? 0} kcal` 
                : `RPE ${avgRpe} · ${setsCount} sets · ${totalKg}kg (hoje)`;

            const wrapper = document.createElement('div');
            wrapper.className = 'exercise-wrapper';

            const exerciseItem = document.createElement('div');
            exerciseItem.className = 'exercise-item';
            exerciseItem.innerHTML = `
              <span class="exercise-name">${exerciseName
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())}</span>
              <span style="display:flex;align-items:center;gap:4px;">
                <span class="exercise-count">${statText}</span>
                <i class="fas fa-chevron-down toggle-detail-icon"></i>
              </span>
            `;

            const detail = document.createElement('div');
            detail.className = 'exercise-detail';

            const sessions = exerciseData.sessions || [];

            if (sessions.length === 0) {
              detail.innerHTML = `<div class="session-block"><span class="session-date">Sem sessões registadas</span></div>`;
            } else {
              [...sessions].reverse().forEach((session) => {
                const sessionBlock = document.createElement('div');
                sessionBlock.className = 'session-block';

                const date = session.date
                  ? new Date(session.date).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '–';

                const setsContainer = document.createElement('div');
                setsContainer.className = 'session-sets';

                (session.sets || []).forEach((s, i) => {
                  const row = document.createElement('div');
                  row.className = 'set-detail-row';
                  if (exerciseName === 'treadmill') {
                    row.innerHTML = `
                      <span class="set-num">Série ${i + 1}</span>
                      <span>${s.time ?? 0} min</span>
                      <span>${s.kms ?? 0} km</span>
                      <span>${s.kcal ?? 0} kcal</span>
                      <button class="remove-set-btn" type="button" title="Remover série">−</button>
                    `;
                  } else {
                    row.innerHTML = `
                      <span class="set-num">Série ${i + 1}</span>
                      <span>${s.reps ?? 0} reps</span>
                      <span>${s.kg ?? 0} kg</span>
                      <span>RPE ${s.rpe ?? '–'}</span>
                      <button class="remove-set-btn" type="button" title="Remover série">−</button>
                    `;
                  }

                  row
                    .querySelector('.remove-set-btn')
                    .addEventListener('click', async (e) => {
                      e.stopPropagation();

                      try {
                        const clientRef = doc(
                          db,
                          'clientes',
                          appState.currentClient,
                        );
                        const clientSnap = await getDoc(clientRef);
                        const data = clientSnap.data();
                        const existing =
                          data.planosTreino?.planoPadrao?.exercicios?.[
                            exerciseName
                          ];
                        if (!existing) return;

                        const updatedSessions = existing.sessions
                          .map((sess) => {
                            if (sess.date !== session.date) return sess;
                            const updatedSets = sess.sets.filter(
                              (_, idx) => idx !== i,
                            );
                            return { ...sess, sets: updatedSets };
                          })
                          .filter((sess) => sess.sets.length > 0);

                        const removedKg = s.kg || 0;
                        const removedRpe = s.rpe || 0;

                        if (updatedSessions.length === 0) {
                          await updateDoc(clientRef, {
                            [`planosTreino.planoPadrao.exercicios.${exerciseName}`]:
                              deleteField(),
                          });
                        } else {
                          await updateDoc(clientRef, {
                            [`planosTreino.planoPadrao.exercicios.${exerciseName}`]:
                              {
                                ...existing,
                                vezesRealizado: Math.max(
                                  0,
                                  existing.vezesRealizado - 1,
                                ),
                                rpeTotal: Math.max(
                                  0,
                                  existing.rpeTotal - removedRpe,
                                ),
                                totalKg: Math.max(
                                  0,
                                  (existing.totalKg || 0) - removedKg,
                                ),
                                sessions: updatedSessions,
                              },
                          });
                        }

                        showToast('Série removida', 'success');
                        await paintMusclesForExercise(appState.currentClient);
                      } catch (err) {
                        console.error(err);
                        showToast('Erro ao remover série', 'error');
                      }
                    });

                  setsContainer.appendChild(row);
                });

                const dateHeader = document.createElement('div');
                dateHeader.className = 'session-date';
                dateHeader.innerHTML = `<i class="fas fa-chevron-down"></i>${date}`;

                dateHeader.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const isOpen = setsContainer.classList.contains('open');
                  setsContainer.classList.toggle('open', !isOpen);
                  dateHeader.classList.toggle('open', !isOpen);
                });

                sessionBlock.appendChild(dateHeader);
                sessionBlock.appendChild(setsContainer);
                detail.appendChild(sessionBlock);
              });
            }

            // Restore open states after re-render
            const displayName = exerciseName
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase());

            if (openExercise && openExercise === displayName) {
              detail.classList.add('open');
              exerciseItem.classList.add('detail-open');

              detail.querySelectorAll('.session-date').forEach((dateHeader) => {
                if (openDates.includes(dateHeader.textContent.trim())) {
                  dateHeader.classList.add('open');
                  dateHeader.nextSibling.classList.add('open');
                }
              });
            }

            exerciseItem.addEventListener('click', () => {
              const isOpen = detail.classList.contains('open');

              document
                .querySelectorAll('.exercise-detail.open')
                .forEach((d) => d.classList.remove('open'));
              document
                .querySelectorAll('.exercise-item.detail-open')
                .forEach((el) => el.classList.remove('detail-open'));

              if (!isOpen) {
                detail.classList.add('open');
                exerciseItem.classList.add('detail-open');
              }

              document.getElementById('exercise').value = exerciseName;
              document
                .getElementById('exercise')
                .dispatchEvent(new Event('change'));

              exerciseItem.classList.add('click-feedback');
              setTimeout(
                () => exerciseItem.classList.remove('click-feedback'),
                300,
              );
            });

            wrapper.appendChild(exerciseItem);
            wrapper.appendChild(detail);
            exercisesList.appendChild(wrapper);
          } catch (renderError) {
            console.error(`Erro ao renderizar exercício ${exerciseName}:`, renderError);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'exercise-error';
            errorMessage.style = 'color: rgba(255,255,255,0.7); padding: 10px;';
            errorMessage.textContent = `Erro ao carregar ${exerciseName}`;
            exercisesList.appendChild(errorMessage);
          }
          });
        }

        panel.classList.remove('hidden');
        panel.classList.toggle('collapsed', workoutPlanCollapsed);
      } else {
        panel.classList.add('hidden');
      }
    });
  } catch (error) {
    console.error('Erro ao carregar plano:', error);
    panel.classList.add('hidden');
    showToast('Erro ao carregar plano de treino', 'error');
  }
}

// ── Misc panel listeners ──────────────────────────────────────

function debounce(func, wait) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
}

window.addEventListener(
  'resize',
  debounce(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 100),
);

document.getElementById('workout-plan-header').addEventListener('click', () => {
  workoutPlanCollapsed = !workoutPlanCollapsed;
  const panel = document.getElementById('workout-plan-panel');
  panel.classList.toggle('collapsed', workoutPlanCollapsed);
});

let statsPanelVisible = false;

function updateStatsPanel(clientData) {
  if (!clientData || !clientData.planosTreino?.planoPadrao?.exercicios) {
    document.getElementById('total-exercises').textContent = '0';
    document.getElementById('top-muscle').textContent = 'N/A';
    return;
  }

  const exercises = clientData.planosTreino.planoPadrao.exercicios;

  const totalExercises = Object.values(exercises).reduce(
    (sum, ex) => sum + (ex.vezesRealizado || 0),
    0,
  );

  document.getElementById('total-exercises').textContent = totalExercises;
  document.getElementById('top-muscle').textContent = formatMuscleName(
    findTopMuscle(exercises),
  );
  document.getElementById('top-muscle').title =
    'Músculo com maior RPE acumulado';
}

function formatMuscleName(muscle) {
  if (muscle === 'N/A') return muscle;
  return muscle
    .replace(/([A-Z])/g, ' $1')
    .replace(/^ /, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

document.getElementById('toggle-stats').addEventListener('click', () => {
  statsPanelVisible = !statsPanelVisible;
  const panel = document.getElementById('stats-panel');
  panel.classList.toggle('hidden', !statsPanelVisible);
  if (statsPanelVisible) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

function findTopMuscle(exercises) {
  const muscleRpeScore = {};

  Object.entries(exercises).forEach(([exName, exData]) => {
    if (exerciseMap[exName] && exData.vezesRealizado > 0) {
      const avgRpe =
        exData.rpeTotal && exData.vezesRealizado > 0
          ? exData.rpeTotal / exData.vezesRealizado
          : 0;

      if (avgRpe <= 0) return;

      exerciseMap[exName].forEach((muscle) => {
        muscleRpeScore[muscle] = (muscleRpeScore[muscle] || 0) + avgRpe;
      });
    }
  });

  if (Object.keys(muscleRpeScore).length === 0) return 'N/A';

  const topMuscle = Object.entries(muscleRpeScore).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return topMuscle[0].replace(/_([LR])$/, ' $1');
}

document.getElementById('toggle-legend').addEventListener('click', () => {
  legendVisible = !legendVisible;
  const panel = document.getElementById('legend-panel');
  panel.classList.toggle('hidden', !legendVisible);

  if (legendVisible) {
    document.getElementById('stats-panel').classList.add('hidden');
    statsPanelVisible = false;
  }
});

document.addEventListener('click', (e) => {
  const legendPanel = document.getElementById('legend-panel');
  const legendBtn = document.getElementById('toggle-legend');

  if (!legendPanel.contains(e.target) && !legendBtn.contains(e.target)) {
    legendPanel.classList.add('hidden');
    legendVisible = false;
  }
});

// Auth event listeners
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('login-error').textContent = '';
  } catch (error) {
    document.getElementById('login-error').textContent = error.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut(auth);
});
