#!/usr/bin/env python3
"""CLI Command: Train and Evaluate AeroTwin-X Machine Learning Models."""
import sys
import os
import argparse
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ml.train import train_models_from_splits, ARTIFACTS_DIR


def main():
    parser = argparse.ArgumentParser(description="Train and Evaluate AeroTwin-X ML Models")
    parser.add_argument("--datasets-dir", type=str, default="datasets", help="Path to datasets directory")
    parser.add_argument("--artifacts-dir", type=str, default=ARTIFACTS_DIR, help="Path to save artifacts")
    args = parser.parse_args()

    print("Initiating AeroTwin-X Machine Learning Training Run...")
    results = train_models_from_splits(
        datasets_dir=args.datasets_dir,
        artifacts_dir=args.artifacts_dir
    )

    print("\nTraining Run Completed!")
    print(f" -> Model Version: {results['model_version']}")
    print(f" -> Classification Accuracy: {results['metrics']['supervised_classification']['accuracy'] * 100:.2f}%")
    print(f" -> Classification Macro F1: {results['metrics']['supervised_classification']['macro_f1']:.4f}")
    print(f" -> Anomaly ROC-AUC: {results['metrics']['anomaly_detection']['roc_auc']:.4f}")
    print(f" -> Anomaly F1: {results['metrics']['anomaly_detection']['f1_score']:.4f}")


if __name__ == "__main__":
    main()
