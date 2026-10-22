import os
import glob
import subprocess
from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    r"http://localhost:5173",
    r"http://127\.0\.0\.1:5173",
]}})

DATA_DIR = Path(os.environ.get("BDA_DATA_DIR", r"C:\BDA"))
HADOOP_HOME = Path(os.environ.get("HADOOP_HOME", r"C:\hadoop"))
STREAMING_JAR = Path(os.environ.get(
    "HADOOP_STREAMING_JAR",
    str(HADOOP_HOME / "share" / "hadoop" / "tools" / "lib" / "hadoop-streaming-3.2.4.jar")
))
INPUT_HDFS = "/amazon/input/amazon_reviews_clean.csv"
OUTPUT_HDFS = "/amazon/output"
MAPPER = DATA_DIR / "mapper.py"
REDUCER = DATA_DIR / "reducer.py"
DATASET = DATA_DIR / "amazon_reviews_clean.csv"


def hadoop_executable(name):
    """Resolve Hadoop launchers explicitly so Windows does not depend on PATH."""
    bin_dir = HADOOP_HOME / "bin"
    candidates = [bin_dir / f"{name}.cmd", bin_dir / name] if os.name == "nt" else [bin_dir / name]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return name


HDFS = hadoop_executable("hdfs")
HADOOP = hadoop_executable("hadoop")

def run_command(args, timeout=1800):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, shell=False)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or f"Command failed: {args[0]}")[-6000:])
    return p.stdout.strip()

def parse_output(raw):
    rows = []
    for line in raw.splitlines():
        parts = line.strip().split()
        if len(parts) >= 2:
            try:
                rating = float(parts[0])
                count = int(parts[1])
                rows.append({"rating": rating, "count": count})
            except ValueError:
                continue
    return sorted(rows, key=lambda x: x["rating"])

def get_hadoop_output():
    raw = run_command([HDFS, "dfs", "-cat", f"{OUTPUT_HDFS}/part-*"], timeout=120)
    return parse_output(raw)

@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "data_dir_exists": DATA_DIR.exists(),
        "dataset_exists": DATASET.exists(),
        "mapper_exists": MAPPER.exists(),
        "reducer_exists": REDUCER.exists(),
        "streaming_jar_exists": STREAMING_JAR.exists(),
    })

@app.get("/api/results")
def results():
    try:
        rows = get_hadoop_output()
        return jsonify({"ok": True, "source": "HDFS output", "ratings": rows,
                        "total": sum(r["count"] for r in rows)})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc), "ratings": [], "total": 0}), 503

@app.post("/api/run")
def run_hadoop():
    try:
        for path in (DATASET, MAPPER, REDUCER, STREAMING_JAR):
            if not path.exists():
                return jsonify({"ok": False, "error": f"Required file not found: {path}"}), 400

        # Confirm the configured HDFS input exists before deleting old output.
        run_command([HDFS, "dfs", "-test", "-e", INPUT_HDFS], timeout=30)
        # Clear only the previous generated output directory.
        subprocess.run([HDFS, "dfs", "-rm", "-r", "-f", OUTPUT_HDFS],
                       capture_output=True, text=True, timeout=60)

        files_arg = (
            f"file:///{str(MAPPER).replace(os.sep, '/') }#mapper.py,"
            f"file:///{str(REDUCER).replace(os.sep, '/') }#reducer.py"
        )
        command = [
            HADOOP, "jar", str(STREAMING_JAR),
            "-files", files_arg,
            "-mapper", "python mapper.py",
            "-reducer", "python reducer.py",
            "-input", INPUT_HDFS,
            "-output", OUTPUT_HDFS,
        ]
        # Hadoop jobs can take a while on Windows.
        proc = subprocess.run(command, capture_output=True, text=True, timeout=1800, shell=False)
        if proc.returncode != 0:
            return jsonify({"ok": False, "error": (proc.stderr or proc.stdout or "Hadoop job failed")[-6000:]}), 500

        rows = get_hadoop_output()
        return jsonify({
            "ok": True,
            "message": "Hadoop Streaming job completed.",
            "ratings": rows,
            "total": sum(r["count"] for r in rows),
            "job_log": (proc.stdout + "\n" + proc.stderr)[-2500:]
        })
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "The Hadoop command timed out. Check YARN/Hadoop status and logs."}), 504
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
