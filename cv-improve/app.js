import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const STORAGE_KEY = "wowfit-cv-leaderboard-v2";
const CURRENT_USER_ID = "current-user";

const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const EXERCISES = {
  squat: {
    name: "Приседания",
    mainLabel: "Приседания",
    primaryAngleLabel: "Угол колена",
    instruction:
      "<strong>Приседания:</strong> повернитесь боком, в кадре должны быть видны голова и стопы. Начните из полностью выпрямленного положения.",
    hint:
      "Если полуприсед засчитывается — уменьшите нижний порог. Если глубокий присед не засчитывается — увеличьте его.",
    settings: [
      { key: "bottom", label: "Нижняя фаза", min: 80, max: 140, step: 1, value: 115, suffix: "°" },
      { key: "top", label: "Верхняя фаза", min: 140, max: 178, step: 1, value: 155, suffix: "°" },
    ],
  },

  pushup: {
    name: "Отжимания",
    mainLabel: "Отжимания",
    primaryAngleLabel: "Угол локтя",
    instruction:
      "<strong>Отжимания:</strong> поставьте камеру сбоку и низко. В кадре должны быть плечи, кисти, таз и опорная точка — стопы или колени.",
    hint:
      "Классические отжимания проверяют линию плечо–таз–стопа. Отжимания от колен — линию плечо–таз–колено.",
    settings: [
      { key: "bottom", label: "Нижняя фаза", min: 65, max: 130, step: 1, value: 90, suffix: "°" },
      { key: "top", label: "Верхняя фаза", min: 120, max: 178, step: 1, value: 125, suffix: "°" },
      { key: "bodyLine", label: "Минимальный угол корпуса", min: 135, max: 178, step: 1, value: 160, suffix: "°" },
    ],
  },

  plank: {
    name: "Планка",
    mainLabel: "Корректное удержание",
    primaryAngleLabel: "Линия корпуса",
    instruction:
      "<strong>Планка:</strong> поставьте камеру сбоку и низко. Таймер идёт только тогда, когда плечи, таз и стопы образуют почти прямую линию.",
    hint:
      "Если правильная планка не принимается — уменьшите минимальный угол корпуса или увеличьте допустимый наклон.",
    settings: [
      { key: "bodyLine", label: "Минимальный угол корпуса", min: 140, max: 178, step: 1, value: 160, suffix: "°" },
      { key: "maxTilt", label: "Максимальный наклон к горизонту", min: 15, max: 50, step: 1, value: 35, suffix: "°" },
    ],
  },
};

const DEFAULT_LEADERBOARD = {
  individuals: [
    { id: "anna", name: "Анна", team: "Fit Force", score: 420, avatar: "👩" },
    { id: "max", name: "Максим", team: "Power Team", score: 355, avatar: "👨" },
    { id: "olga", name: "Ольга", team: "Fit Force", score: 290, avatar: "👩‍🦰" },
    { id: CURRENT_USER_ID, name: "Вы", team: "Wow Team", score: 0, avatar: "🙂" },
  ],
  teams: [
    { id: "fit-force", name: "Fit Force", score: 710, avatar: "🟢" },
    { id: "power-team", name: "Power Team", score: 355, avatar: "🟠" },
    { id: "wow-team", name: "Wow Team", score: 0, avatar: "🟩" },
  ],
};

const video = document.querySelector("#video");
const canvas = document.querySelector("#overlay");
const context = canvas.getContext("2d");

const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const saveResultButton = document.querySelector("#saveResultButton");
const loader = document.querySelector("#loader");
const loaderText = document.querySelector("#loaderText");
const placeholder = document.querySelector("#cameraPlaceholder");
const errorBox = document.querySelector("#errorBox");

const instructions = document.querySelector("#instructions");
const pushupVariantPanel = document.querySelector("#pushupVariantPanel");
const exerciseCards = [...document.querySelectorAll(".exercise-card")];
const variantButtons = [...document.querySelectorAll("[data-variant]")];

const mainMetricLabel = document.querySelector("#mainMetricLabel");
const mainMetricValue = document.querySelector("#mainMetricValue");
const phaseElement = document.querySelector("#phase");
const primaryAngleLabel = document.querySelector("#primaryAngleLabel");
const primaryAngleElement = document.querySelector("#primaryAngle");
const secondaryMetricLabel = document.querySelector("#secondaryMetricLabel");
const secondaryMetricValue = document.querySelector("#secondaryMetricValue");
const inferenceTimeElement = document.querySelector("#inferenceTime");
const statusElement = document.querySelector("#status");

