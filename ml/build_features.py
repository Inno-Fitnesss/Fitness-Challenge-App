"""Build a compact per-rep feature table for the pushup validity classifier.

Design goals (see discussion with product owner):
- The model must slot into the exact same trigger point where the app
  currently counts a rep (ExerciseAnalyzer.updateRepState in
  frontend/src/cv/poseCvEngine.ts) - so features are things that can be
  tracked incrementally, frame by frame, as running min/max (exactly like
  `minAngleInRep`/`maxAngleInRep` already are), not things requiring a
  buffered/resampled sequence. This keeps inference at rep-completion O(1)
  and adds zero latency versus today.
- `tilt` in the current TS code (`angleToHorizontal`, 2D image-plane) is the
  root cause of the "must face sideways" bug: it's only meaningful when the
  body's long axis is parallel to the image plane. Here we replace it with
  `tilt3d`, computed from the metric 3D world landmarks as the angle between
  the shoulder->ankle vector and the horizontal (XZ) plane. This is
  mathematically invariant under the vertical-axis rotation used in
  augment_rotation.py (rotation about Y preserves both the Y component and
  the XZ-plane vector norm) - i.e. it is exactly the view-invariant
  replacement the 2D tilt was missing.
- elbowAngle/bodyLine already used metric 3D angles in the current code
  (P1 in cv-improve/README.md), so they're kept as-is.

Output: ml/data/features.npz with:
  X: (N, 6) feature matrix [elbow_min, elbow_max, bodyLine_min, bodyLine_max,
                            tilt3d_min, tilt3d_max]
  y: (N,) 1=correct, 0=incorrect
  groups: (N,) original video index (0..49 within each class) - use for
          grouped train/test split so synthetic rotations of the same real
          video never straddle the split.
  rotation_deg: (N,) synthetic azimuth used, for stratified evaluation.
"""

import os

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
ORIG_DIR = os.path.join(ROOT, "data", "pushup_world")
AUG_DIR = os.path.join(ROOT, "data", "pushup_world_augmented")
OUT_PATH = os.path.join(ROOT, "data", "features.npz")

# Mirrors LANDMARKS in frontend/src/cv/poseCvEngine.ts
LEFT = dict(shoulder=11, elbow=13, wrist=15, hip=23, ankle=27)
RIGHT = dict(shoulder=12, elbow=14, wrist=16, hip=24, ankle=28)

N_ANGLES_PER_VIDEO = 9  # must match augment_rotation.AUGMENT_ANGLES_DEG


def calculate_angle(a, b, c):
    """Angle at vertex b, between rays b->a and b->c. a,b,c: (..., 3)."""
    v1 = a - b
    v2 = c - b
    dot = np.sum(v1 * v2, axis=-1)
    len1 = np.linalg.norm(v1, axis=-1)
    len2 = np.linalg.norm(v2, axis=-1)
    denom = np.clip(len1 * len2, 1e-6, None)
    cosine = np.clip(dot / denom, -1.0, 1.0)
    return np.degrees(np.arccos(cosine))


def tilt_3d(shoulder, ankle):
    """Angle between shoulder->ankle vector and the horizontal (XZ) plane.
    0 = perfectly horizontal body, 90 = perfectly vertical. View-invariant
    under rotation about the vertical (Y) axis - see module docstring."""
    d = ankle - shoulder
    horizontal = np.hypot(d[..., 0], d[..., 2])
    vertical = np.abs(d[..., 1])
    return np.degrees(np.arctan2(vertical, np.clip(horizontal, 1e-6, None)))


def choose_side(landmarks_2d, frame_count):
    """Pick left/right by mean visibility over the real (non-padded) frames."""
    def mean_vis(idx_map):
        idxs = list(idx_map.values())
        return landmarks_2d[:frame_count, idxs, 2].mean()

    return LEFT if mean_vis(LEFT) >= mean_vis(RIGHT) else RIGHT


def build_class(label_name, label_value):
    orig = np.load(os.path.join(ORIG_DIR, f"{label_name}.npz"), allow_pickle=True)
    aug = np.load(os.path.join(AUG_DIR, f"{label_name}.npz"), allow_pickle=True)

    orig_2d = orig["landmarks_2d"]      # (n_videos, frames, 33, 3) x,y,visibility
    orig_frame_counts = orig["frame_counts"]
    aug_3d = aug["landmarks_3d"]        # (n_videos * 9, frames, 33, 3)
    aug_frame_counts = aug["frame_counts"]
    aug_rotation = aug["rotation_deg"]

    n_videos = orig_2d.shape[0]
    rows = []
    for v in range(n_videos):
        side = choose_side(orig_2d[v], orig_frame_counts[v])
        for a in range(N_ANGLES_PER_VIDEO):
            sample_idx = v * N_ANGLES_PER_VIDEO + a
            n = aug_frame_counts[sample_idx]
            lm = aug_3d[sample_idx, :n]  # (n, 33, 3)

            shoulder = lm[:, side["shoulder"]]
            elbow = lm[:, side["elbow"]]
            wrist = lm[:, side["wrist"]]
            hip = lm[:, side["hip"]]
            ankle = lm[:, side["ankle"]]

            elbow_angle = calculate_angle(shoulder, elbow, wrist)
            body_line = calculate_angle(shoulder, hip, ankle)
            tilt = tilt_3d(shoulder, ankle)

            bottom_idx = int(np.argmin(elbow_angle))

            rows.append({
                "features": [
                    elbow_angle.min(), elbow_angle.max(),
                    body_line.min(), body_line.max(),
                    tilt.min(), tilt.max(),
                    body_line[bottom_idx],  # posture at the actual rep bottom
                    tilt[bottom_idx],
                ],
                "label": label_value,
                "group": v,
                "rotation_deg": aug_rotation[sample_idx],
            })
    return rows


def main():
    rows = build_class("correct", 1) + build_class("incorrect", 0)
    X = np.array([r["features"] for r in rows], dtype=np.float32)
    y = np.array([r["label"] for r in rows], dtype=np.int32)
    # incorrect videos use group ids 0..49 too - offset so groups are unique
    # across both classes for a clean grouped split.
    groups = np.array(
        [r["group"] + (0 if r["label"] == 1 else 1000) for r in rows],
        dtype=np.int32,
    )
    rotation_deg = np.array([r["rotation_deg"] for r in rows], dtype=np.float32)

    np.savez_compressed(OUT_PATH, X=X, y=y, groups=groups, rotation_deg=rotation_deg)
    print(f"Saved {OUT_PATH}: X{X.shape}, y{y.shape}, "
          f"{len(np.unique(groups))} unique source videos")
    print("Feature order: elbow_min, elbow_max, bodyLine_min, bodyLine_max, "
          "tilt3d_min, tilt3d_max")
    print("y=1 (correct) count:", (y == 1).sum(), " y=0 (incorrect) count:", (y == 0).sum())


if __name__ == "__main__":
    main()
