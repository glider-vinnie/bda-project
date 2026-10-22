# Amazon Review Rating Analytics — Website

## Live dashboard

View the deployed dashboard at [amazon-review-analytics.vercel.app](https://amazon-review-analytics.vercel.app).

The Vercel deployment displays the latest published Hadoop reducer output, including
the rating charts and summary metrics. Running a new Hadoop job requires the local
Windows backend and Hadoop installation described below.

## Stack
- Frontend: React + Vite
- Backend: Python Flask
- Big-data engine: Hadoop Streaming + existing Python mapper/reducer
- Intended for the existing Windows Hadoop setup.

## Important
This backend runs commands on the SAME Windows machine where Hadoop is installed.
Hosting the frontend online does not make the local Hadoop cluster accessible. Use
the deployed dashboard to view published results; run the frontend and backend
locally on your Hadoop machine to execute or refresh a Hadoop job.

## 1. Expected existing files
Check these exist:
- `C:\BDA\amazon_reviews_clean.csv`
- `C:\BDA\mapper.py`
- `C:\BDA\reducer.py`
- `C:\hadoop\share\hadoop\tools\lib\hadoop-streaming-3.2.4.jar`

HDFS input should already exist at `/amazon/input/amazon_reviews_clean.csv`.
The backend uses `/amazon/output`; if that output already exists, it removes it before a new run.

## 2. Start backend (Windows CMD)
Open CMD in this folder:
```cmd
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set BDA_DATA_DIR=C:\BDA
set HADOOP_HOME=C:\hadoop
set HADOOP_STREAMING_JAR=C:\hadoop\share\hadoop\tools\lib\hadoop-streaming-3.2.4.jar
py app.py
```
Backend runs at `http://127.0.0.1:5000`.

If `py` is not recognized, use `python` instead.

## 3. Start frontend (second CMD)
Install Node.js if `npm` is unavailable. In a second CMD:
```cmd
cd frontend
npm install
npm run dev
```
Open the URL Vite prints, usually `http://localhost:5173`.

## What the Run Hadoop button does
1. Checks Hadoop commands and expected local files.
2. Removes old `/amazon/output` if it exists.
3. Runs the Hadoop Streaming job with mapper and reducer.
4. Reads `/amazon/output/part-*` from HDFS.
5. Returns the actual output rows to the dashboard.

## Notes / troubleshooting
- Hadoop must already be configured and working in this same Windows session.
- Start NameNode/DataNode and YARN first, using the commands that worked in your lab.
- If PowerShell is used, the activation syntax differs; these instructions are for CMD.
- `hdfs dfs -rm -r -f /amazon/output` is destructive only to the generated output folder, not the input dataset.
- The API permits only the predefined Hadoop job; it does not accept arbitrary commands from the browser.
- A browser dashboard cannot itself start a Hadoop cluster hosted on a different computer.
- This is a local demo build. Do not expose Flask publicly without authentication and security hardening.