const dynamicSettings = document.querySelector("#dynamicSettings");
const visibilityThresholdInput = document.querySelector("#visibilityThreshold");
const visibilityValue = document.querySelector("#visibilityValue");
const settingsHint = document.querySelector("#settingsHint");

const sideNavItems = [...document.querySelectorAll("[data-view]")];
const workoutView = document.querySelector("#workoutView");
const leaderboardView = document.querySelector("#leaderboardView");

const currentRank = document.querySelector("#currentRank");
const currentScore = document.querySelector("#currentScore");
const participantsCount = document.querySelector("#participantsCount");
const individualLeaderboardList = document.querySelector("#individualLeaderboardList");
const teamLeaderboardList = document.querySelector("#teamLeaderboardList");
const clearLeaderboardButton = document.querySelector("#clearLeaderboardButton");
const leaderboardTabs = [...document.querySelectorAll(".leaderboard-tab")];
const individualBoard = document.querySelector("#individualBoard");
const teamsBoard = document.querySelector("#teamsBoard");

let poseLandmarker = null;
let drawingUtils = null;
let cameraStream = null;
let animationFrameId = null;
let running = false;
let lastVideoTime = -1;
let lastInferenceAt = 0;

let currentExercise = "squat";
let pushupVariant = "classic";
let exerciseValues = {};

let repCount = 0;
let repState = "WAITING_FOR_TOP";
let stableTopFrames = 0;
let stableBottomFrames = 0;
let stableValidFrames = 0;

let smoothedPrimaryAngle = null;
let smoothedBodyLine = null;
let smoothedTilt = null;

let plankHoldMs = 0;
let plankLastTimestamp = null;

const MIN_STABLE_FRAMES = 3;
const PUSHUP_MIN_STABLE_FRAMES = 1;
const PUSHUP_SMOOTH_ALPHA = 0.45;
const PUSHUP_CLASSIC_MAX_TILT = 25;
const PLANK_STABLE_FRAMES = 5;
const INFERENCE_INTERVAL_MS = 50;

function cloneDefaultLeaderboard() {
  return JSON.parse(JSON.stringify(DEFAULT_LEADERBOARD));
}

function loadLeaderboard() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const initial = cloneDefaultLeaderboard();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const initial = cloneDefaultLeaderboard();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function saveLeaderboard(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function setLoader(visible, text = "Загрузка…") {
  loaderText.textContent = text;
  loader.classList.toggle("hidden", !visible);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function formatDuration(milliseconds) {
  const totalSeconds = milliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds % 1) * 10);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function getCurrentResultValue() {
  if (currentExercise === "plank") {
    return Math.floor(plankHoldMs / 1000);
  }

  return repCount;
}

function getResultScore() {
  const value = getCurrentResultValue();

  if (currentExercise === "pushup") {
    return value * 2;
  }

  return value;
}

function renderExerciseSettings() {
  const config = EXERCISES[currentExercise];
  exerciseValues = {};

  instructions.innerHTML = config.instruction;
  mainMetricLabel.textContent = config.mainLabel;
  primaryAngleLabel.textContent = config.primaryAngleLabel;
  settingsHint.textContent = config.hint;

  pushupVariantPanel.classList.toggle("hidden", currentExercise !== "pushup");
  dynamicSettings.innerHTML = "";

  for (const setting of config.settings) {
    exerciseValues[setting.key] = setting.value;

    const label = document.createElement("label");
    label.className = "setting-row";

    const title = document.createElement("span");
    title.innerHTML = `${setting.label}: <b id="value-${setting.key}">${setting.value}${setting.suffix}</b>`;

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(setting.min);
    input.max = String(setting.max);
    input.step = String(setting.step);
    input.value = String(setting.value);

    input.addEventListener("input", () => {
      exerciseValues[setting.key] = Number(input.value);
      document.querySelector(`#value-${setting.key}`).textContent =
        `${input.value}${setting.suffix}`;
    });

    label.append(title, input);
    dynamicSettings.append(label);
  }

  if (currentExercise === "plank") {
    secondaryMetricLabel.textContent = "Наклон к горизонту";
  } else if (currentExercise === "pushup") {
    secondaryMetricLabel.textContent =
      pushupVariant === "classic" ? "Линия до стоп" : "Линия до колен";
  } else {
    secondaryMetricLabel.textContent = "Сторона";
  }

  resetExercise();
}

function resetExercise() {
  repCount = 0;
  repState = "WAITING_FOR_TOP";
  stableTopFrames = 0;
  stableBottomFrames = 0;
  stableValidFrames = 0;

  smoothedPrimaryAngle = null;
  smoothedBodyLine = null;
  smoothedTilt = null;

  plankHoldMs = 0;
  plankLastTimestamp = null;

  mainMetricValue.textContent =
    currentExercise === "plank" ? "00:00.0" : "0";
  phaseElement.textContent = "Ожидание";
  primaryAngleElement.textContent = "—";
  secondaryMetricValue.textContent = "—";
  saveResultButton.disabled = true;
}

exerciseCards.forEach((card) => {
  card.addEventListener("click", () => {
    currentExercise = card.dataset.exercise;

    exerciseCards.forEach((item) => {
      item.classList.toggle("active", item === card);
    });

    renderExerciseSettings();
  });
});

variantButtons.forEach((button) => {
  button.addEventListener("click", () => {
    pushupVariant = button.dataset.variant;

    variantButtons.forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    secondaryMetricLabel.textContent =
      pushupVariant === "classic" ? "Линия до стоп" : "Линия до колен";

    resetExercise();
  });
});

resetButton.addEventListener("click", resetExercise);

visibilityThresholdInput.addEventListener("input", () => {
  visibilityValue.textContent =
    Number(visibilityThresholdInput.value).toFixed(2);
});

function switchView(viewName) {
  workoutView.classList.toggle("active", viewName === "workout");
  leaderboardView.classList.toggle("active", viewName === "leaderboard");

  sideNavItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  if (viewName === "leaderboard") {
    renderLeaderboard();
  }
}

sideNavItems.forEach((button) => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});

leaderboardTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const board = button.dataset.board;

    leaderboardTabs.forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    individualBoard.classList.toggle("active", board === "individual");
    teamsBoard.classList.toggle("active", board === "teams");
  });
});

clearLeaderboardButton.addEventListener("click", () => {
  const data = cloneDefaultLeaderboard();
  saveLeaderboard(data);
  renderLeaderboard();
});

function renderLeaderboard() {
  const data = loadLeaderboard();

  const individuals = [...data.individuals]
    .sort((a, b) => b.score - a.score);

  const teams = [...data.teams]
    .sort((a, b) => b.score - a.score);

  individualLeaderboardList.innerHTML = "";
  teamLeaderboardList.innerHTML = "";

  individuals.forEach((player, index) => {
    const row = document.createElement("article");
    row.className = "leaderboard-row";

    if (player.id === CURRENT_USER_ID) {
      row.classList.add("current");
    }

    row.innerHTML = `
      <div class="rank">${index + 1}</div>
      <div class="player">
        <div class="avatar">${player.avatar}</div>
        <div>
          <span class="player-name">${player.name}</span>
          <span class="player-meta">${player.team}</span>
        </div>
      </div>
      <div class="points">${player.score} очков</div>
    `;

    individualLeaderboardList.append(row);
  });

  teams.forEach((team, index) => {
    const row = document.createElement("article");
    row.className = "leaderboard-row";

    if (team.id === "wow-team") {
      row.classList.add("current");
    }

    row.innerHTML = `
      <div class="rank">${index + 1}</div>
      <div class="player">
        <div class="avatar">${team.avatar}</div>
        <div>
          <span class="player-name">${team.name}</span>
          <span class="player-meta">Командный результат</span>
        </div>
      </div>
      <div class="points">${team.score} очков</div>
    `;

    teamLeaderboardList.append(row);
  });

  const currentUser = individuals.find(
    (player) => player.id === CURRENT_USER_ID
  );

  const currentUserRank =
    individuals.findIndex(
      (player) => player.id === CURRENT_USER_ID
    ) + 1;

  currentRank.textContent = currentUserRank || "—";
  currentScore.textContent = currentUser?.score ?? 0;
  participantsCount.textContent = individuals.length;
}

