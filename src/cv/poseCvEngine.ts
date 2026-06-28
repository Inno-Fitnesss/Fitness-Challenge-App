import type {
  CvFeedbackSeverity,
  CvFeedbackType,
  CvSessionStats,
  ExerciseMetric,
} from '../types/session.types.ts';

const MEDIAPIPE_MODULE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm';
const WASM_ROOT =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const VISIBILITY_THRESHOLD = 0.5;
const INFERENCE_INTERVAL_MS = 50;

// Минимальная амплитуда (град) засчитываемого повтора — отбрасывает дрожание
// у порога. Калибровано на размеченных видео (см. cv-improve/README.md).
const MIN_REP_AMPLITUDE = 15;

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
} as const;

// Откалибровано на размеченных видео (3D-углы по worldLandmarks).
const SETTINGS = {
  squat: {
    bottom: 115,
    top: 155,
  },
  pushup: {
    bottom: 110,
    top: 125,
    bodyLine: 150,
    maxTilt: 45,
  },
  plank: {
    bodyLine: 160,
    maxTilt: 35,
    stableFrames: 5,
  },
} as const;

export type CvExercise = 'pushup' | 'squat' | 'plank' | 'unsupported';

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

interface PoseDetectionResult {
  landmarks?: PoseLandmark[][];
  worldLandmarks?: PoseLandmark[][];
}

interface PoseLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => PoseDetectionResult;
  close?: () => void;
}

interface DrawingUtilsInstance {
  drawConnectors: (
    landmarks: PoseLandmark[],
    connections: unknown,
    options: { color: string; lineWidth: number },
  ) => void;
  drawLandmarks: (
    landmarks: PoseLandmark[],
    options: { color: string; fillColor: string; radius: number },
  ) => void;
}

interface VisionModule {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (
      vision: unknown,
      options: Record<string, unknown>,
    ) => Promise<PoseLandmarkerInstance>;
    POSE_CONNECTIONS: unknown;
  };
  DrawingUtils: new (context: CanvasRenderingContext2D) => DrawingUtilsInstance;
}

export interface PoseRuntime {
  landmarker: PoseLandmarkerInstance;
  poseConnections: unknown;
  DrawingUtils: VisionModule['DrawingUtils'];
}

export interface CvFeedbackInput {
  type: CvFeedbackType;
  severity: CvFeedbackSeverity;
  text: string;
}

export interface CvAnalysis {
  stats: CvSessionStats;
  status: string;
  feedback?: CvFeedbackInput;
  primaryAngle?: number;
  validFrame: boolean;
}

interface SideIndices {
  shoulder: number;
  elbow: number;
  wrist: number;
  hip: number;
  knee: number;
  ankle: number;
}

interface HorizontalMeasurement {
  visibility: number;
  elbowAngle: number | null;
  bodyLine: number | null;
  tilt: number | null;
  shoulder: PoseLandmark;
  hip: PoseLandmark;
  ankle: PoseLandmark;
}

let visionModulePromise: Promise<VisionModule> | null = null;
let poseRuntimePromise: Promise<PoseRuntime> | null = null;
let poseRuntimeInstance: PoseRuntime | null = null;

function loadVisionModule(): Promise<VisionModule> {
  if (!visionModulePromise) {
    visionModulePromise = import(
      /* @vite-ignore */ MEDIAPIPE_MODULE_URL
    ) as Promise<VisionModule>;
  }
  return visionModulePromise;
}

async function buildPoseRuntime(): Promise<PoseRuntime> {
  const visionModule = await loadVisionModule();
  const vision = await visionModule.FilesetResolver.forVisionTasks(WASM_ROOT);
  const commonOptions = {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  };

  let landmarker: PoseLandmarkerInstance;
  try {
    landmarker = await visionModule.PoseLandmarker.createFromOptions(vision, {
      ...commonOptions,
      baseOptions: {
        ...commonOptions.baseOptions,
        delegate: 'GPU',
      },
    });
  } catch {
    landmarker = await visionModule.PoseLandmarker.createFromOptions(
      vision,
      commonOptions,
    );
  }

  return {
    landmarker,
    poseConnections: visionModule.PoseLandmarker.POSE_CONNECTIONS,
    DrawingUtils: visionModule.DrawingUtils,
  };
}

