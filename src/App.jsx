import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'coreTimerData';
const HEALTH_VERSION = 1;
const DEFAULT_PREPARE_SECONDS = 4;

const FOUNDATION_EXERCISES = [
  { id: 'medium-kegel', label: 'Medium Kegel exercises', type: 'kegel', reps: 6, holdSeconds: 6, restSeconds: 3 },
  { id: 'short-kegel', label: 'Short Kegel exercises', type: 'kegel', reps: 9, holdSeconds: 1, restSeconds: 1 },
  { id: 'long-kegel', label: 'Long Kegel exercises', type: 'kegel', reps: 3, holdSeconds: 10, restSeconds: 5 },
  { id: 'medium-reverse-kegel', label: 'Medium reverse Kegel exercises', type: 'reverse-kegel', reps: 6, holdSeconds: 6, restSeconds: 3 },
  { id: 'short-reverse-kegel', label: 'Short reverse Kegel exercises', type: 'reverse-kegel', reps: 9, holdSeconds: 1, restSeconds: 1 },
  { id: 'long-reverse-kegel', label: 'Long reverse Kegel exercises', type: 'reverse-kegel', reps: 3, holdSeconds: 10, restSeconds: 5 },
];

const ROUTINE_LEVELS = {
  foundation: { label: 'Foundation', multiplier: 1 },
  build: { label: 'Build', multiplier: 1.2 },
  strong: { label: 'Strong', multiplier: 1.4 },
  advanced: { label: 'Advanced', multiplier: 1.6 },
};

