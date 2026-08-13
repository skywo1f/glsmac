#!/usr/bin/env python3

import argparse
import re
import subprocess
import sys
from pathlib import Path


def run_phase(args, marker):
    command = [
        str(args.executable),
        "--prefix", str(args.output_dir),
        "--smacpath", str(args.smac_path),
        "--mainscript", "../tests/_save_load_runtime_smoke",
        "--skipintro",
        "--nosound",
        "--headless",
        "--windowed",
        "--window-size", "1024x768",
        "--verbose",
    ]
    try:
        completed = subprocess.run(
            command,
            cwd=args.workdir,
            capture_output=True,
            text=True,
            timeout=args.timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        if error.stdout:
            print(error.stdout.decode() if isinstance(error.stdout, bytes) else error.stdout, end="")
        if error.stderr:
            print(error.stderr.decode() if isinstance(error.stderr, bytes) else error.stderr, end="")
        raise
    output = completed.stdout + completed.stderr
    print(output, end="")
    if completed.returncode != 0:
        raise RuntimeError(f"phase exited with status {completed.returncode}")
    if "SAVE_LOAD_RUNTIME_FAIL" in output:
        raise RuntimeError("runtime fixture reported failure")
    if marker not in output:
        raise RuntimeError(f"phase did not report {marker}")
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--executable", type=Path, required=True)
    parser.add_argument("--smac-path", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--workdir", type=Path, required=True)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    save_path = args.output_dir / "saves" / "quicksave.glsmac"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if save_path.exists():
        save_path.unlink()

    run_phase(args, "SAVE_LOAD_RUNTIME_SAVE_PASS")
    if not save_path.is_file() or save_path.stat().st_size == 0:
        raise RuntimeError("save phase did not produce a non-empty quicksave")

    run_phase(args, "SAVE_LOAD_RUNTIME_RESUME_PASS")
    first_load = run_phase(args, "SAVE_LOAD_RUNTIME_LOAD_PASS")
    second_load = run_phase(args, "SAVE_LOAD_RUNTIME_LOAD_PASS")
    pattern = re.compile(r"SAVE_LOAD_RUNTIME_RANDOM_(\d+)")
    first_random = pattern.search(first_load)
    second_random = pattern.search(second_load)
    if not first_random or not second_random or first_random.group(1) != second_random.group(1):
        raise RuntimeError("restored random state is not deterministic")

    print("SAVE_LOAD_SMOKE_PASS")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"SAVE_LOAD_SMOKE_FAIL: {error}", file=sys.stderr)
        sys.exit(1)
