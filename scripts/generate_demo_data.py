#!/usr/bin/env python3
"""CLI Command: Generate Reproducible AeroTwin-X Demo Sensor Dataset."""
import sys
import os
import argparse
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ml.demo_data_generator import DemoDataGenerator


def main():
    parser = argparse.ArgumentParser(description="Generate AeroTwin-X Demo Sensor Dataset")
    parser.add_argument("--seed", type=int, default=42, help="Reproducible random seed")
    parser.add_argument("--duration", type=float, default=60.0, help="Duration in flight minutes")
    parser.add_argument("--output-dir", type=str, default="datasets", help="Output directory")
    args = parser.parse_args()

    print(f"Generating AeroTwin-X demo dataset (Duration: {args.duration}m, Seed: {args.seed})...")
    generator = DemoDataGenerator(seed=args.seed)
    metadata = generator.generate_and_save_dataset_suite(
        output_dir=args.output_dir,
        duration_minutes=args.duration
    )

    print("\nDataset Generation Succeeded!")
    print(f" -> Output directory: {args.output_dir}")
    print(f" -> Total Records: {metadata['total_records']}")
    print(f" -> SHA256 Fingerprint: {metadata['sha256_fingerprint'][:16]}...")
    print(" -> Fault Distribution:")
    for k, v in metadata["fault_label_distribution"].items():
        print(f"    - {k}: {v} samples ({v / metadata['total_records'] * 100:.1f}%)")


if __name__ == "__main__":
    main()
