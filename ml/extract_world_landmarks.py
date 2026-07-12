"""Re-extract pose landmarks (image 2D + metric 3D worldLandmarks) from the raw
pushup videos in data/pushup/{Correct sequence,Wrong sequence}.

The existing data/pushup/labels/{correct,incorrect}.npy only contain 2D (x, y)
image-space coordinates, which are camera-view dependent. This script re-runs
the same MediaPipe pose_landmarker_lite model the frontend uses (VIDEO mode)
and additionally captures world_landmarks (metric, hip-centered 3D), needed to
train a view-invariant posture classifier.

Output: ml/data/pushup_world/{correct,incorrect}.npz
  - landmarks_2d: (num_videos, max_frames, 33, 3)  x, y, visibility
  - landmarks_3d: (num_videos, max_frames, 33, 3)  world x, y, z (meters)
  - frame_counts: (num_videos,) actual frame count per video (rest is zero-padded)
  - video_names: (num_videos,) source filename
"""

import os
import sys
import time

import cv2
import numpy as np
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(ROOT)
MODEL_PATH = os.path.join(ROOT, "models", "pose_landmarker_lite.task")
DATA_DIR = os.path.join(REPO_ROOT, "data", "pushup")
OUT_DIR = os.path.join(ROOT, "data", "pushup_world")

NUM_LANDMARKS = 33
MAX_FRAMES = 450  # covers the longest "incorrect" clips (~400 frames)


def make_landmarker():
    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=VisionRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return PoseLandmarker.create_from_options(options)


def extract_video(path):
    # A fresh landmarker per video: VIDEO mode requires strictly increasing
    # timestamps for the lifetime of the landmarker instance, and each clip
    # restarts its own timestamp at 0.
    landmarker = make_landmarker()
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval_ms = 1000.0 / fps

    lm2d = np.zeros((MAX_FRAMES, NUM_LANDMARKS, 3), dtype=np.float32)
    lm3d = np.zeros((MAX_FRAMES, NUM_LANDMARKS, 3), dtype=np.float32)
    frame_idx = 0
    timestamp_ms = 0

    while frame_idx < MAX_FRAMES:
        ok, frame = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect_for_video(mp_image, int(timestamp_ms))

        if result.pose_landmarks:
            for i, p in enumerate(result.pose_landmarks[0]):
                lm2d[frame_idx, i] = (p.x, p.y, p.visibility)
        if result.pose_world_landmarks:
            for i, p in enumerate(result.pose_world_landmarks[0]):
                lm3d[frame_idx, i] = (p.x, p.y, p.z)

        frame_idx += 1
        timestamp_ms += frame_interval_ms

    cap.release()
    landmarker.close()
    return lm2d, lm3d, frame_idx


def process_folder(folder_name, label):
    folder_path = os.path.join(DATA_DIR, folder_name)
    files = sorted(f for f in os.listdir(folder_path) if f.lower().endswith((".mp4", ".mov")))
    print(f"[{label}] {len(files)} videos in {folder_path}")

    all_2d = np.zeros((len(files), MAX_FRAMES, NUM_LANDMARKS, 3), dtype=np.float32)
    all_3d = np.zeros((len(files), MAX_FRAMES, NUM_LANDMARKS, 3), dtype=np.float32)
    frame_counts = np.zeros((len(files),), dtype=np.int32)

    t0 = time.time()
    for idx, fname in enumerate(files):
        path = os.path.join(folder_path, fname)
        lm2d, lm3d, n_frames = extract_video(path)
        all_2d[idx] = lm2d
        all_3d[idx] = lm3d
        frame_counts[idx] = n_frames
        elapsed = time.time() - t0
        print(f"  [{idx + 1}/{len(files)}] {fname}: {n_frames} frames "
              f"({elapsed:.1f}s elapsed)", flush=True)

    return all_2d, all_3d, frame_counts, np.array(files)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    for folder_name, label, out_name in [
        ("Correct sequence", "correct", "correct.npz"),
        ("Wrong sequence", "incorrect", "incorrect.npz"),
    ]:
        all_2d, all_3d, frame_counts, video_names = process_folder(folder_name, label)
        out_path = os.path.join(OUT_DIR, out_name)
        np.savez_compressed(
            out_path,
            landmarks_2d=all_2d,
            landmarks_3d=all_3d,
            frame_counts=frame_counts,
            video_names=video_names,
        )
        print(f"Saved {out_path} ({all_2d.shape[0]} videos)")


if __name__ == "__main__":
    main()
