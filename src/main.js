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
  onSnapshot,
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

let legendVisible = false;

let workoutPlanCollapsed = false;

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
    showToast('Ocorreu um erro ao carregar a aplicação');
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

    const muscleIntensity = {};
    const exercises =
      clientSnap.data().planosTreino?.planoPadrao?.exercicios || {};

    // 1. Calcula a intensidade total para cada músculo
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
    model.traverse((child) => {
      if (child.isMesh && originalColors[child.name]) {
        // Reseta para a cor original primeiro
        child.material.color.copy(originalColors[child.name]);

        // Aplica nova cor se o músculo estiver no mapa de intensidade
        if (muscleIntensity[child.name] > 0) {
          const intensity = Math.min(0.9, muscleIntensity[child.name] * 0.1);
          const color = new THREE.Color(1 - intensity, 1 - intensity, 1);
          child.material.color.copy(color);
        }
      }
    });
  } catch (error) {
    console.error('Erro ao pintar músculos:', error);
  }
}

exerciseSelect.insertAdjacentHTML(
  'afterbegin',
  '<option value="" selected disabled>Selecionar exercício</option>'
);
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

    if (!clientId) {
      showToast('Selecione um cliente primeiro!');
      return;
    }

    if (!exercise) {
      showToast('Selecione um exercício válido!');
      return;
    }

    const clientRef = doc(db, 'clientes', clientId);

    try {
      // Primeiro obtemos o valor atual
      const clientSnap = await getDoc(clientRef);

      if (!clientSnap.exists()) {
        showToast('Cliente não encontrado!');
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
      showToast(`Exercício adicionado! Total: ${currentCount + 1}`);
      await updateWorkoutPlanPanel(clientId);
    } catch (error) {
      console.error('Erro ao adicionar exercício:', error);
      showToast('Erro ao atualizar o exercício: ' + error.message);
    }
    const clientSnap = await getDoc(doc(db, 'clientes', clientId));
    if (clientSnap.exists()) updateStatsPanel(clientSnap.data());
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
      showToast('Já existe um cliente com este email ou telemovel!');
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
      '<option value="" disabled selected>Selecionar cliente</option>';

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
    showToast('Preencha todos os campos!');
    return;
  }

  // Validação simples do telemovel
  if (!/^[9][0-9]{8}$/.test(telemovel)) {
    showToast(
      'Número de telemóvel inválido! Deve começar com 9 e ter 9 dígitos.'
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

document
  .getElementById('client-select')
  .addEventListener('change', async (e) => {
    const clientId = e.target.value;
    appState.currentClient = clientId;
    if (unsubscribeWorkoutPlan) {
      unsubscribeWorkoutPlan();
    }

    await updateWorkoutPlanPanel(clientId);
    document.getElementById('remove-client').disabled = !clientId;
    // Atualiza o painel do plano de treino
    await updateWorkoutPlanPanel(clientId);
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
    if (clientId) {
      const clientSnap = await getDoc(doc(db, 'clientes', clientId));
      if (clientSnap.exists()) {
        updateStatsPanel(clientSnap.data());
      }
    } else {
      // Resetar estatísticas quando nenhum cliente está selecionado
      document.getElementById('total-exercises').textContent = '0';
      document.getElementById('last-exercise').textContent = 'N/A';
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

    showToast('Cliente removido com sucesso!');
    document.getElementById('workout-plan-panel').classList.add('hidden');
  } catch (error) {
    console.error('Erro ao remover cliente:', error);
    showToast('Erro ao remover cliente: ' + error.message);
  }
}

document.getElementById('remove-client').addEventListener('click', async () => {
  const clientId = document.getElementById('client-select').value;

  if (!clientId) {
    showToast('Selecione um cliente para remover!');
    return;
  }

  await removeClient(clientId);
});

// Desabilita o botão inicialmente
document.getElementById('add-exercise').disabled = true;
document.getElementById('remove-exercise').disabled = true;

// Adiciona event listener para o dropdown de exercícios
document.getElementById('exercise').addEventListener('change', function (e) {
  const exerciseSelected = e.target.value;
  exerciseSelect.addEventListener('change', (e) => {
    document.querySelectorAll('.exercise-item').forEach((item) => {
      item.classList.remove('active-exercise');
      if (item.textContent.includes(e.target.value.replace(/_/g, ' '))) {
        item.classList.add('active-exercise');
      }
    });
  });
  document.querySelectorAll('.exercise-item').forEach((item) => {
    item.classList.remove('active-exercise');
  });

  // Adiciona a classe 'active' ao item correspondente
  if (e.target.value) {
    const exerciseName = e.target.value.replace(/_/g, ' ');
    const exerciseItems = document.querySelectorAll('.exercise-item');

    exerciseItems.forEach((item) => {
      if (item.textContent.includes(exerciseName)) {
        item.classList.add('active-exercise');

        // Scroll automático para o item (opcional)
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
  document.getElementById('add-exercise').disabled = !exerciseSelected;
  document.getElementById('remove-exercise').disabled = !exerciseSelected;
});

// Adiciona o event listener para o botão de remover exercício
document
  .getElementById('remove-exercise')
  .addEventListener('click', async function () {
    const clientId = document.getElementById('client-select').value;
    const exercise = document.getElementById('exercise').value;

    if (!clientId) {
      showToast('Selecione um cliente primeiro!');
      return;
    }

    if (!exercise) {
      showToast('Selecione um exercício válido!');
      return;
    }

    const clientRef = doc(db, 'clientes', clientId);

    try {
      // Primeiro obtemos o valor atual
      const clientSnap = await getDoc(clientRef);

      if (!clientSnap.exists()) {
        showToast('Cliente não encontrado!');
        return;
      }

      const currentData = clientSnap.data();
      const currentCount =
        currentData.planosTreino?.planoPadrao?.exercicios?.[exercise]
          ?.vezesRealizado || 0;

      // Verifica se já está em zero
      if (currentCount <= 0) {
        showToast('Este exercício já está com contagem zero!');
        return;
      }

      // Atualiza decrementando o valor existente
      await updateDoc(clientRef, {
        [`planosTreino.planoPadrao.exercicios.${exercise}`]: {
          nome: exercise,
          vezesRealizado: currentCount - 1,
          ultimaData: new Date().toISOString(),
        },
      });

      // Atualiza as cores dos músculos
      await paintMusclesForExercise(clientId);
      showToast(`Exercício removido! Total: ${currentCount - 1}`);
      await updateWorkoutPlanPanel(clientId);
    } catch (error) {
      console.error('Erro ao remover exercício:', error);
      showToast('Erro ao atualizar o exercício: ' + error.message);
    }
    const clientSnap = await getDoc(doc(db, 'clientes', clientId));
    if (clientSnap.exists()) updateStatsPanel(clientSnap.data());
  });

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

let unsubscribeWorkoutPlan = null; // Variável para armazenar a função de unsubscribe

async function updateWorkoutPlanPanel(clientId) {
  const panel = document.getElementById('workout-plan-panel');
  const clientNameDisplay = document.getElementById('client-name-display');
  const exercisesList = document.getElementById('exercises-list');

  // Cancela o listener anterior se existir
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

    // Adiciona o listener em tempo real
    unsubscribeWorkoutPlan = onSnapshot(clientRef, (doc) => {
      if (doc.exists()) {
        const clientData = doc.data();
        const exercises =
          clientData.planosTreino?.planoPadrao?.exercicios || {};

        clientNameDisplay.textContent = clientData.nome;
        exercisesList.innerHTML = '';

        const validExercises = Object.entries(exercises)
          .filter(([_, exerciseData]) => exerciseData.vezesRealizado > 0)
          .sort((a, b) => b[1].vezesRealizado - a[1].vezesRealizado);

        if (validExercises.length === 0) {
          exercisesList.innerHTML =
            '<p style="color: rgba(255,255,255,0.6)">Nenhum exercício registrado</p>';
        } else {
          validExercises.forEach(([exerciseName, exerciseData]) => {
            const exerciseItem = document.createElement('div');
            exerciseItem.className = 'exercise-item';
            exerciseItem.innerHTML = `
              <span class="exercise-name">${exerciseName
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())}</span>
              <span class="exercise-count">${
                exerciseData.vezesRealizado
              }x</span>
            `;
            // Event listener para cada item
            exerciseItem.addEventListener('click', () => {
              // Seleciona o exercício no dropdown
              document.getElementById('exercise').value = exerciseName;

              // Dispara o evento change para atualizar outros elementos
              document
                .getElementById('exercise')
                .dispatchEvent(new Event('change'));

              // Feedback visual (opcional)
              exerciseItem.classList.add('click-feedback');
              setTimeout(() => {
                exerciseItem.classList.remove('click-feedback');
              }, 300);
            });
            exercisesList.appendChild(exerciseItem);
          });
        }

        panel.classList.remove('hidden');
        // Mantém o estado de colapso ao mudar de cliente
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
  }, 100)
);

const exerciseCache = {};

document.getElementById('workout-plan-header').addEventListener('click', () => {
  workoutPlanCollapsed = !workoutPlanCollapsed;
  const panel = document.getElementById('workout-plan-panel');
  panel.classList.toggle('collapsed', workoutPlanCollapsed);
});

async function getExercisesForClient(clientId) {
  if (exerciseCache[clientId]) {
    return exerciseCache[clientId];
  }
  // ... consulta ao Firebase ...
  exerciseCache[clientId] = result;
  return result;
}

// Variável para controlar o estado do painel
let statsPanelVisible = false;

// Função para atualizar as estatísticas
function updateStatsPanel(clientData) {
  if (!clientData || !clientData.planosTreino?.planoPadrao?.exercicios) {
    // Resetar se não houver dados
    document.getElementById('total-exercises').textContent = '0';
    document.getElementById('top-muscle').textContent = 'N/A';
    document.getElementById('last-exercise').textContent = 'N/A';
    return;
  }

  const exercises = clientData.planosTreino.planoPadrao.exercicios;

  // Calcula totais
  const totalExercises = Object.values(exercises).reduce(
    (sum, ex) => sum + (ex.vezesRealizado || 0),
    0
  );

  // Encontra o exercício mais recente
  let lastExercise = { nome: 'N/A', data: 0 };
  Object.entries(exercises).forEach(([name, data]) => {
    if (data.ultimaData) {
      const exerciseDate = new Date(data.ultimaData).getTime();
      if (exerciseDate > lastExercise.data) {
        lastExercise = {
          nome: name,
          data: exerciseDate,
        };
      }
    }
  });

  // Atualiza a UI
  document.getElementById('total-exercises').textContent = totalExercises;
  document.getElementById('top-muscle').textContent = formatMuscleName(
    findTopMuscle(exercises)
  );
  document.getElementById('top-muscle').title = `Total: ${
    muscleCount[topMuscle] || 0
  } sessões`;
  document.getElementById('last-exercise').textContent = lastExercise.nome
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// Função auxiliar para formatar nomes de músculos
function formatMuscleName(muscle) {
  if (muscle === 'N/A') return muscle;
  return muscle
    .replace(/([A-Z])/g, ' $1') // Adiciona espaço antes de maiúsculas
    .replace(/^ /, '') // Remove espaço inicial
    .replace(/_/g, ' ') // Substitui underscores
    .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitaliza
}

// Listener para o botão de toggle
document.getElementById('toggle-stats').addEventListener('click', () => {
  statsPanelVisible = !statsPanelVisible;
  const panel = document.getElementById('stats-panel');
  panel.classList.toggle('hidden', !statsPanelVisible);
  if (statsPanelVisible) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

function findTopMuscle(exercises) {
  const muscleCount = {};

  Object.entries(exercises).forEach(([exName, exData]) => {
    // Verifica se o exercício existe no exerciseMap e se foi realizado pelo menos 1 vez
    if (exerciseMap[exName] && exData.vezesRealizado > 0) {
      exerciseMap[exName].forEach((muscle) => {
        muscleCount[muscle] =
          (muscleCount[muscle] || 0) + exData.vezesRealizado;
      });
    }
  });

  if (Object.keys(muscleCount).length === 0) return 'N/A';

  const topMuscle = Object.entries(muscleCount).sort((a, b) => b[1] - a[1])[0];
  return topMuscle[0].replace(/_([LR])$/, ' $1'); // Remove underscores e mantém L/R
}

document.getElementById('toggle-legend').addEventListener('click', () => {
  legendVisible = !legendVisible;
  const panel = document.getElementById('legend-panel');
  panel.classList.toggle('hidden', !legendVisible);

  // Fecha outros painéis se necessário
  if (legendVisible) {
    document.getElementById('stats-panel').classList.add('hidden');
    statsPanelVisible = false;
  }
});

// Fecha a legenda ao clicar fora
document.addEventListener('click', (e) => {
  const legendPanel = document.getElementById('legend-panel');
  const legendBtn = document.getElementById('toggle-legend');

  if (!legendPanel.contains(e.target) && !legendBtn.contains(e.target)) {
    legendPanel.classList.add('hidden');
    legendVisible = false;
  }
});