saveResultButton.addEventListener("click", () => {
  const score = getResultScore();

  if (score <= 0) {
    return;
  }

  const data = loadLeaderboard();
  const currentUser = data.individuals.find(
    (player) => player.id === CURRENT_USER_ID
  );
  const currentTeam = data.teams.find(
    (team) => team.id === "wow-team"
  );

  if (currentUser) {
    currentUser.score += score;
  }

  if (currentTeam) {
    currentTeam.score += score;
  }

  saveLeaderboard(data);
  saveResultButton.textContent = `Сохранено: +${score} очков`;
  saveResultButton.disabled = true;
  renderLeaderboard();

  window.setTimeout(() => {
    saveResultButton.textContent =
      "Сохранить результат в лидерборд";
  }, 1800);
});

renderExerciseSettings();
renderLeaderboard();

async function createPoseLandmarker() {
  if (poseLandmarker) {
    return poseLandmarker;
  }

  setLoader(true, "Загрузка MediaPipe и модели…");
  statusElement.textContent = "Загрузка модели";

  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);

  const commonOptions = {
    baseOptions: {
      modelAssetPath: MODEL_URL,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  };

  try {
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      ...commonOptions,
      baseOptions: {
        ...commonOptions.baseOptions,
        delegate: "GPU",
      },
    });

    statusElement.textContent = "Модель загружена: GPU";
  } catch (gpuError) {
    console.warn("GPU delegate недоступен, используется CPU.", gpuError);

    poseLandmarker = await PoseLandmarker.createFromOptions(
      vision,
      commonOptions
    );

    statusElement.textContent = "Модель загружена: CPU";
  }

  drawingUtils = new DrawingUtils(context);
  return poseLandmarker;
}

async function startCamera() {
  clearError();

  if (!navigator.mediaDevices?.getUserMedia) {
    showError(
      "Браузер не поддерживает камеру. Откройте приложение в современном Chrome."
    );
    return;
  }

  startButton.disabled = true;

  try {
    await createPoseLandmarker();
    setLoader(true, "Запуск камеры…");

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    video.srcObject = cameraStream;

    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
    });

    await video.play();
    resizeCanvas();

    placeholder.classList.add("hidden");
    setLoader(false);

    running = true;
    resetButton.disabled = false;
    startButton.textContent = "Камера запущена";
    statusElement.textContent = "Ищу человека в кадре";

    window.addEventListener("resize", resizeCanvas);
    animationFrameId = requestAnimationFrame(processFrame);
  } catch (error) {
    console.error(error);
    setLoader(false);
    startButton.disabled = false;

    const reason =
      error?.name === "NotAllowedError"
        ? "Доступ к камере запрещён. Разрешите камеру в настройках браузера."
        : "Не удалось запустить камеру или загрузить модель. Проверьте интернет и localhost.";

    showError(reason);
    statusElement.textContent = "Ошибка";
  }
}

startButton.addEventListener("click", startCamera);

function resizeCanvas() {
  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  if (
    canvas.width !== video.videoWidth ||
    canvas.height !== video.videoHeight
  ) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

function calculateAngle(first, vertex, third) {
  const vectorA = {
    x: first.x - vertex.x,
    y: first.y - vertex.y,
  };

  const vectorB = {
    x: third.x - vertex.x,
    y: third.y - vertex.y,
  };

  const dot =
    vectorA.x * vectorB.x +
    vectorA.y * vectorB.y;

  const lengthA = Math.hypot(vectorA.x, vectorA.y);
  const lengthB = Math.hypot(vectorB.x, vectorB.y);

  if (lengthA < 1e-6 || lengthB < 1e-6) {
    return null;
  }

  const cosine = Math.max(
    -1,
    Math.min(1, dot / (lengthA * lengthB))
  );

  return (Math.acos(cosine) * 180) / Math.PI;
}

function angleToHorizontal(first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return null;
  }

  let angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

  if (angle > 90) {
    angle = 180 - angle;
  }

  return angle;
}

function smooth(previous, next, alpha = 0.35) {
  return previous === null
    ? next
    : alpha * next + (1 - alpha) * previous;
}

function minVisibility(landmarks, indices) {
  return Math.min(
    ...indices.map(
      (index) => landmarks[index]?.visibility ?? 0
    )
  );
}

function chooseSide(landmarks, leftIndices, rightIndices) {
  const leftVisibility = minVisibility(landmarks, leftIndices);
  const rightVisibility = minVisibility(landmarks, rightIndices);

  return {
    side: leftVisibility >= rightVisibility ? "left" : "right",
    visibility: Math.max(leftVisibility, rightVisibility),
  };
}

