"""Train + cross-validate the pushup rep-validity classifier.

Only the 100 real (unrotated) videos carry independent information - the
rotation augmentation was shown (build_features.py output) to produce
numerically identical features per video, since every feature is a 3D angle
and angles between points are exactly invariant under rigid rotation. So we
train/evaluate on the 100 real samples only, with grouped k-fold (irrelevant
here since groups==samples 1:1, but kept for clarity/future-proofing if
non-invariant features are added later).

Baseline for comparison: the current production gate, i.e. reject if
bodyLine_min < 150 or tilt3d_max > 45 (mirrors SETTINGS.pushup in
poseCvEngine.ts, with tilt computed the view-invariant 3D way instead of the
buggy 2D way - this isolates "does the tilt formula matter" from "does ML
add anything on top of just fixing the formula").
"""

import os

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

ROOT = os.path.dirname(os.path.abspath(__file__))
FEATURES_PATH = os.path.join(ROOT, "data", "features.npz")

FEATURE_NAMES = ["elbow_min", "elbow_max", "bodyLine_min", "bodyLine_max",
                  "tilt3d_min", "tilt3d_max", "bodyLine_at_bottom", "tilt3d_at_bottom"]


def load_real_samples():
    d = np.load(FEATURES_PATH)
    mask = d["rotation_deg"] == 0.0
    return d["X"][mask], d["y"][mask]


def baseline_predict(X):
    """Full replica of the current production gate: depth/amplitude
    (elbow reaches bottom+top with enough range) AND posture (bodyLine/tilt),
    matching SETTINGS.pushup in poseCvEngine.ts. Using tilt3d instead of the
    buggy 2D tilt so this isolates the ML question from the tilt-formula fix."""
    elbow_min, elbow_max = X[:, 0], X[:, 1]
    body_line_min, tilt_max = X[:, 2], X[:, 5]
    amplitude = elbow_max - elbow_min
    depth_ok = (elbow_min <= 110) & (elbow_max >= 125) & (amplitude >= 15)
    # production checks tilt/bodyLine on every incoming frame, so any single
    # bad frame fails the whole rep - the equivalent single-number proxy
    # over a whole clip is worst-case (min bodyLine / max tilt).
    posture_ok = (body_line_min >= 150) & (tilt_max <= 45)
    return (depth_ok & posture_ok).astype(int)


def report(name, y_true, y_pred):
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)
    print(f"\n=== {name} ===")
    print(f"accuracy={acc:.3f}  precision={prec:.3f}  recall={rec:.3f}")
    print("confusion matrix [[TN, FP], [FN, TP]]:")
    print(cm)


def main():
    X, y = load_real_samples()
    print(f"Loaded {X.shape[0]} real samples, {X.shape[1]} features")

    for i, name in enumerate(FEATURE_NAMES):
        print(f"  {name}: min={X[:,i].min():.1f} max={X[:,i].max():.1f} "
              f"mean={X[:,i].mean():.1f}")

    baseline_pred = baseline_predict(X)
    report("Baseline (fixed thresholds, 3D tilt)", y, baseline_pred)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # Logistic regression (scaled)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    logreg = LogisticRegression(max_iter=1000)
    logreg_pred = cross_val_predict(logreg, X_scaled, y, cv=cv)
    report("Logistic Regression (5-fold CV)", y, logreg_pred)

    # Small MLP
    mlp = MLPClassifier(hidden_layer_sizes=(16,), activation="relu",
                         alpha=1e-2, max_iter=3000, random_state=42)
    mlp_pred = cross_val_predict(mlp, X_scaled, y, cv=cv)
    report("MLP 16-hidden (5-fold CV)", y, mlp_pred)

    # disagreements between baseline and best learned model, for inspection
    disagree = np.where(baseline_pred != y)[0]
    print(f"\nBaseline gets {len(disagree)}/{len(y)} wrong "
          f"(indices: {disagree.tolist()})")


if __name__ == "__main__":
    main()
