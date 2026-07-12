"""Train a small learned embedding (metric learning via softmax pretext) for
pushup pose classification, to replace the hand-engineered-feature KNN with
a KNN over a learned representation.

Why a classifier pretext instead of classic triplet loss: with only ~100
source videos (a few hundred frames total across classes), triplet mining
would have too little diversity to train reliably. Training a small softmax
classifier and using its penultimate layer as the embedding is a standard,
more data-efficient alternative that still yields a genuine learned
representation (not hand-picked features) - same practical goal, more
robust with this little data.

Classes:
  top          - first/last frames of all 100 videos (correct + incorrect):
                 the "arms extended" position, present in every video
                 regardless of the video's overall form label.
  bottom_good  - frame of minimum elbow angle in the 50 *correct* videos.
  bottom_bad   - frame of minimum elbow angle in the 50 *incorrect* videos.

At inference, a rep only counts if the phase sequence completes
top -> bottom_good -> top. bottom_bad is a real, explicit class (not merely
"far from everything"), so it does not advance the cycle - this is how
cheating/bad-form reps get rejected by the segmentation step itself, unlike
the disabled PUSHUP_MODEL gate which judged the whole rep after the fact.
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
    shoulder = lm3d[:n, side["shoulder"]]
    elbow = lm3d[:n, side["elbow"]]
    wrist = lm3d[:n, side["wrist"]]
    hip = lm3d[:n, side["hip"]]
    ankle = lm3d[:n, side["ankle"]]
    elbow_angle = calculate_angle(shoulder, elbow, wrist)
    body_line = calculate_angle(shoulder, hip, ankle)
    tilt = tilt_3d(shoulder, ankle)
    return np.stack([elbow_angle, body_line, tilt], axis=-1)


def load_videos(label_name):
    data = np.load(os.path.join(DATA_DIR, f"{label_name}.npz"), allow_pickle=True)
    lm2d, lm3d = data["landmarks_2d"], data["landmarks_3d"]
    frame_counts = data["frame_counts"]
    videos = []
    for v in range(lm2d.shape[0]):
        n = int(frame_counts[v])
        side = choose_side(lm2d[v], n)
        videos.append(per_frame_features(lm3d[v], side, n))
    return videos


def build_labeled_dataset():
    correct_videos = load_videos("correct")
    incorrect_videos = load_videos("incorrect")

    rows = []
    for group_offset, videos in [(0, correct_videos), (1000, incorrect_videos)]:
        for idx, feats in enumerate(videos):
            group = group_offset + idx
            rows.append({"features": feats[0], "label": "top", "group": group})
            rows.append({"features": feats[1], "label": "top", "group": group})
            rows.append({"features": feats[-1], "label": "top", "group": group})
            rows.append({"features": feats[-2], "label": "top", "group": group})
            bottom_idx = int(np.argmin(feats[:, 0]))
            bottom_label = "bottom_good" if group_offset == 0 else "bottom_bad"
            rows.append({
                "features": feats[bottom_idx],
                "label": bottom_label,
                "group": group,
            })

    X = np.array([r["features"] for r in rows], dtype=np.float32)
    y = np.array([r["label"] for r in rows])
    groups = np.array([r["group"] for r in rows], dtype=np.int32)
    return X, y, groups


if __name__ == "__main__":
    X, y, groups = build_labeled_dataset()
    print(f"dataset: X{X.shape}, y{y.shape}, groups unique={len(np.unique(groups))}")
    values, counts = np.unique(y, return_counts=True)
    for v, c in zip(values, counts):
        print(f"  {v}: {c}")