/** Запускает загрузку WASM и модели в фоне (после входа в приложение). */
export function preloadPoseRuntime(): void {
  if (poseRuntimeInstance || poseRuntimePromise) return;
  poseRuntimePromise = buildPoseRuntime()
    .then((runtime) => {
      poseRuntimeInstance = runtime;
      return runtime;
    })
    .catch((error) => {
      poseRuntimePromise = null;
      console.warn('CV preload failed', error);
      throw error;
    });
}

export async function createPoseRuntime(): Promise<PoseRuntime> {
  if (poseRuntimeInstance) return poseRuntimeInstance;
  if (!poseRuntimePromise) preloadPoseRuntime();
  return poseRuntimePromise!;
}

export function getInferenceIntervalMs(): number {
  return INFERENCE_INTERVAL_MS;
}

export function detectExercise(
  exerciseName: string,
  metric: ExerciseMetric,
): CvExercise {
  const normalized = exerciseName.trim().toLocaleLowerCase('ru-RU');

  if (normalized.includes('отжим') || normalized.includes('push')) {
    return 'pushup';
  }
  if (normalized.includes('присед') || normalized.includes('squat')) {
    return 'squat';
  }
  if (
    normalized.includes('планк') ||
    normalized.includes('plank') ||
    metric === 'seconds'
  ) {
    return 'plank';
  }
  return 'unsupported';
}

export function drawPose(
  runtime: PoseRuntime,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: PoseLandmark[] | undefined,
): void {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  const drawingUtils = new runtime.DrawingUtils(context);
  drawingUtils.drawConnectors(landmarks, runtime.poseConnections, {
    color: '#b8e52f',
    lineWidth: 4,
  });
  drawingUtils.drawLandmarks(landmarks, {
    color: '#ffffff',
    fillColor: '#ff8a00',
    radius: 4,
  });
}