function getSideIndices(side) {
  if (side === "left") {
    return {
      shoulder: LANDMARKS.LEFT_SHOULDER,
      elbow: LANDMARKS.LEFT_ELBOW,
      wrist: LANDMARKS.LEFT_WRIST,
      hip: LANDMARKS.LEFT_HIP,
      knee: LANDMARKS.LEFT_KNEE,
      ankle: LANDMARKS.LEFT_ANKLE,
    };
  }

  return {
    shoulder: LANDMARKS.RIGHT_SHOULDER,
    elbow: LANDMARKS.RIGHT_ELBOW,
    wrist: LANDMARKS.RIGHT_WRIST,
    hip: LANDMARKS.RIGHT_HIP,
    knee: LANDMARKS.RIGHT_KNEE,
    ankle: LANDMARKS.RIGHT_ANKLE,
  };
}

function measureSquat(landmarks) {
  const choice = chooseSide(
    landmarks,
    [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
    [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE]
  );

  const indices = getSideIndices(choice.side);

  return {
    side: choice.side,
    visibility: choice.visibility,
    primaryAngle: calculateAngle(
      landmarks[indices.hip],
      landmarks[indices.knee],
      landmarks[indices.ankle]
    ),
    bodyLine: null,
    tilt: null,
    labelPoint: landmarks[indices.knee],
  };
}

function measureHorizontalExercise(landmarks) {
  const leftRequired =
    pushupVariant === "knees"
      ? [
          LANDMARKS.LEFT_SHOULDER,
          LANDMARKS.LEFT_ELBOW,
          LANDMARKS.LEFT_WRIST,
          LANDMARKS.LEFT_HIP,
          LANDMARKS.LEFT_KNEE,
        ]
      : [
          LANDMARKS.LEFT_SHOULDER,
          LANDMARKS.LEFT_ELBOW,
          LANDMARKS.LEFT_WRIST,
          LANDMARKS.LEFT_HIP,
          LANDMARKS.LEFT_ANKLE,
        ];

  const rightRequired =
    pushupVariant === "knees"
      ? [
          LANDMARKS.RIGHT_SHOULDER,
          LANDMARKS.RIGHT_ELBOW,
          LANDMARKS.RIGHT_WRIST,
          LANDMARKS.RIGHT_HIP,
          LANDMARKS.RIGHT_KNEE,
        ]
      : [
          LANDMARKS.RIGHT_SHOULDER,
          LANDMARKS.RIGHT_ELBOW,
          LANDMARKS.RIGHT_WRIST,
          LANDMARKS.RIGHT_HIP,
          LANDMARKS.RIGHT_ANKLE,
        ];

  const choice = chooseSide(
    landmarks,
    leftRequired,
    rightRequired
  );

  const indices = getSideIndices(choice.side);
  const shoulder = landmarks[indices.shoulder];
  const elbow = landmarks[indices.elbow];
  const wrist = landmarks[indices.wrist];
  const hip = landmarks[indices.hip];
  const knee = landmarks[indices.knee];
  const ankle = landmarks[indices.ankle];

  const supportPoint =
    currentExercise === "pushup" && pushupVariant === "knees"
      ? knee
      : ankle;

  return {
    side: choice.side,
    visibility: choice.visibility,
    elbowAngle: calculateAngle(shoulder, elbow, wrist),
    bodyLine: calculateAngle(shoulder, hip, supportPoint),
    tilt: angleToHorizontal(shoulder, supportPoint),
    shoulder,
    hip,
    knee,
    ankle,
    supportPoint,
    labelPoint:
      currentExercise === "pushup" ? elbow : hip,
  };
}

function drawResults(landmarks, measurement) {
  context.clearRect(0, 0, canvas.width, canvas.height);

  drawingUtils.drawConnectors(
    landmarks,
    PoseLandmarker.POSE_CONNECTIONS,
    {
      color: "#b8e52f",
      lineWidth: 4,
    }
  );

  drawingUtils.drawLandmarks(landmarks, {
    color: "#ffffff",
    fillColor: "#ffb000",
    radius: 4,
  });

  if (
    !measurement.labelPoint ||
    measurement.primaryAngle === null
  ) {
    return;
  }

  const x = measurement.labelPoint.x * canvas.width;
  const y = measurement.labelPoint.y * canvas.height;

  context.save();
  context.font = "700 28px system-ui";
  context.textAlign = "center";
  context.lineWidth = 6;
  context.strokeStyle = "rgba(0, 0, 0, 0.72)";
  context.fillStyle = "#ffffff";

  const label = `${Math.round(measurement.primaryAngle)}°`;

  context.strokeText(label, x, y - 24);
  context.fillText(label, x, y - 24);
  context.restore();
}

function updateRepState(primaryAngle) {
  const bottomThreshold = exerciseValues.bottom;
  const topThreshold = exerciseValues.top;
  const requiredStableFrames =
    currentExercise === "pushup"
      ? PUSHUP_MIN_STABLE_FRAMES
      : MIN_STABLE_FRAMES;

  const isTop = primaryAngle >= topThreshold;
  const isBottom = primaryAngle <= bottomThreshold;

  stableTopFrames = isTop ? stableTopFrames + 1 : 0;
  stableBottomFrames = isBottom ? stableBottomFrames + 1 : 0;

  if (repState === "WAITING_FOR_TOP") {
    phaseElement.textContent =
      currentExercise === "squat"
        ? "Встаньте прямо"
        : "Выпрямите руки";

    if (stableTopFrames >= requiredStableFrames) {
      repState = "READY";
      phaseElement.textContent = "Верх";
    }

    return;
  }

  if (repState === "READY") {
    if (isBottom) {
      phaseElement.textContent = "Внизу";
    } else if (!isTop) {
      phaseElement.textContent = "Опускаетесь";
    } else {
      phaseElement.textContent = "Верх";
    }

    if (stableBottomFrames >= requiredStableFrames) {
      repState = "BOTTOM_REACHED";
      phaseElement.textContent = "Внизу";
    }

    return;
  }

  if (repState === "BOTTOM_REACHED") {
    phaseElement.textContent =
      isTop ? "Верх" : "Поднимаетесь";

    if (stableTopFrames >= requiredStableFrames) {
      repCount += 1;
      mainMetricValue.textContent = String(repCount);
      repState = "READY";
      phaseElement.textContent = "Засчитано";
      saveResultButton.disabled = false;
    }
  }
}

function analyzeSquat(measurement) {
  smoothedPrimaryAngle = smooth(
    smoothedPrimaryAngle,
    measurement.primaryAngle
  );

  primaryAngleElement.textContent =
    String(Math.round(smoothedPrimaryAngle));

  secondaryMetricValue.textContent =
    measurement.side === "left" ? "Левая" : "Правая";

  statusElement.textContent = "Поза распознана";
  updateRepState(smoothedPrimaryAngle);
}

function analyzePushup(measurement) {
  smoothedPrimaryAngle = smooth(
    smoothedPrimaryAngle,
    measurement.elbowAngle,
    PUSHUP_SMOOTH_ALPHA
  );

  smoothedBodyLine = smooth(
    smoothedBodyLine,
    measurement.bodyLine,
    PUSHUP_SMOOTH_ALPHA
  );

  smoothedTilt = smooth(
    smoothedTilt,
    measurement.tilt,
    PUSHUP_SMOOTH_ALPHA
  );

  measurement.primaryAngle = smoothedPrimaryAngle;

  primaryAngleElement.textContent =
    String(Math.round(smoothedPrimaryAngle));

  secondaryMetricValue.textContent =
    `${Math.round(smoothedBodyLine)}°`;

  const bodyIsStraight =
    smoothedBodyLine >= exerciseValues.bodyLine;

  const maxTilt = pushupVariant === "knees" ? 50 : PUSHUP_CLASSIC_MAX_TILT;
  const bodyIsHorizontal = smoothedTilt <= maxTilt;

  if (!bodyIsHorizontal) {
    statusElement.textContent =
      pushupVariant === "knees"
        ? "Расположите плечи и колени горизонтальнее"
        : "Расположитесь горизонтально и боком";

    phaseElement.textContent = "Положение неверно";
    stableTopFrames = 0;
    stableBottomFrames = 0;
    return;
  }

  if (!bodyIsStraight) {
    statusElement.textContent =
      pushupVariant === "knees"
        ? "Выпрямите линию плечо–таз–колено"
        : "Выпрямите корпус";

    phaseElement.textContent = "Положение неверно";
    stableTopFrames = 0;
    stableBottomFrames = 0;
    return;
  }

  statusElement.textContent =
    pushupVariant === "knees"
      ? "Отжимание от колен распознано"
      : "Классическое отжимание распознано";

  updateRepState(smoothedPrimaryAngle);
}

function getPlankFeedback(measurement) {
  const bodyIsStraight =
    smoothedBodyLine >= exerciseValues.bodyLine;

  const bodyIsHorizontal =
    smoothedTilt <= exerciseValues.maxTilt;

  if (!bodyIsHorizontal) {
    return {
      valid: false,
      message: "Расположитесь горизонтально",
    };
  }

  if (!bodyIsStraight) {
    const expectedHipY =
      (measurement.shoulder.y + measurement.ankle.y) / 2;

    const difference =
      measurement.hip.y - expectedHipY;

    return {
      valid: false,
      message:
        difference > 0
          ? "Таз слишком низко"
          : "Таз слишком высоко",
    };
  }

  return {
    valid: true,
    message: "Планка засчитана",
  };
}

function analyzePlank(measurement, timestamp) {
  smoothedBodyLine = smooth(
    smoothedBodyLine,
    measurement.bodyLine
  );

  smoothedTilt = smooth(
    smoothedTilt,
    measurement.tilt
  );

  measurement.primaryAngle = smoothedBodyLine;

  primaryAngleElement.textContent =
    String(Math.round(smoothedBodyLine));

  secondaryMetricValue.textContent =
    `${Math.round(smoothedTilt)}°`;

  const feedback = getPlankFeedback(measurement);

  stableValidFrames =
    feedback.valid ? stableValidFrames + 1 : 0;

  if (
    feedback.valid &&
    stableValidFrames >= PLANK_STABLE_FRAMES
  ) {
    if (plankLastTimestamp !== null) {
      plankHoldMs += Math.min(
        timestamp - plankLastTimestamp,
        200
      );
    }

    phaseElement.textContent = "Удержание";
    statusElement.textContent = "Правильная планка";
    saveResultButton.disabled = false;
  } else {
    phaseElement.textContent = "Пауза";
    statusElement.textContent = feedback.message;
  }

  plankLastTimestamp = timestamp;
  mainMetricValue.textContent = formatDuration(plankHoldMs);
}

function clearDetectionUi(message) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  primaryAngleElement.textContent = "—";
  secondaryMetricValue.textContent = "—";
  statusElement.textContent = message;

  stableTopFrames = 0;
  stableBottomFrames = 0;
  stableValidFrames = 0;
  plankLastTimestamp = null;
}

