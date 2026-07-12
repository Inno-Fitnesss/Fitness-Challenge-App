"""Train the final production encoder (on all data) and build the KNN
reference bank in embedding space. Also re-validates end-to-end rep counting
(segmentation + cheat rejection) on a held-out grouped split before
finalizing, so the reported numbers reflect genuine held-out performance,
not the production weights fit on 100% of the data."""

import json
import os

import numpy as np
from sklearn.model_selection import GroupShuffleSplit
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from train_embedding import build_labeled_dataset, load_videos

ROOT = os.path.dirname(os.path.abspath(__file__))


def encode(X_scaled, coefs, intercepts):
    """Forward pass through the two encoder layers only (not the final
    softmax classification layer) - this is the learned embedding."""
    h = np.maximum(0, X_scaled @ coefs[0] + intercepts[0])
    h = np.maximum(0, h @ coefs[1] + intercepts[1])
    return h


def classify_embedding_knn(embedding, bank, k=3, max_dist=None):
    all_dists = []
    for label, refs in bank.items():
        dists = np.linalg.norm(refs - embedding, axis=1)
        for d in dists:
            all_dists.append((d, label))
    all_dists.sort(key=lambda x: x[0])
    nearest = all_dists[:k]
    if max_dist is not None:
        mean_dist = np.mean([d for d, _ in nearest])
        if mean_dist > max_dist:
            return "none"
    labels = [label for _, label in nearest]
    values, counts = np.unique(labels, return_counts=True)
    return values[np.argmax(counts)]


def count_reps(feats, scaler, coefs, intercepts, bank, max_dist, hysteresis=2):
    state = "WAITING_TOP"
    pending, stable, reps = None, 0, 0
    for frame in feats:
        scaled = scaler.transform(frame.reshape(1, -1))
        emb = encode(scaled, coefs, intercepts)[0]
        phase = classify_embedding_knn(emb, bank, max_dist=max_dist)
        if phase == pending:
            stable += 1
        else:
            pending, stable = phase, 1
        if stable < hysteresis:
            continue
        if state == "WAITING_TOP" and phase == "top":
            state = "READY"
        elif state == "READY" and phase == "bottom_good":
            state = "BOTTOM_REACHED"
        elif state == "BOTTOM_REACHED" and phase == "top":
            reps += 1
            state = "READY"
    return reps


def main():
    X, y, groups = build_labeled_dataset()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42)
    train_idx, val_idx = next(splitter.split(X, y, groups))

    scaler = StandardScaler().fit(X[train_idx])
    clf = MLPClassifier(
        hidden_layer_sizes=(16, 8), activation="relu",
        alpha=1e-2, max_iter=3000, random_state=42,
    )
    clf.fit(scaler.transform(X[train_idx]), y[train_idx])
    coefs, intercepts = clf.coefs_, clf.intercepts_

    # Reference bank from TRAIN portion only (held-out val videos never seen)
    bank = {}
    for label in np.unique(y[train_idx]):
        mask = y[train_idx] == label
        bank[label] = encode(scaler.transform(X[train_idx][mask]), coefs, intercepts)

    # Calibrate max_dist from genuine in-distribution distances (train frames)
    all_train_emb = encode(scaler.transform(X[train_idx]), coefs, intercepts)
    all_refs = np.concatenate(list(bank.values()), axis=0)
    sample_dists = []
    for emb in all_train_emb:
        d = np.sort(np.linalg.norm(all_refs - emb, axis=1))[:3].mean()
        sample_dists.append(d)
    max_dist = float(np.percentile(sample_dists, 99) * 1.5)
    print(f"calibrated max_dist: {max_dist:.3f}")

    # --- Validate end-to-end rep counting on held-out videos ---
    correct_videos = load_videos("correct")
    incorrect_videos = load_videos("incorrect")

    val_groups = set(groups[val_idx].tolist())
    correct_val = [correct_videos[g] for g in val_groups if g < 1000]
    incorrect_val = [incorrect_videos[g - 1000] for g in val_groups if g >= 1000]

    correct_rep_counts = [
        count_reps(feats, scaler, coefs, intercepts, bank, max_dist)
        for feats in correct_val
    ]
    incorrect_rep_counts = [
        count_reps(feats, scaler, coefs, intercepts, bank, max_dist)
        for feats in incorrect_val
    ]
    print(f"\nHeld-out CORRECT videos ({len(correct_val)}): "
          f"rep count distribution {np.unique(correct_rep_counts, return_counts=True)}")
    print(f"Held-out INCORRECT videos ({len(incorrect_val)}): "
          f"rep count distribution {np.unique(incorrect_rep_counts, return_counts=True)}")
    correctly_counted = sum(1 for r in correct_rep_counts if r == 1)
    correctly_rejected = sum(1 for r in incorrect_rep_counts if r != 1)
    print(f"\nCorrect videos counted as exactly 1 rep: "
          f"{correctly_counted}/{len(correct_val)}")
    print(f"Incorrect videos NOT counted as a clean rep (0 or 2+): "
          f"{correctly_rejected}/{len(incorrect_val)}")

    # --- Build FINAL production artifacts on ALL data ---
    scaler_full = StandardScaler().fit(X)
    clf_full = MLPClassifier(
        hidden_layer_sizes=(16, 8), activation="relu",
        alpha=1e-2, max_iter=3000, random_state=42,
    )
    clf_full.fit(scaler_full.transform(X), y)
    coefs_f, intercepts_f = clf_full.coefs_, clf_full.intercepts_

    bank_full = {}
    for label in np.unique(y):
        mask = y == label
        bank_full[label] = encode(scaler_full.transform(X[mask]), coefs_f, intercepts_f)

    all_emb_full = encode(scaler_full.transform(X), coefs_f, intercepts_f)
    all_refs_full = np.concatenate(list(bank_full.values()), axis=0)
    sample_dists_full = []
    for emb in all_emb_full:
        d = np.sort(np.linalg.norm(all_refs_full - emb, axis=1))[:3].mean()
        sample_dists_full.append(d)
    max_dist_full = float(np.percentile(sample_dists_full, 99) * 1.5)

    out = {
        "featureMean": scaler_full.mean_.tolist(),
        "featureStd": scaler_full.scale_.tolist(),
        "encoderW1": coefs_f[0].tolist(),
        "encoderB1": intercepts_f[0].tolist(),
        "encoderW2": coefs_f[1].tolist(),
        "encoderB2": intercepts_f[1].tolist(),
        "maxDistance": max_dist_full,
        "bank": {label: refs.tolist() for label, refs in bank_full.items()},
    }
    out_path = os.path.join(ROOT, "data", "pushup_embedding_bank.json")
    with open(out_path, "w") as f:
        json.dump(out, f)
    print(f"\nSaved production artifacts to {out_path}")
    print(f"encoder shapes: W1{coefs_f[0].shape} W2{coefs_f[1].shape}")
    print(f"bank sizes: " + ", ".join(f"{k}={len(v)}" for k, v in bank_full.items()))
    print(f"max_dist_full: {max_dist_full:.3f}")


if __name__ == "__main__":
    main()