// P1: угол в 3D. worldLandmarks несут метрическую координату z, что делает
// угол инвариантным к ракурсу камеры. Для 2D-точек z трактуется как 0.
function calculateAngle(
  first: PoseLandmark,
  middle: PoseLandmark,
  last: PoseLandmark,
): number | null {
  const vectorA = {
    x: first.x - middle.x,
    y: first.y - middle.y,
    z: (first.z ?? 0) - (middle.z ?? 0),
  };
  const vectorB = {
    x: last.x - middle.x,
    y: last.y - middle.y,
    z: (last.z ?? 0) - (middle.z ?? 0),
  };
  const dot =
    vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z;
  const lengthA = Math.hypot(vectorA.x, vectorA.y, vectorA.z);
  const lengthB = Math.hypot(vectorB.x, vectorB.y, vectorB.z);

  if (lengthA < 1e-6 || lengthB < 1e-6) return null;

  const cosine = Math.max(-1, Math.min(1, dot / (lengthA * lengthB)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

// Наклон отрезка к горизонту — концепт кадра/гравитации, поэтому считается по
// 2D-координатам изображения.
function angleToHorizontal(
  first: PoseLandmark,
  second: PoseLandmark,
): number | null {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;

  let angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  if (angle > 90) angle = 180 - angle;
  return angle;
}

// P3: One-Euro фильтр — адаптивный low-pass (мало лага на быстром движении,
// сильное сглаживание в покое).
class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private readonly minCutoff = 1,
    private readonly beta = 0,
    private readonly dCutoff = 1,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(value: number, timestampMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = value;
      this.tPrev = timestampMs;
      this.dxPrev = 0;
      return value;
    }

    let dt = (timestampMs - this.tPrev) / 1000;
    if (dt <= 0) dt = 1e-3;
    this.tPrev = timestampMs;

    const dx = (value - this.xPrev) / dt;
    const aD = OneEuroFilter.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const xHat = a * value + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
}

// Медианный фильтр окна: отбрасывает одиночные выбросы landmark'ов.
function pushMedian(buffer: number[], value: number, size = 3): number {
  buffer.push(value);
  if (buffer.length > size) buffer.shift();
  const sorted = [...buffer].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1];
}

function minVisibility(landmarks: PoseLandmark[], indices: number[]): number {
  return Math.min(...indices.map((index) => landmarks[index]?.visibility ?? 0));
}

function getSideIndices(side: 'left' | 'right'): SideIndices {
  if (side === 'left') {
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

function chooseSide(
  landmarks: PoseLandmark[],
  leftIndices: number[],
  rightIndices: number[],
): { indices: SideIndices; visibility: number } {
  const leftVisibility = minVisibility(landmarks, leftIndices);
  const rightVisibility = minVisibility(landmarks, rightIndices);
  const side = leftVisibility >= rightVisibility ? 'left' : 'right';
  return {
    indices: getSideIndices(side),
    visibility: Math.max(leftVisibility, rightVisibility),
  };
}

function measureHorizontal(
  landmarks: PoseLandmark[],
  worldLandmarks: PoseLandmark[] | undefined,
): HorizontalMeasurement {
  const leftRequired = [
    LANDMARKS.LEFT_SHOULDER,
    LANDMARKS.LEFT_ELBOW,
    LANDMARKS.LEFT_WRIST,
    LANDMARKS.LEFT_HIP,
    LANDMARKS.LEFT_ANKLE,
  ];
  const rightRequired = [
    LANDMARKS.RIGHT_SHOULDER,
    LANDMARKS.RIGHT_ELBOW,
    LANDMARKS.RIGHT_WRIST,
    LANDMARKS.RIGHT_HIP,
    LANDMARKS.RIGHT_ANKLE,
  ];
  const choice = chooseSide(landmarks, leftRequired, rightRequired);
  const indices = choice.indices;

  // 2D-точки: наклон к горизонту и проверка таза в планке.
  const shoulder = landmarks[indices.shoulder];
  const hip = landmarks[indices.hip];
  const ankle = landmarks[indices.ankle];

  // P1: углы — по 3D-точкам (с фолбэком на 2D, если world недоступны).
  const angleSource = worldLandmarks ?? landmarks;

  return {
    visibility: choice.visibility,
    elbowAngle: calculateAngle(
      angleSource[indices.shoulder],
      angleSource[indices.elbow],
      angleSource[indices.wrist],
    ),
    bodyLine: calculateAngle(
      angleSource[indices.shoulder],
      angleSource[indices.hip],
      angleSource[indices.ankle],
    ),
    tilt: angleToHorizontal(shoulder, ankle),
    shoulder,
    hip,
    ankle,
  };
}

export class ExerciseAnalyzer {
  private reps = 0;
  private repState: 'WAITING_FOR_TOP' | 'READY' | 'BOTTOM_REACHED' =
    'WAITING_FOR_TOP';
  private stableValidFrames = 0;
  private minAngleInRep = Number.POSITIVE_INFINITY;
  private maxAngleInRep = Number.NEGATIVE_INFINITY;
  private plankHoldMs = 0;
  private plankLastTimestamp: number | null = null;
  private qualityWindow: boolean[] = [];

  // P3: фильтры сигналов. Первичный угол отзывчивее (beta выше), корпус и
  // наклон — спокойнее.
  private readonly primaryFilter = new OneEuroFilter(1.5, 0.5);
  private readonly bodyLineFilter = new OneEuroFilter(1.0, 0.3);
  private readonly tiltFilter = new OneEuroFilter(1.0, 0.3);
  private primaryMedian: number[] = [];
  private bodyLineMedian: number[] = [];
  private tiltMedian: number[] = [];

  constructor(private readonly exercise: CvExercise) {}

  reset(): void {
    this.reps = 0;
    this.repState = 'WAITING_FOR_TOP';
    this.stableValidFrames = 0;
    this.minAngleInRep = Number.POSITIVE_INFINITY;
    this.maxAngleInRep = Number.NEGATIVE_INFINITY;
    this.plankHoldMs = 0;
    this.plankLastTimestamp = null;
    this.qualityWindow = [];
    this.resetFilters();
  }

  noPose(): CvAnalysis {
    this.stableValidFrames = 0;
    this.plankLastTimestamp = null;
    this.resetFilters();
    this.recordQuality(false);
    return this.result('Человек не найден в кадре', false, {
      type: 'camera',
      severity: 'warning',
      text: 'Отойдите от камеры так, чтобы тело полностью попадало в кадр.',
    });
  }

  analyze(
    landmarks: PoseLandmark[],
    worldLandmarks: PoseLandmark[] | undefined,
    timestampMs: number,
  ): CvAnalysis {
    if (this.exercise === 'squat') {
      return this.analyzeSquat(landmarks, worldLandmarks, timestampMs);
    }
    if (this.exercise === 'pushup') {
      return this.analyzePushup(landmarks, worldLandmarks, timestampMs);
    }
    if (this.exercise === 'plank') {
      return this.analyzePlank(landmarks, worldLandmarks, timestampMs);
    }
    return this.result('Упражнение пока не поддерживается CV', false, {
      type: 'general',
      severity: 'info',
      text: 'Автоматический подсчёт пока доступен для отжиманий, приседаний и планки.',
    });
  }

  private analyzeSquat(
    landmarks: PoseLandmark[],
    worldLandmarks: PoseLandmark[] | undefined,
    timestampMs: number,
  ): CvAnalysis {
    const choice = chooseSide(
      landmarks,
      [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
      [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
    );
    const source = worldLandmarks ?? landmarks;
    const angle = calculateAngle(
      source[choice.indices.hip],
      source[choice.indices.knee],
      source[choice.indices.ankle],
    );

    if (angle === null || choice.visibility < VISIBILITY_THRESHOLD) {
      return this.lowVisibility();
    }

    const smoothed = this.primaryFilter.filter(
      pushMedian(this.primaryMedian, angle),
      timestampMs,
    );
    const update = this.updateRepState(
      smoothed,
      SETTINGS.squat.bottom,
      SETTINGS.squat.top,
    );
    this.recordQuality(true);

    return this.result(
      update.counted ? 'Приседание засчитано' : update.phase,
      true,
      update.counted
        ? {
            type: 'general',
            severity: 'success',
            text: 'Повтор засчитан.',
          }
        : undefined,
      smoothed,
    );
  }

  private analyzePushup(
    landmarks: PoseLandmark[],
    worldLandmarks: PoseLandmark[] | undefined,
    timestampMs: number,
  ): CvAnalysis {
    const measurement = measureHorizontal(landmarks, worldLandmarks);
    if (
      measurement.visibility < VISIBILITY_THRESHOLD ||
      measurement.elbowAngle === null ||
      measurement.bodyLine === null ||
      measurement.tilt === null
    ) {
      return this.lowVisibility();
    }

    const elbow = this.primaryFilter.filter(
      pushMedian(this.primaryMedian, measurement.elbowAngle),
      timestampMs,
    );
    const bodyLine = this.bodyLineFilter.filter(
      pushMedian(this.bodyLineMedian, measurement.bodyLine),
      timestampMs,
    );
    const tilt = this.tiltFilter.filter(
      pushMedian(this.tiltMedian, measurement.tilt),
      timestampMs,
    );

    if (tilt > SETTINGS.pushup.maxTilt) {
      // Плохая форма не должна засчитываться — сбрасываем амплитуду повтора.
      this.minAngleInRep = elbow;
      this.maxAngleInRep = elbow;
      this.recordQuality(false);
      return this.result(
        'Расположитесь горизонтально и боком',
        false,
        {
          type: 'camera',
          severity: 'warning',
          text: 'Поставьте камеру сбоку и ниже: плечи, таз и стопы должны быть видны.',
        },
        elbow,
      );
    }

    if (bodyLine < SETTINGS.pushup.bodyLine) {
      this.minAngleInRep = elbow;
      this.maxAngleInRep = elbow;
      this.recordQuality(false);
      return this.result(
        'Выпрямите корпус',
        false,
        {
          type: 'posture',
          severity: 'warning',
          text: 'Держите плечи, таз и стопы на одной линии.',
        },
        elbow,
      );
    }

    const update = this.updateRepState(
      elbow,
      SETTINGS.pushup.bottom,
      SETTINGS.pushup.top,
    );
    this.recordQuality(true);

    return this.result(
      update.counted ? 'Отжимание засчитано' : update.phase,
      true,
      update.counted
        ? {
            type: 'general',
            severity: 'success',
            text: 'Чистое отжимание засчитано.',
          }
        : undefined,
      elbow,
    );
  }

  private analyzePlank(
    landmarks: PoseLandmark[],
    worldLandmarks: PoseLandmark[] | undefined,
    timestampMs: number,
  ): CvAnalysis {
    const measurement = measureHorizontal(landmarks, worldLandmarks);
    if (
      measurement.visibility < VISIBILITY_THRESHOLD ||
      measurement.bodyLine === null ||
      measurement.tilt === null
    ) {
      this.plankLastTimestamp = null;
      return this.lowVisibility();
    }

    const bodyLine = this.bodyLineFilter.filter(
      pushMedian(this.bodyLineMedian, measurement.bodyLine),
      timestampMs,
    );
    const tilt = this.tiltFilter.filter(
      pushMedian(this.tiltMedian, measurement.tilt),
      timestampMs,
    );

    let feedback: CvFeedbackInput | undefined;
    let valid = true;
    let status = 'Правильная планка';

    if (tilt > SETTINGS.plank.maxTilt) {
      valid = false;
      status = 'Расположитесь горизонтально';
      feedback = {
        type: 'camera',
        severity: 'warning',
        text: 'Повернитесь к камере боком и расположите всё тело горизонтально.',
      };
    } else if (bodyLine < SETTINGS.plank.bodyLine) {
      valid = false;
      const expectedHipY = (measurement.shoulder.y + measurement.ankle.y) / 2;
      const hipIsLow = measurement.hip.y - expectedHipY > 0;
      status = hipIsLow ? 'Таз слишком низко' : 'Таз слишком высоко';
      feedback = {
        type: 'posture',
        severity: 'warning',
        text: status,
      };
    }

    this.stableValidFrames = valid ? this.stableValidFrames + 1 : 0;
    const holding =
      valid && this.stableValidFrames >= SETTINGS.plank.stableFrames;

    if (holding && this.plankLastTimestamp !== null) {
      this.plankHoldMs += Math.min(timestampMs - this.plankLastTimestamp, 200);
    }
    this.plankLastTimestamp = timestampMs;
    this.recordQuality(valid);

    return this.result(
      holding ? 'Удержание засчитывается' : status,
      valid,
      feedback,
      bodyLine,
    );
  }

  private lowVisibility(): CvAnalysis {
    this.stableValidFrames = 0;
    this.plankLastTimestamp = null;
    this.resetFilters();
    this.recordQuality(false);
    return this.result('Плохо видны необходимые суставы', false, {
      type: 'camera',
      severity: 'warning',
      text: 'Убедитесь, что ключевые точки тела не выходят за границы кадра.',
    });
  }

  // P2: state machine со счётом по гистерезис-порогам + проверкой амплитуды.
  // Реальность движения гарантирует амплитуда (min..max), поэтому строгое
  // подтверждение по скорости не нужно (оно теряло быстрые повторы при 50 мс).
  private updateRepState(
    primaryAngle: number,
    bottomThreshold: number,
    topThreshold: number,
  ): { counted: boolean; phase: string } {
    const isTop = primaryAngle >= topThreshold;
    const isBottom = primaryAngle <= bottomThreshold;

    if (this.repState === 'WAITING_FOR_TOP') {
      if (isTop) {
        this.repState = 'READY';
        this.minAngleInRep = primaryAngle;
        this.maxAngleInRep = primaryAngle;
        return { counted: false, phase: 'Верхняя позиция' };
      }
      return { counted: false, phase: 'Выпрямитесь' };
    }

    if (this.repState === 'READY') {
      this.minAngleInRep = Math.min(this.minAngleInRep, primaryAngle);
      if (isBottom) {
        this.repState = 'BOTTOM_REACHED';
        this.maxAngleInRep = primaryAngle;
        return { counted: false, phase: 'Нижняя позиция' };
      }
      return {
        counted: false,
        phase: isTop ? 'Верхняя позиция' : 'Опускайтесь',
      };
    }

    // BOTTOM_REACHED
    this.maxAngleInRep = Math.max(this.maxAngleInRep, primaryAngle);
    if (isTop) {
      const amplitude = this.maxAngleInRep - this.minAngleInRep;
      this.repState = 'READY';
      this.minAngleInRep = primaryAngle;
      this.maxAngleInRep = primaryAngle;
      if (amplitude >= MIN_REP_AMPLITUDE) {
        this.reps += 1;
        return { counted: true, phase: 'Засчитано' };
      }
      return { counted: false, phase: 'Верхняя позиция' };
    }
    return { counted: false, phase: 'Поднимайтесь' };
  }

  private resetFilters(): void {
    this.primaryFilter.reset();
    this.bodyLineFilter.reset();
    this.tiltFilter.reset();
    this.primaryMedian = [];
    this.bodyLineMedian = [];
    this.tiltMedian = [];
  }

  private recordQuality(valid: boolean): void {
    this.qualityWindow.push(valid);
    if (this.qualityWindow.length > 100) this.qualityWindow.shift();
  }

  private result(
    status: string,
    validFrame: boolean,
    feedback?: CvFeedbackInput,
    primaryAngle?: number,
  ): CvAnalysis {
    const validFrames = this.qualityWindow.filter(Boolean).length;
    const formQuality =
      this.qualityWindow.length === 0
        ? 0
        : Math.round((validFrames / this.qualityWindow.length) * 100);
    const elapsedSeconds = Math.floor(this.plankHoldMs / 1000);

    return {
      stats: {
        reps: this.reps,
        cleanReps: this.reps,
        elapsedSeconds,
        formQuality,
      },
      status,
      feedback,
      primaryAngle,
      validFrame,
    };
  }
}
