"""Synthetic multi-view augmentation for pushup 3D world landmarks.

The recorded videos in data/pushup were filmed close to a side-on angle
(the app currently requires this). To teach a classifier to tolerate other
camera azimuths (3/4 view, closer to frontal) without reshooting, we rotate
the metric 3D world landmarks around the vertical axis. This simulates what
the same physical repetition would look like from a camera at a different
azimuth, assuming perfect landmark detection at that angle.

Caveat (documented, not solved here): this does not simulate the extra
detection noise/self-occlusion MediaPipe actually produces at wide angles
(e.g. elbows overlapping in a true frontal view) - it only augments the
*geometry*. A small set of real multi-angle validation clips is still needed
before trusting this in production.

MediaPipe world landmarks are hip-centered, with Y pointing up. We rotate
around the Y axis (vertical), which is the axis a person turns around when
pivoting to face the camera.
"""

import os

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
IN_DIR = os.path.join(ROOT, "data", "pushup_world")
OUT_DIR = os.path.join(ROOT, "data", "pushup_world_augmented")

# Azimuth offsets in degrees applied on top of the original (near-side) view.
# 0 = original recording. Positive/negative rotate the body toward a more
# frontal presentation to the camera.
AUGMENT_ANGLES_DEG = [-60, -45, -30, -15, 0, 15, 30, 45, 60]


def rotate_y(points, angle_deg):
    """Rotate (..., 3) points around the vertical (Y) axis."""
    theta = np.deg2rad(angle_deg)
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    x = points[..., 0]
    y = points[..., 1]
    z = points[..., 2]
    x_rot = cos_t * x + sin_t * z
    z_rot = -sin_t * x + cos_t * z
    return np.stack([x_rot, y, z_rot], axis=-1)


def augment_file(in_path, out_path):
    data = np.load(in_path, allow_pickle=True)
    landmarks_3d = data["landmarks_3d"]  # (videos, frames, 33, 3)
    frame_counts = data["frame_counts"]
    video_names = data["video_names"]

    n_videos = landmarks_3d.shape[0]
    n_angles = len(AUGMENT_ANGLES_DEG)

    aug_3d = np.zeros((n_videos * n_angles,) + landmarks_3d.shape[1:], dtype=np.float32)
    aug_frame_counts = np.zeros((n_videos * n_angles,), dtype=np.int32)
    aug_names = []
    aug_angles = np.zeros((n_videos * n_angles,), dtype=np.float32)

    for v in range(n_videos):
        for a, angle in enumerate(AUGMENT_ANGLES_DEG):
            idx = v * n_angles + a
            aug_3d[idx] = rotate_y(landmarks_3d[v], angle)
            aug_frame_counts[idx] = frame_counts[v]
            aug_names.append(f"{video_names[v]}__rot{angle:+d}")
            aug_angles[idx] = angle

    np.savez_compressed(
        out_path,
        landmarks_3d=aug_3d,
        frame_counts=aug_frame_counts,
        video_names=np.array(aug_names),
        rotation_deg=aug_angles,
    )
    print(f"Saved {out_path}: {aug_3d.shape[0]} samples "
          f"({n_videos} videos x {n_angles} angles)")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name in ["correct.npz", "incorrect.npz"]:
        augment_file(os.path.join(IN_DIR, name), os.path.join(OUT_DIR, name))


if __name__ == "__main__":
    main()
