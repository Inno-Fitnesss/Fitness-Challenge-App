"""Train the softmax-pretext classifier and validate it with a grouped
train/val split (grouped by source video, not by frame - otherwise frames
from the same video leak between train and val and inflate accuracy)."""

import numpy as np
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from train_embedding import build_labeled_dataset


def main():
    X, y, groups = build_labeled_dataset()

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42)
    train_idx, val_idx = next(splitter.split(X, y, groups))

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X[train_idx])
    X_val = scaler.transform(X[val_idx])
    y_train, y_val = y[train_idx], y[val_idx]

    print(f"train: {len(train_idx)} frames from {len(np.unique(groups[train_idx]))} videos")
    print(f"val:   {len(val_idx)} frames from {len(np.unique(groups[val_idx]))} videos")

    clf = MLPClassifier(
        hidden_layer_sizes=(16, 8),
        activation="relu",
        alpha=1e-2,
        max_iter=3000,
        random_state=42,
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_val)
    print("\n=== Classification report (held-out videos) ===")
    print(classification_report(y_val, y_pred))
    print("Confusion matrix (rows=true, cols=pred), classes:", clf.classes_)
    print(confusion_matrix(y_val, y_pred, labels=clf.classes_))

    print("\nTrain accuracy:", clf.score(X_train, y_train))
    print("Val accuracy:", clf.score(X_val, y_val))


if __name__ == "__main__":
    main()
