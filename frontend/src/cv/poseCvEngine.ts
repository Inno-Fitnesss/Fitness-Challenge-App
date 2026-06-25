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

const VISIBILITY_THRESHOLD = 0.55;
const INFERENCE_INTERVAL_MS = 50;

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

const SETTINGS = {
  squat: {
    bottom: 115,
    top: 155,
    stableFrames: 3,
    smoothAlpha: 0.35,
  },
  pushup: {
    bottom: 90,
    top: 125,
    bodyLine: 160,
    maxTilt: 25,
    stableFrames: 1,
    smoothAlpha: 0.45,
  },
  plank: {
    bodyLine: 160,
    maxTilt: 35,
    stableFrames: 5,
    smoothAlpha: 0.35,
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

function loadVisionModule(): Promise<VisionModule> {
  if (!visionModulePromise) {
    visionModulePromise = import(
      /* @vite-ignore */ MEDIAPIPE_MODULE_URL
    ) as Promise<VisionModule>;
  }
  return visionModulePromise;
}

export async function createPoseRuntime(): Promise<PoseRuntime> {
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

function calculateAngle(
  first: PoseLandmark,
  middle: PoseLandmark,
  last: PoseLandmark,
): number | null {
  const vectorA = {
    x: first.x - middle.x,
    y: first.y - middle.y,
  };
  const vectorB = {
    x: last.x - middle.x,
    y: last.y - middle.y,
  };
  const dot = vectorA.x * vectorB.x + vectorA.y * vectorB.y;
  const lengthA = Math.hypot(vectorA.x, vectorA.y);
  const lengthB = Math.hypot(vectorB.x, vectorB.y);

  if (lengthA < 1e-6 || lengthB < 1e-6) return null;

  const cosine = Math.max(-1, Math.min(1, dot / (lengthA * lengthB)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

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

function smooth(
  previous: number | null,
  next: number,
  alpha: number,
): number {
  return previous === null ? next : alpha * next + (1 - alpha) * previous;
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
  const shoulder = landmarks[choice.indices.shoulder];
  const elbow = landmarks[choice.indices.elbow];
  const wrist = landmarks[choice.indices.wrist];
  const hip = landmarks[choice.indices.hip];
  const ankle = landmarks[choice.indices.ankle];

  return {
    visibility: choice.visibility,
    elbowAngle: calculateAngle(shoulder, elbow, wrist),
    bodyLine: calculateAngle(shoulder, hip, ankle),
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
  private stableTopFrames = 0;
  private stableBottomFrames = 0;
  private stableValidFrames = 0;
  private smoothedPrimaryAngle: number | null = null;
  private smoothedBodyLine: number | null = null;
  private smoothedTilt: number | null = null;
  private plankHoldMs = 0;
  private plankLastTimestamp: number | null = null;
  private qualityWindow: boolean[] = [];

  constructor(private readonly exercise: CvExercise) {}

  reset(): void {
    this.reps = 0;
    this.repState = 'WAITING_FOR_TOP';
    this.stableTopFrames = 0;
    this.stableBottomFrames = 0;
    this.stableValidFrames = 0;
    this.smoothedPrimaryAngle = null;
    this.smoothedBodyLine = null;
    this.smoothedTilt = null;
    this.plankHoldMs = 0;
    this.plankLastTimestamp = null;
    this.qualityWindow = [];
  }

  noPose(): CvAnalysis {
    this.resetStableFrames();
    this.recordQuality(false);
    return this.result('Человек не найден в кадре', false, {
      type: 'camera',
      severity: 'warning',
      text: 'Отойдите от камеры так, чтобы тело полностью попадало в кадр.',
    });
  }

  analyze(landmarks: PoseLandmark[], timestampMs: number): CvAnalysis {
    if (this.exercise === 'squat') {
      return this.analyzeSquat(landmarks);
    }
    if (this.exercise === 'pushup') {
      return this.analyzePushup(landmarks);
    }
    if (this.exercise === 'plank') {
      return this.analyzePlank(landmarks, timestampMs);
    }
    return this.result('Упражнение пока не поддерживается CV', false, {
      type: 'general',
      severity: 'info',
      text: 'Автоматический подсчёт пока доступен для отжиманий, приседаний и планки.',
    });
  }

  private analyzeSquat(landmarks: PoseLandmark[]): CvAnalysis {
    const choice = chooseSide(
      landmarks,
      [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
      [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
    );
    const angle = calculateAngle(
      landmarks[choice.indices.hip],
      landmarks[choice.indices.knee],
      landmarks[choice.indices.ankle],
    );

    if (angle === null || choice.visibility < VISIBILITY_THRESHOLD) {
      return this.lowVisibility();
    }

    this.smoothedPrimaryAngle = smooth(
      this.smoothedPrimaryAngle,
      angle,
      SETTINGS.squat.smoothAlpha,
    );
    const update = this.updateRepState(
      this.smoothedPrimaryAngle,
      SETTINGS.squat.bottom,
      SETTINGS.squat.top,
      SETTINGS.squat.stableFrames,
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
      this.smoothedPrimaryAngle,
    );
  }

  private analyzePushup(landmarks: PoseLandmark[]): CvAnalysis {
    const measurement = measureHorizontal(landmarks);
    if (
      measurement.visibility < VISIBILITY_THRESHOLD ||
      measurement.elbowAngle === null ||
      measurement.bodyLine === null ||
      measurement.tilt === null
    ) {
      return this.lowVisibility();
    }

    this.smoothedPrimaryAngle = smooth(
      this.smoothedPrimaryAngle,
      measurement.elbowAngle,
      SETTINGS.pushup.smoothAlpha,
    );
    this.smoothedBodyLine = smooth(
      this.smoothedBodyLine,
      measurement.bodyLine,
      SETTINGS.pushup.smoothAlpha,
    );
    this.smoothedTilt = smooth(
      this.smoothedTilt,
      measurement.tilt,
      SETTINGS.pushup.smoothAlpha,
    );

    if (this.smoothedTilt > SETTINGS.pushup.maxTilt) {
      this.resetStableFrames();
      this.recordQuality(false);
      return this.result(
        'Расположитесь горизонтально и боком',
        false,
        {
          type: 'camera',
          severity: 'warning',
          text: 'Поставьте камеру сбоку и ниже: плечи, таз и стопы должны быть видны.',
        },
        this.smoothedPrimaryAngle,
      );
    }

    if (this.smoothedBodyLine < SETTINGS.pushup.bodyLine) {
      this.resetStableFrames();
      this.recordQuality(false);
      return this.result(
        'Выпрямите корпус',
        false,
        {
          type: 'posture',
          severity: 'warning',
          text: 'Держите плечи, таз и стопы на одной линии.',
        },
        this.smoothedPrimaryAngle,
      );
    }

    const update = this.updateRepState(
      this.smoothedPrimaryAngle,
      SETTINGS.pushup.bottom,
      SETTINGS.pushup.top,
      SETTINGS.pushup.stableFrames,
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
      this.smoothedPrimaryAngle,
    );
  }

  private analyzePlank(
    landmarks: PoseLandmark[],
    timestampMs: number,
  ): CvAnalysis {
    const measurement = measureHorizontal(landmarks);
    if (
      measurement.visibility < VISIBILITY_THRESHOLD ||
      measurement.bodyLine === null ||
      measurement.tilt === null
    ) {
      this.plankLastTimestamp = null;
      return this.lowVisibility();
    }

    this.smoothedBodyLine = smooth(
      this.smoothedBodyLine,
      measurement.bodyLine,
      SETTINGS.plank.smoothAlpha,
    );
    this.smoothedTilt = smooth(
      this.smoothedTilt,
      measurement.tilt,
      SETTINGS.plank.smoothAlpha,
    );

    let feedback: CvFeedbackInput | undefined;
    let valid = true;
    let status = 'Правильная планка';

    if (this.smoothedTilt > SETTINGS.plank.maxTilt) {
      valid = false;
      status = 'Расположитесь горизонтально';
      feedback = {
        type: 'camera',
        severity: 'warning',
        text: 'Повернитесь к камере боком и расположите всё тело горизонтально.',
      };
    } else if (this.smoothedBodyLine < SETTINGS.plank.bodyLine) {
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
      this.smoothedBodyLine,
    );
  }

  private lowVisibility(): CvAnalysis {
    this.resetStableFrames();
    this.recordQuality(false);
    return this.result('Плохо видны необходимые суставы', false, {
      type: 'camera',
      severity: 'warning',
      text: 'Убедитесь, что ключевые точки тела не выходят за границы кадра.',
    });
  }

  private updateRepState(
    primaryAngle: number,
    bottomThreshold: number,
    topThreshold: number,
    stableFrames: number,
  ): { counted: boolean; phase: string } {
    const isTop = primaryAngle >= topThreshold;
    const isBottom = primaryAngle <= bottomThreshold;
    this.stableTopFrames = isTop ? this.stableTopFrames + 1 : 0;
    this.stableBottomFrames = isBottom ? this.stableBottomFrames + 1 : 0;

    if (this.repState === 'WAITING_FOR_TOP') {
      if (this.stableTopFrames >= stableFrames) {
        this.repState = 'READY';
        return { counted: false, phase: 'Верхняя позиция' };
      }
      return { counted: false, phase: 'Выпрямитесь' };
    }

    if (this.repState === 'READY') {
      if (this.stableBottomFrames >= stableFrames) {
        this.repState = 'BOTTOM_REACHED';
        return { counted: false, phase: 'Нижняя позиция' };
      }
      return {
        counted: false,
        phase: isTop ? 'Верхняя позиция' : 'Опускайтесь',
      };
    }

    if (this.stableTopFrames >= stableFrames) {
      this.reps += 1;
      this.repState = 'READY';
      return { counted: true, phase: 'Засчитано' };
    }
    return { counted: false, phase: 'Поднимайтесь' };
  }

  private resetStableFrames(): void {
    this.stableTopFrames = 0;
    this.stableBottomFrames = 0;
    this.stableValidFrames = 0;
    this.plankLastTimestamp = null;
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
