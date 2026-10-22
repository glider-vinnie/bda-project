import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Database, FileText, Gauge, Layers3, Play, RefreshCw, Star, CircleCheck, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
const COLORS = ['#ef4444', '#f97316', '#eab308', '#60a5fa', '#2563eb'];

export default function App() {
  const [ratings, setRatings] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Connect to the local Flask backend to load Hadoop output.');
  const [error, setError] = useState('');
  const total = useMemo(() => ratings.reduce((s, r) => s + r.count, 0), [ratings]);
  const fiveStar = ratings.find(r => Number(r.rating) === 5)?.count || 0;
  const avg = total ? ratings.reduce((s, r) => s + Number(r.rating) * r.count, 0) / total : 0;
  const chartData = ratings.map(r => ({ ...r, label: `${r.rating} star${r.rating === 1 ? '' : 's'}`, percent: total ? +(100*r.count/total).toFixed(2) : 0 }));

  async function checkHealth() {
    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      setHealth(data);
      if (!data.dataset_exists || !data.mapper_exists || !data.reducer_exists || !data.streaming_jar_exists) {
        setError('Backend is reachable, but one or more required files are missing. Check the backend setup instructions.');
      } else setError('');
    } catch {
      setHealth(null);
      setError('Cannot reach Flask. Start the backend at http://127.0.0.1:5000 first.');
    }
  }

  async function loadResults() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/results`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not read Hadoop output.');
      setRatings(data.ratings || []);
      setMessage(`Loaded ${data.ratings.length} rating groups from HDFS output.`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function runJob() {
    setLoading(true); setError(''); setMessage('Submitting Hadoop Streaming job. This may take several minutes…');
    try {
      const res = await fetch(`${API}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Hadoop job failed.');
      setRatings(data.ratings || []);
      setMessage(`${data.message} Read ${data.ratings.length} rating groups from HDFS.`);
    } catch (e) { setError(e.message); setMessage('The job did not complete. See the error below.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { checkHealth(); }, []);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BarChart3 size={22}/></div><div><strong>ReviewLens</strong><span>BIG DATA ANALYTICS</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      <div className="nav-item active"><Gauge size={18}/> Overview</div>
      <div className="nav-item"><Database size={18}/> Dataset & pipeline</div>
      <div className="nav-item"><Layers3 size={18}/> MapReduce workflow</div>
      <div className="sidebar-bottom"><div className="status-dot"/><div><b>Local Hadoop cluster</b><span>{health ? 'Backend reachable' : 'Checking connection…'}</span></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">DATA ENGINEERING PROJECT</span><h1>Amazon Review Analytics</h1><p>Understand customer rating patterns with Hadoop MapReduce.</p></div><div className="top-tag"><Database size={15}/> Hadoop Streaming</div></header>

      <section className="hero">
        <div className="hero-copy"><div className="hero-pill"><span/> DISTRIBUTED PROCESSING</div><h2>From raw reviews<br/>to useful insights.</h2><p>Aggregate review ratings at scale using a Python mapper, Hadoop shuffle and sort, and a reducer.</p><div className="hero-actions"><button className="primary-btn" onClick={runJob} disabled={loading}><Play size={16} fill="currentColor"/>{loading ? 'Processing…' : 'Run Hadoop analysis'}</button><button className="secondary-btn" onClick={loadResults} disabled={loading}><RefreshCw size={16}/> Load existing results</button></div></div>
        <div className="hero-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-center"><BarChart3 size={42}/><span>MAP<br/>REDUCE</span></div><div className="floating-chip chip-a"><Database size={16}/> HDFS input</div><div className="floating-chip chip-b"><CircleCheck size={16}/> Aggregation</div></div>
      </section>

      <div className="notice"><FileText size={17}/><span>{message}</span></div>
      {error && <div className="error"><AlertTriangle size={18}/><span>{error}</span></div>}

      <section className="metrics">
        <Metric icon={<Database/>} label="Reviews in output" value={total.toLocaleString()} note="Sum of Hadoop reducer counts"/>
        <Metric icon={<Star/>} label="5-star reviews" value={fiveStar.toLocaleString()} note={total ? `${(100*fiveStar/total).toFixed(1)}% of output` : 'Waiting for results'}/>
        <Metric icon={<Gauge/>} label="Weighted average" value={total ? avg.toFixed(2) : '—'} note="Based on rating counts"/>
        <Metric icon={<Layers3/>} label="Rating groups" value={ratings.length || '—'} note="Distinct ratings returned"/>
      </section>

      <section className="charts-grid">
        <div className="panel"><div className="panel-head"><div><h3>Rating distribution</h3><p>Number of reviews by star rating</p></div><span className="panel-icon"><BarChart3 size={18}/></span></div>
          {chartData.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:10,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf4"/><XAxis dataKey="label" tick={{fill:'#667085',fontSize:12}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#667085',fontSize:12}} axisLine={false} tickLine={false}/><Tooltip formatter={(v)=>[Number(v).toLocaleString(),'Reviews']} contentStyle={{borderRadius:12,border:'1px solid #e5eaf2'}}/><Bar dataKey="count" fill="#3768e5" radius={[7,7,0,0]} maxBarSize={54}/></BarChart></ResponsiveContainer></div> : <Empty/>}
        </div>
        <div className="panel"><div className="panel-head"><div><h3>Rating share</h3><p>Percentage of processed output</p></div><span className="panel-icon"><Gauge size={18}/></span></div>
          {chartData.length ? <><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="count" nameKey="label" innerRadius={62} outerRadius={91} paddingAngle={3} stroke="none">{chartData.map((d,i)=><Cell key={d.rating} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(v)=>[`${(100*v/total).toFixed(2)}%`,'Share']}/></PieChart></ResponsiveContainer><div className="donut-center"><b>{total.toLocaleString()}</b><span>reviews</span></div></div><div className="legend">{chartData.map((r,i)=><div key={r.rating}><span style={{background:COLORS[i%COLORS.length]}}/>{r.label}<b>{r.percent}%</b></div>)}</div></> : <Empty/>}
        </div>
      </section>

      <section className="panel table-panel"><div className="panel-head"><div><h3>Reducer output</h3><p>Values returned by the Hadoop output files in HDFS</p></div><button className="small-btn" onClick={loadResults} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
        {ratings.length ? <div className="table-wrap"><table><thead><tr><th>Rating</th><th>Review count</th><th>Share</th><th>Distribution</th></tr></thead><tbody>{chartData.map((r,i)=><tr key={r.rating}><td><span className="rating-badge">{r.rating} <Star size={13} fill="currentColor"/></span></td><td className="num">{r.count.toLocaleString()}</td><td>{r.percent}%</td><td><div className="progress"><span style={{width:`${r.percent}%`,background:COLORS[i%COLORS.length]}}/></div></td></tr>)}</tbody><tfoot><tr><td>Total</td><td className="num">{total.toLocaleString()}</td><td>{total ? '100%' : '—'}</td><td/></tr></tfoot></table></div> : <Empty/>}
      </section>

      <section className="workflow"><div className="workflow-heading"><div><span className="eyebrow">UNDER THE HOOD</span><h3>How the pipeline works</h3></div><span className="workflow-tag">3 stages</span></div><div className="steps"><Step n="01" title="Input in HDFS" desc="Cleaned CSV is stored in the distributed file system."/><div className="step-arrow">→</div><Step n="02" title="Mapper" desc="Emits each rating as a key-value pair: (rating, 1)."/><div className="step-arrow">→</div><Step n="03" title="Reducer" desc="Sums values per rating and writes final counts."/></div></section>
      <footer><span>ReviewLens · Amazon Review Rating Analysis</span><span>Built with React, Flask & Hadoop Streaming</span></footer>
    </main>
  </div>;
}

function Metric({icon,label,value,note}) { return <div className="metric"><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-live">LIVE OUTPUT</span></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div>; }
function Empty() { return <div className="empty"><Database size={25}/><b>No Hadoop output loaded yet</b><span>Start the backend, then run analysis or load existing results.</span></div>; }
function Step({n,title,desc}) { return <div className="step"><span>{n}</span><h4>{title}</h4><p>{desc}</p></div>; }