const defaultData = {
  completions: [], currentStreak: 0, bestStreak: 0, totalSessions: 0, lastCompletedAt: null,
  level: 'foundation', reminderTime: '09:00', discreetMode: false, restBetweenSets: 4,
  dailyNudge: true, subtleCues: true, theme: 'sand', healthAcknowledgedVersion: 0,
  displayName: '', prepareSeconds: DEFAULT_PREPARE_SECONDS,
  includedExercises: FOUNDATION_EXERCISES.map((e) => e.id),
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
const loadData = () => {
  try {
    const loaded = { ...defaultData, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    const included = Array.isArray(loaded.includedExercises) && loaded.includedExercises.length
      ? loaded.includedExercises.filter((id) => FOUNDATION_EXERCISES.some((e) => e.id === id))
      : FOUNDATION_EXERCISES.map((e) => e.id);
    return {
      ...loaded,
      prepareSeconds: clamp(parseInt(loaded.prepareSeconds, 10) || DEFAULT_PREPARE_SECONDS, 1, 30),
      includedExercises: included.length ? included : FOUNDATION_EXERCISES.map((e) => e.id),
    };
  } catch {
    return defaultData;
  }
};
const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
const formatTime = (ms) => `${String(Math.floor(Math.max(0, Math.ceil(ms / 1000)) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.ceil(ms / 1000)) % 60).padStart(2, '0')}`;

const getGreeting = (date = new Date()) => {
  const h = date.getHours();
  if (h >= 5 && h <= 11) return ['Good', 'morning'].join(' ');
  if (h >= 12 && h <= 16) return ['Good', 'afternoon'].join(' ');
  return ['Good', 'evening'].join(' ');
};

const HealthWarning = ({ onAcknowledge }) => <div className="screen card"><h1>Health guidance</h1><ul><li>This app is for habit tracking and not medical advice.</li><li>Stop if you feel pain or unusual symptoms.</li><li>Breathe naturally and avoid strain.</li></ul><button onClick={onAcknowledge}>I understand</button></div>;

export function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState('home');
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [currentPhaseMs, setCurrentPhaseMs] = useState(0);
  const [settingsMessage, setSettingsMessage] = useState('');
  const phaseEndRef = useRef(null);
  const rafRef = useRef(null);

  const level = ROUTINE_LEVELS[data.level] || ROUTINE_LEVELS.foundation;

  const routine = useMemo(() => {
    const steps = [{ label: 'Get ready', duration: clamp(Number(data.prepareSeconds) || DEFAULT_PREPARE_SECONDS, 1, 30), groupId: 'prepare', groupLabel: 'Preparation' }];
    const selectedExercises = FOUNDATION_EXERCISES.filter((exercise) => data.includedExercises.includes(exercise.id));
    selectedExercises.forEach((exercise) => {
      const scaledReps = Math.max(1, Math.round(exercise.reps * level.multiplier));
      const scaledHoldSeconds = exercise.holdSeconds === 1 ? 1 : Math.max(1, Math.round(exercise.holdSeconds * level.multiplier));
      for (let rep = 1; rep <= scaledReps; rep += 1) {
        const actionLabel = exercise.type === 'reverse-kegel' ? 'Reverse Kegel release' : 'Kegel squeeze';
        steps.push({ label: actionLabel, duration: scaledHoldSeconds, rep, totalReps: scaledReps, groupId: exercise.id, groupLabel: exercise.label });
        if (rep < scaledReps) {
          steps.push({ label: 'Rest', duration: exercise.restSeconds, rep, totalReps: scaledReps, groupId: exercise.id, groupLabel: exercise.label });
        }
      }
      const setRest = clamp(Number(data.restBetweenSets) || 4, 1, 60);
      if (setRest > 0) steps.push({ label: 'Set rest', duration: setRest, groupId: exercise.id, groupLabel: exercise.label });
    });
    return steps;
  }, [data.prepareSeconds, data.includedExercises, data.restBetweenSets, level.multiplier]);

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

  const totalMs = routine.reduce((n, x) => n + x.duration * 1000, 0);

  if (view === 'timer') {
    const doneMs = routine.slice(0, stepIndex).reduce((n, x) => n + x.duration * 1000, 0) + Math.max(0, (currentPhaseMs - remainingMs));
    const phaseProgress = clamp((remainingMs / (currentPhaseMs || 1)) * 100, 0, 100);
    return <div className="screen calm timer-screen"><div className="timer-layout"><div className="timer-head"><div className="kicker">{current?.groupLabel || 'Session'}</div><h1 className="hero timer-hero">{current?.label}<span>.</span></h1></div><div className="timer-bubble-wrap" style={{ '--ring-progress': phaseProgress }}><div className="timer-ring" /><div className="circle warm timer-bubble">{Math.ceil(remainingMs / 1000)}</div></div><h2 className="accent center">{current?.label}.</h2><p className="timer-meta">{current?.totalReps ? `Rep ${current?.rep || 1} of ${current?.totalReps}` : 'Prepare to begin'}</p><p className="timer-next">Next: {next ? `${next.label} (${next.duration}s)` : 'Complete'}</p><div className="progress"><div style={{ width: `${clamp((doneMs / (totalMs || 1)) * 100, 0, 100)}%` }} /></div><div className="row"><span>{formatTime(doneMs)}</span><span>{formatTime(totalMs)}</span></div><div className="timer-buttons"><button onClick={() => running ? setRunning(false) : (phaseEndRef.current = performance.now() + remainingMs, setRunning(true))}>{running ? 'Pause' : 'Resume'}</button><button className="ghost" onClick={() => resetSession('home')}>End session</button></div></div></div>;
  }

  if (view === 'complete') return <div className="screen calm"><div className="circle-wrap"><div className="circle warm" /></div><div className="kicker center">COMPLETE</div><h1 className="hero center">That's it for <span>today.</span></h1><p className="subtle center">Move gently, breathe naturally, stay consistent over perfection.</p><div className="stats3"><div><small>TIME</small><strong>{formatTime(totalMs)}</strong></div><div><small>PHASES</small><strong>{routine.length}</strong></div><div><small>STREAK</small><strong>{data.currentStreak} {data.currentStreak === 1 ? 'day' : 'days'}</strong></div></div><button onClick={() => setView('home')}>Done</button><button className="ghost" onClick={() => setView('history')}>View this week</button></div>;

  if (view === 'history') return <div className="screen calm"><div className="kicker">PROGRESS</div><h1 className="hero">{data.currentStreak} {data.currentStreak === 1 ? 'day' : 'days'},<br /><span>steady.</span></h1><div className="stats"><div><small>STREAK</small><strong>{data.currentStreak}</strong><span>{data.currentStreak === 1 ? 'day' : 'days'}</span></div><div><small>BEST</small><strong>{data.bestStreak}</strong><span>{data.bestStreak === 1 ? 'day' : 'days'}</span></div><div><small>TOTAL</small><strong>{data.totalSessions}</strong><span>sessions</span></div></div><div className="card"><div className="kicker">RECENT</div>{[...data.completions].slice(-4).reverse().map((d) => <div key={d} className="list-row"><div><strong>{level.label}</strong><span>{d}</span></div><span>›</span></div>)}</div><nav className="tabbar"><button onClick={() => setView('home')}>Today</button><button className="active">History</button><button onClick={() => setView('settings')}>Settings</button></nav></div>;

  if (view === 'settings') return <div className="screen calm"><div className="kicker">PREFERENCES</div><h1 className="hero">Tune your<br /><span>routine.</span></h1><div className="card"><div className="kicker">ROUTINE</div><label>Routine level<select value={data.level} onChange={(e) => setData((d) => ({ ...d, level: e.target.value }))}>{Object.entries(ROUTINE_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label><label>Initial preparation (s)<input type="number" value={data.prepareSeconds} min="1" max="30" onChange={(e) => setData((d) => ({ ...d, prepareSeconds: clamp(parseInt(e.target.value, 10) || DEFAULT_PREPARE_SECONDS, 1, 30) }))} /></label><label>Rest between sets (s)<input type="number" value={data.restBetweenSets} min="1" max="60" onChange={(e) => setData((d) => ({ ...d, restBetweenSets: clamp(parseInt(e.target.value, 10) || 4, 1, 60) }))} /></label><label>Display name (optional)<input type="text" value={data.displayName} onChange={(e) => setData((d) => ({ ...d, displayName: e.target.value }))} /></label></div><div className="card"><div className="kicker">INCLUDED EXERCISES</div>{FOUNDATION_EXERCISES.map((exercise) => {
    const checked = data.includedExercises.includes(exercise.id);
    return <label key={exercise.id} className="inline">{exercise.label}<input type="checkbox" checked={checked} onChange={() => {
      setSettingsMessage('');
      setData((d) => {
        if (d.includedExercises.includes(exercise.id)) {
          if (d.includedExercises.length === 1) {
            setSettingsMessage('At least one exercise group must stay selected.');
            return d;
          }
          return { ...d, includedExercises: d.includedExercises.filter((id) => id !== exercise.id) };
        }
        return { ...d, includedExercises: [...d.includedExercises, exercise.id] };
      });
    }} /></label>;
  })}
    {settingsMessage && <p className="subtle">{settingsMessage}</p>}
  </div><button className="ghost" onClick={() => setData(defaultData)}>Reset progress</button><nav className="tabbar"><button onClick={() => setView('home')}>Today</button><button onClick={() => setView('history')}>History</button><button className="active">Settings</button></nav></div>;

  const greeting = getGreeting();
  const name = data.displayName?.trim();
  return <div className="screen calm"><div className="kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}</div><h1 className="hero">{greeting}{name ? ',' : ''}<br />{name ? <span>{name}.</span> : <span>there.</span>}</h1><div className="card"><div className="row"><div className="kicker">TODAY'S SESSION</div><strong>{formatTime(totalMs)}</strong></div><div className="session"><div className="circle warm small" /><div><h2>{level.label}</h2><p>{data.includedExercises.length} groups · prep {data.prepareSeconds}s</p></div></div><button onClick={startSession}>{todayDone ? 'Start again' : 'Begin'} →</button></div><div className="card"><div className="row"><div className="kicker">CONSISTENCY</div><strong>BEST {data.bestStreak}</strong></div><h2>{data.currentStreak} {data.currentStreak === 1 ? 'day' : 'days'}</h2></div><nav className="tabbar"><button className="active">Today</button><button onClick={() => setView('history')}>History</button><button onClick={() => setView('settings')}>Settings</button></nav></div>;
}