function processFrame(timestamp) {
  if (!running || !poseLandmarker) {
    return;
  }

  animationFrameId = requestAnimationFrame(processFrame);

  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.currentTime === lastVideoTime ||
    timestamp - lastInferenceAt < INFERENCE_INTERVAL_MS
  ) {
    return;
  }

  lastVideoTime = video.currentTime;
  lastInferenceAt = timestamp;

  try {
    const startedAt = performance.now();

    const result = poseLandmarker.detectForVideo(
      video,
      performance.now()
    );

    const elapsed = performance.now() - startedAt;
    inferenceTimeElement.textContent = elapsed.toFixed(1);

    const landmarks = result.landmarks?.[0];

    if (!landmarks) {
      clearDetectionUi("Человек не найден");
      return;
    }

    const measurement =
      currentExercise === "squat"
        ? measureSquat(landmarks)
        : measureHorizontalExercise(landmarks);

    if (currentExercise === "pushup") {
      measurement.primaryAngle = measurement.elbowAngle;
    }

    if (currentExercise === "plank") {
      measurement.primaryAngle = measurement.bodyLine;
    }

    drawResults(landmarks, measurement);

    const requiredVisibility =
      Number(visibilityThresholdInput.value);

    if (
      measurement.primaryAngle === null ||
      measurement.visibility < requiredVisibility
    ) {
      clearDetectionUi(
        "Плохо видны необходимые суставы"
      );
      return;
    }

    if (currentExercise === "squat") {
      analyzeSquat(measurement);
    } else if (currentExercise === "pushup") {
      analyzePushup(measurement);
    } else {
      analyzePlank(measurement, timestamp);
    }
  } catch (error) {
    console.error(error);
    showError(
      "Ошибка во время обработки кадра. Обновите страницу и попробуйте снова."
    );
    statusElement.textContent = "Ошибка inference";
    running = false;
  }
}

window.addEventListener("beforeunload", () => {
  running = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }

  cameraStream?.getTracks().forEach((track) => {
    track.stop();
  });

  poseLandmarker?.close();
});
