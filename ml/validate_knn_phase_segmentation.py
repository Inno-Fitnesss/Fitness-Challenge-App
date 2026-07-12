"""Prototype + validate a generic KNN-based phase segmentation mechanism,
meant to generalize beyond the single-joint-angle state machine used for
pushup/squat today (which does not work for compound movements like burpee).

Idea: instead of hand-calibrated numeric thresholds per exercise
(SETTINGS.pushup.bottom = 110, etc.), classify each frame's pose against a
small bank of reference frames per named phase (KNN), then require phases to
occur in the right order to count a rep. This validates the mechanism on
pushup (where we already know the ground truth: each clip = exactly 1 rep)
before trusting it for burpee, where phases are harder to hand-calibrate.

Reference frames for "top" and "bottom" are harvested directly from the
existing 100 labeled videos (no new data collection needed for this
validation): first/last frames of a clip = top, frame of minimum elbow angle
= bottom.
"""

import os

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data", "pushup_world")

LEFT = dict(shoulder=11, elbow=13, wrist=15, hip=23, ankle=27)
RIGHT = dict(shoulder=12, elbow=14, wrist=16, hip=24, ankle=28)


def calculate_angle(a, b, c):
    v1 = a - b
    v2 = c - b
    dot = np.sum(v1 * v2, axis=-1)
    len1 = np.linalg.norm(v1, axis=-1)
    len2 = np.linalg.norm(v2, axis=-1)
    denom = np.clip(len1 * len2, 1e-6, None)
    cosine = np.clip(dot / denom, -1.0, 1.0)
    return np.degrees(np.arccos(cosine))


def tilt_3d(shoulder, ankle):
    d = ankle - shoulder
    horizontal = np.hypot(d[..., 0], d[..., 2])
    vertical = np.abs(d[..., 1])
    return np.degrees(np.arctan2(vertical, np.clip(horizontal, 1e-6, None)))


def choose_side(landmarks_2d, frame_count):
    def mean_vis(idx_map):
        idxs = list(idx_map.values())
        return landmarks_2d[:frame_count, idxs, 2].mean()
    return LEFT if mean_vis(LEFT) >= mean_vis(RIGHT) else RIGHT


def per_frame_features(lm3d, side, n):
    """Returns (n, 3) array: elbowAngle, bodyLine, tilt3d per frame."""
    shoulder = lm3d[:n, side["shoulder"]]
    elbow = lm3d[:n, side["elbow"]]
    wrist = lm3d[:n, side["wrist"]]
    hip = lm3d[:n, side["hip"]]
    ankle = lm3d[:n, side["ankle"]]
    elbow_angle = calculate_angle(shoulder, elbow, wrist)
    body_line = calculate_angle(shoulder, hip, ankle)
    tilt = tilt_3d(shoulder, ankle)
    return np.stack([elbow_angle, body_line, tilt], axis=-1)


def load_videos():
    orig = np.load(os.path.join(DATA_DIR, "correct.npz"), allow_pickle=True)
    lm2d, lm3d = orig["landmarks_2d"], orig["landmarks_3d"]
    frame_counts = orig["frame_counts"]

    videos = []
    for v in range(lm2d.shape[0]):
        n = int(frame_counts[v])
        side = choose_side(lm2d[v], n)
        feats = per_frame_features(lm3d[v], side, n)  # (n, 3)
        videos.append(feats)
    return videos


def build_phase_bank(train_videos):
    """Harvest reference frames: first/last 2 frames = top, argmin(elbow) = bottom.

    Only the elbow angle is used for phase segmentation - bodyLine/tilt are
    posture-quality signals, orthogonal to "is the elbow bent or not", and
    including them skewed the KNN decision boundary (validated: with all 3
    features the "bottom" boundary sat around elbow=87 degrees instead of
    ~110-120, making it much harder to trigger than the old threshold-based
    system - reps stopped counting in practice)."""
    top_refs, bottom_refs = [], []
    for feats in train_videos:
        top_refs.append(feats[0, :1])
        top_refs.append(feats[1, :1])
        top_refs.append(feats[-1, :1])
        top_refs.append(feats[-2, :1])
        bottom_idx = np.argmin(feats[:, 0])  # elbow angle column
        bottom_refs.append(feats[bottom_idx, :1])
    return {
        "top": np.array(top_refs),
        "bottom": np.array(bottom_refs),
    }


def normalize_features(feats, mean, std):
    return (feats - mean) / std


def classify_phase_knn(frame_feat, phase_bank, k=3):
    """1/3-NN vote across all reference vectors in the bank."""
    best_phase, best_dists = None, None
    all_dists = []
    for phase, refs in phase_bank.items():
        dists = np.linalg.norm(refs - frame_feat, axis=1)
        for d in dists:
            all_dists.append((d, phase))
    all_dists.sort(key=lambda x: x[0])
    top_k = [phase for _, phase in all_dists[:k]]
    # majority vote
    values, counts = np.unique(top_k, return_counts=True)
    return values[np.argmax(counts)]


def count_reps_via_phase_sequence(feats, phase_bank, mean, std,
                                   hysteresis_frames=2):
    """Generic ordered-phase state machine: top -> bottom -> top = 1 rep."""
    state = "WAITING_TOP"
    stable_count = 0
    pending_phase = None
    reps = 0

    for frame in feats:
        norm_frame = normalize_features(frame[:1], mean, std)
        phase = classify_phase_knn(norm_frame, phase_bank)

        if phase == pending_phase:
            stable_count += 1
        else:
            pending_phase = phase
            stable_count = 1

        confirmed_phase = pending_phase if stable_count >= hysteresis_frames else None
        if confirmed_phase is None:
            continue

        if state == "WAITING_TOP" and confirmed_phase == "top":
            state = "READY"
        elif state == "READY" and confirmed_phase == "bottom":
            state = "BOTTOM_REACHED"
        elif state == "BOTTOM_REACHED" and confirmed_phase == "top":
            reps += 1
            state = "READY"

    return reps


def main():
    videos = load_videos()
    n_videos = len(videos)
    rng = np.random.default_rng(42)
    indices = rng.permutation(n_videos)
    split = int(n_videos * 0.6)
    train_idx, val_idx = indices[:split], indices[split:]
    train_videos = [videos[i] for i in train_idx]
    val_videos = [videos[i] for i in val_idx]

    print(f"train videos (reference bank source): {len(train_videos)}")
    print(f"val videos (held out): {len(val_videos)}")

    phase_bank_raw = build_phase_bank(train_videos)

    # normalize using stats from all reference frames combined
    all_refs = np.concatenate(list(phase_bank_raw.values()), axis=0)
    mean, std = all_refs.mean(axis=0), all_refs.std(axis=0)
    phase_bank = {
        phase: normalize_features(refs, mean, std)
        for phase, refs in phase_bank_raw.items()
    }
    print(f"reference bank sizes: "
          f"top={len(phase_bank['top'])}, bottom={len(phase_bank['bottom'])}")

    correct_count = 0
    rep_counts = []
    for feats in val_videos:
        reps = count_reps_via_phase_sequence(feats, phase_bank, mean, std)
        rep_counts.append(reps)
        if reps == 1:
            correct_count += 1

    print(f"\nVal videos with exactly 1 rep detected: "
          f"{correct_count}/{len(val_videos)} ({100*correct_count/len(val_videos):.1f}%)")
    print("Rep count distribution:", np.unique(rep_counts, return_counts=True))


if __name__ == "__main__":
    main()
