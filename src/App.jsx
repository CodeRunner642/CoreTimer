import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'coreTimerData';
const HEALTH_VERSION = 1;

const levels = {
  beginner: { name: 'Foundations', sets: 3, reps: 8, hold: 6, restBetween: 4 },
  intermediate: { name: 'Steady hold', sets: 4, reps: 10, hold: 7, restBetween: 4 },
  advanced: { name: 'Deep focus', sets: 5, reps: 12, hold: 8, restBetween: 5 },
};

const defaultData = {
  completions: [], currentStreak: 0, bestStreak: 0, totalSessions: 0, lastCompletedAt: null,
  level: 'beginner', reminderTime: '09:00', discreetMode: false, restBetweenSets: 4,
  customSets: null, customReps: null, customHold: null, dailyNudge: true, subtleCues: true,
  theme: 'sand', healthAcknowledgedVersion: 0,
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
const loadData = () => { try { return { ...defaultData, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return defaultData; } };
const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
const formatTime = (ms) => `${String(Math.floor(Math.max(0, Math.ceil(ms / 1000)) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.ceil(ms / 1000)) % 60).padStart(2, '0')}`;

const HealthWarning = ({ onAcknowledge }) => <div className="screen card"><h1>Health guidance</h1><ul><li>This app is for habit tracking and not medical advice.</li><li>Stop if you feel pain or unusual symptoms.</li><li>Breathe naturally and avoid strain.</li></ul><button onClick={onAcknowledge}>I understand</button></div>;

export function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState('home');
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [currentPhaseMs, setCurrentPhaseMs] = useState(0);
  const phaseEndRef = useRef(null);
  const rafRef = useRef(null);

  const config = useMemo(() => {
    const base = levels[data.level];
    return {
      name: base.name,
      sets: clamp(Number(data.customSets ?? base.sets), 1, 10),
      reps: clamp(Number(data.customReps ?? base.reps), 1, 20),
      hold: clamp(Number(data.customHold ?? base.hold), 2, 30),
      restBetween: clamp(Number(data.restBetweenSets ?? base.restBetween), 1, 60),
    };
  }, [data]);

  const routine = useMemo(() => {
    const steps = [];
    for (let s = 1; s <= config.sets; s += 1) {
      for (let r = 1; r <= config.reps; r += 1) {
        steps.push({ label: 'Hold', duration: config.hold, set: s, rep: r });
        if (r < config.reps) steps.push({ label: 'Rest', duration: 2, set: s, rep: r });
      }
      if (s < config.sets) steps.push({ label: 'Set rest', duration: config.restBetween, set: s, rep: config.reps });
    }
    return steps;
  }, [config]);

  const current = routine[stepIndex];
  const next = routine[stepIndex + 1];
  const todayDone = data.completions.includes(isoDay());
  useEffect(() => saveData(data), [data]);

  const cancelLoop = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  const resetSession = (to = 'home') => { cancelLoop(); setRunning(false); setStepIndex(0); setRemainingMs(0); setCurrentPhaseMs(0); phaseEndRef.current = null; setView(to); };

  useEffect(() => {
    if (view !== 'timer' || !running || !current || !phaseEndRef.current) return;
    const tick = () => {
      const left = Math.max(0, phaseEndRef.current - performance.now());
      setRemainingMs(left);
      if (left <= 0) {
        if (stepIndex >= routine.length - 1) {
          const today = isoDay();
          resetSession('complete');
          setData((prev) => prev.completions.includes(today) ? prev : {
            ...prev,
            completions: [...prev.completions, today].sort(),
            currentStreak: prev.completions.includes(isoDay(new Date(Date.now() - 86400000))) ? prev.currentStreak + 1 : 1,
            bestStreak: Math.max(prev.bestStreak, prev.completions.includes(isoDay(new Date(Date.now() - 86400000))) ? prev.currentStreak + 1 : 1),
            totalSessions: prev.totalSessions + 1,
            lastCompletedAt: new Date().toISOString(),
          });
          return;
        }
        const nextMs = routine[stepIndex + 1].duration * 1000;
        setStepIndex((i) => i + 1); setCurrentPhaseMs(nextMs); setRemainingMs(nextMs); phaseEndRef.current = performance.now() + nextMs;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return cancelLoop;
  }, [view, running, current, routine, stepIndex]);

  const startSession = () => { const ms = (routine[0]?.duration || 0) * 1000; setStepIndex(0); setCurrentPhaseMs(ms); setRemainingMs(ms); phaseEndRef.current = performance.now() + ms; setRunning(true); setView('timer'); };

  if (data.healthAcknowledgedVersion < HEALTH_VERSION) return <HealthWarning onAcknowledge={() => setData((d) => ({ ...d, healthAcknowledgedVersion: HEALTH_VERSION }))} />;

  if (view === 'timer') {
    const totalMs = routine.reduce((n, x) => n + x.duration * 1000, 0);
    const doneMs = routine.slice(0, stepIndex).reduce((n, x) => n + x.duration * 1000, 0) + Math.max(0, (currentPhaseMs - remainingMs));
    return <div className="screen calm"><div className="kicker">SET {current?.set || 1} OF {config.sets}</div><h1 className="hero">{current?.label}<span>.</span></h1><div className="circle-wrap big"><div className="timer-bubble"><svg className="timer-ring" viewBox="0 0 100 100" aria-hidden="true"><circle className="timer-ring-track" cx="50" cy="50" r="46" /><circle className="timer-ring-progress" cx="50" cy="50" r="46" style={{ strokeDasharray: `${2 * Math.PI * 46}`, strokeDashoffset: `${(1 - clamp(remainingMs / (currentPhaseMs || 1), 0, 1)) * 2 * Math.PI * 46}` }} /></svg><div className="timer-value">{Math.ceil(remainingMs / 1000)}s</div></div></div><h2 className="accent">{current?.label}.</h2><p className="subtle">Rep {current?.rep || 1} of {config.reps}</p><div className="progress"><div style={{ width: `${clamp((doneMs / (totalMs || 1)) * 100, 0, 100)}%` }} /></div><div className="row"><span>{formatTime(doneMs)}</span><span>{formatTime(totalMs)}</span></div><button onClick={() => running ? setRunning(false) : (phaseEndRef.current = performance.now() + remainingMs, setRunning(true))}>{running ? 'Pause' : 'Resume'}</button><button className="ghost" onClick={() => resetSession('home')}>End session</button></div>;
  }

  if (view === 'complete') return <div className="screen calm"><div className="circle-wrap"><div className="circle warm" /></div><div className="kicker center">COMPLETE</div><h1 className="hero center">That's it for <span>today.</span></h1><p className="subtle center">Move gently, breathe naturally, stay consistent over perfection.</p><div className="stats3"><div><small>TIME</small><strong>02:53</strong></div><div><small>REPS</small><strong>{config.sets * config.reps}</strong></div><div><small>STREAK</small><strong>{data.currentStreak} days</strong></div></div><button onClick={() => setView('home')}>Done</button><button className="ghost" onClick={() => setView('history')}>View this week</button></div>;

  if (view === 'history') return <div className="screen calm"><div className="kicker">PROGRESS</div><h1 className="hero">Twelve days,<br /><span>steady.</span></h1><div className="stats"><div><small>STREAK</small><strong>{data.currentStreak}</strong><span>days</span></div><div><small>BEST</small><strong>{data.bestStreak}</strong><span>days</span></div><div><small>TOTAL</small><strong>{data.totalSessions}</strong><span>sessions</span></div></div><div className="card"><div className="kicker">RECENT</div>{[...data.completions].slice(-4).reverse().map((d) => <div key={d} className="list-row"><div><strong>{config.name}</strong><span>{d}</span></div><span>›</span></div>)}</div><nav className="tabbar"><button onClick={() => setView('home')}>Today</button><button className="active">History</button><button onClick={() => setView('settings')}>Settings</button></nav></div>;

  if (view === 'settings') return <div className="screen calm"><div className="kicker">PREFERENCES</div><h1 className="hero">Tune your<br /><span>routine.</span></h1><div className="card"><div className="kicker">ROUTINE</div><label>Difficulty<select value={data.level} onChange={(e) => setData((d) => ({ ...d, level: e.target.value }))}>{Object.entries(levels).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label><label>Sets<input type="number" value={data.customSets ?? config.sets} min="1" max="10" onChange={(e) => setData((d) => ({ ...d, customSets: e.target.value }))} /></label><label>Reps per set<input type="number" value={data.customReps ?? config.reps} min="1" max="20" onChange={(e) => setData((d) => ({ ...d, customReps: e.target.value }))} /></label><label>Hold time (s)<input type="number" value={data.customHold ?? config.hold} min="2" max="30" onChange={(e) => setData((d) => ({ ...d, customHold: e.target.value }))} /></label><label>Rest between (s)<input type="number" value={data.restBetweenSets} min="1" max="60" onChange={(e) => setData((d) => ({ ...d, restBetweenSets: e.target.value }))} /></label></div><div className="card"><div className="kicker">REMINDERS</div><label className="inline">Daily nudge <input type="checkbox" checked={data.dailyNudge} onChange={() => setData((d) => ({ ...d, dailyNudge: !d.dailyNudge }))} /></label><label>Reminder time<input type="time" value={data.reminderTime} onChange={(e) => setData((d) => ({ ...d, reminderTime: e.target.value }))} /></label><label className="inline">Subtle cues<input type="checkbox" checked={data.subtleCues} onChange={() => setData((d) => ({ ...d, subtleCues: !d.subtleCues }))} /></label></div><button className="ghost" onClick={() => setData(defaultData)}>Reset progress</button><nav className="tabbar"><button onClick={() => setView('home')}>Today</button><button onClick={() => setView('history')}>History</button><button className="active">Settings</button></nav></div>;

  return <div className="screen calm"><div className="kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}</div><h1 className="hero">Good morning,<br /><span>Core Timer.</span></h1><div className="card"><div className="row"><div className="kicker">TODAY'S SESSION</div><strong>2:53</strong></div><div className="session"><div className="circle warm small" /><div><h2>{config.name}</h2><p>{config.sets} sets · {config.reps} reps</p></div></div><button onClick={startSession}>{todayDone ? 'Start again' : 'Begin'} →</button></div><div className="card"><div className="row"><div className="kicker">CONSISTENCY</div><strong>BEST {data.bestStreak}</strong></div><h2>{data.currentStreak} days</h2></div><nav className="tabbar"><button className="active">Today</button><button onClick={() => setView('history')}>History</button><button onClick={() => setView('settings')}>Settings</button></nav></div>;
}
