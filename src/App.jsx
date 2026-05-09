import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'coreTimerData';
const HEALTH_VERSION = 1;

const levels = {
  beginner: {
    name: 'Beginner',
    sets: 3,
    prep: 5,
    longHold: 5,
    restAfterLong: 5,
    pulses: 5,
    pulseHold: 1,
    pulseRest: 1,
    restAfterPulses: 10,
    reverseHold: 5,
    restAfterReverse: 5,
    reversePulses: 5,
    reversePulseHold: 1,
    reversePulseRest: 1,
    restBetweenSets: 20,
  },
  intermediate: {
    name: 'Intermediate',
    sets: 4,
    prep: 5,
    longHold: 7,
    restAfterLong: 5,
    pulses: 8,
    pulseHold: 1,
    pulseRest: 1,
    restAfterPulses: 10,
    reverseHold: 7,
    restAfterReverse: 5,
    reversePulses: 8,
    reversePulseHold: 1,
    reversePulseRest: 1,
    restBetweenSets: 20,
  },
  advanced: {
    name: 'Advanced',
    sets: 5,
    prep: 5,
    longHold: 10,
    restAfterLong: 6,
    pulses: 10,
    pulseHold: 1,
    pulseRest: 1,
    restAfterPulses: 12,
    reverseHold: 10,
    restAfterReverse: 6,
    reversePulses: 10,
    reversePulseHold: 1,
    reversePulseRest: 1,
    restBetweenSets: 20,
  },
};

const defaultData = {
  completions: [],
  currentStreak: 0,
  bestStreak: 0,
  totalSessions: 0,
  lastCompletedAt: null,
  level: 'beginner',
  reminderTime: '19:00',
  discreetMode: false,
  healthAcknowledgedVersion: 0,
};

const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    return { ...defaultData, ...JSON.parse(raw) };
  } catch {
    return defaultData;
  }
};

const saveData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const buildRoutine = (config) => {
  const stepsForSet = [
    { label: 'Preparation', key: 'prep', duration: config.prep },
    { label: 'Long Kegel hold', key: 'long-kegel', duration: config.longHold },
    { label: 'Rest', key: 'rest-long', duration: config.restAfterLong },
    ...Array.from({ length: config.pulses }).flatMap((_, i) => [
      { label: `Short Kegel pulse ${i + 1}/${config.pulses}`, key: 'pulse-kegel', duration: config.pulseHold },
      { label: 'Micro-rest', key: 'pulse-rest', duration: config.pulseRest },
    ]),
    { label: 'Rest', key: 'rest-after-pulses', duration: config.restAfterPulses },
    { label: 'Reverse Kegel hold', key: 'reverse-hold', duration: config.reverseHold },
    { label: 'Rest', key: 'rest-reverse', duration: config.restAfterReverse },
    ...Array.from({ length: config.reversePulses }).flatMap((_, i) => [
      { label: `Short reverse pulse ${i + 1}/${config.reversePulses}`, key: 'pulse-reverse', duration: config.reversePulseHold },
      { label: 'Micro-rest', key: 'reverse-pulse-rest', duration: config.reversePulseRest },
    ]),
  ];

  const routine = [];
  for (let set = 1; set <= config.sets; set += 1) {
    stepsForSet.forEach((step) => routine.push({ ...step, set }));
    if (set < config.sets) {
      routine.push({ label: 'Set complete rest', key: 'rest-between-sets', duration: config.restBetweenSets, set });
    }
  }
  return routine;
};

const HealthWarning = ({ onAcknowledge }) => (
  <div className="screen card">
    <h1>Health guidance</h1>
    <ul>
      <li>This app is for general wellbeing and habit tracking only.</li>
      <li>It is not medical advice.</li>
      <li>Stop if you feel pain, discomfort, dizziness, or unusual symptoms.</li>
      <li>Avoid overtraining; more is not always better.</li>
      <li>If you have pelvic pain, urinary symptoms, recent surgery, pregnancy/postpartum concerns, or any medical condition, speak to a qualified healthcare professional before using the exercises.</li>
      <li>Reverse Kegels should feel like gentle relaxation, not straining.</li>
      <li>Breathe normally and avoid holding your breath.</li>
    </ul>
    <button onClick={onAcknowledge}>I understand</button>
  </div>
);

export function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState('home');
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);

  const routine = useMemo(() => buildRoutine(levels[data.level]), [data.level]);
  const current = routine[stepIndex];
  const next = routine[stepIndex + 1];
  const todayDone = data.completions.includes(isoDay());

  useEffect(() => saveData(data), [data]);

  useEffect(() => {
    if (view !== 'timer' || !running || !current) return;
    if (remaining <= 0) {
      if (stepIndex >= routine.length - 1) {
        completeSession();
      } else {
        setStepIndex((v) => v + 1);
        setRemaining(routine[stepIndex + 1].duration);
      }
      return;
    }
    const timer = setTimeout(() => setRemaining((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, running, view, stepIndex, routine, current]);

  const completeSession = () => {
    const today = isoDay();
    setRunning(false);
    setView('complete');
    setData((prev) => {
      if (prev.completions.includes(today)) return prev;
      const completions = [...prev.completions, today].sort();
      const yesterday = isoDay(new Date(Date.now() - 86400000));
      const currentStreak = prev.completions.includes(yesterday) ? prev.currentStreak + 1 : 1;
      return {
        ...prev,
        completions,
        currentStreak,
        bestStreak: Math.max(prev.bestStreak, currentStreak),
        totalSessions: prev.totalSessions + 1,
        lastCompletedAt: new Date().toISOString(),
      };
    });
  };

  const startSession = () => {
    setStepIndex(0);
    setRemaining(routine[0].duration);
    setRunning(true);
    setView('timer');
  };

  if (data.healthAcknowledgedVersion < HEALTH_VERSION) {
    return <HealthWarning onAcknowledge={() => setData((d) => ({ ...d, healthAcknowledgedVersion: HEALTH_VERSION }))} />;
  }

  if (view === 'settings') {
    return <div className="screen card"><h1>Settings</h1><label>Routine level<select value={data.level} onChange={(e)=>setData((d)=>({...d,level:e.target.value}))}>{Object.entries(levels).map(([key,v])=><option value={key} key={key}>{v.name}</option>)}</select></label><label>Reminder time<input type="time" value={data.reminderTime} onChange={(e)=>setData((d)=>({...d, reminderTime:e.target.value}))}/></label><p>iPhone reminders via web notifications may be limited. We save your daily prompt time in-app.</p><button onClick={()=>setData((d)=>({...d, discreetMode:!d.discreetMode}))}>Discreet mode: {data.discreetMode ? 'On' : 'Off'}</button><button onClick={()=>setData(defaultData)}>Reset progress</button><button onClick={()=>setView('home')}>Back</button></div>;
  }

  if (view === 'history') {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.now() - i * 86400000);
      const day = isoDay(date);
      return { day, done: data.completions.includes(day) };
    });
    return <div className="screen card"><h1>History</h1>{days.map((d)=><div key={d.day} className="row"><span>{d.day}</span><strong>{d.done?'Done':'Rest'}</strong></div>)}<p>Total sessions: {data.totalSessions}</p><p>Current streak: {data.currentStreak}</p><p>Best streak: {data.bestStreak}</p><button onClick={()=>setView('home')}>Back</button></div>;
  }

  if (view === 'timer') {
    const total = current?.duration || 1;
    const pct = Math.max(0, Math.round((remaining / total) * 100));
    return <div className="screen card"><h1>{data.discreetMode ? 'Focus timer' : current.label}</h1><div className="circle">{remaining}s<div className="small">{pct}%</div></div><p>Set {current.set} of {levels[data.level].sets}</p><p>Next: {next ? (data.discreetMode ? 'Next phase' : next.label) : 'Session complete'}</p><div className="actions">{running ? <button onClick={()=>setRunning(false)}>Pause</button> : <button onClick={()=>setRunning(true)}>Resume</button>}<button onClick={()=>{setRunning(false);setView('home')}}>End session</button></div></div>;
  }

  if (view === 'complete') {
    return <div className="screen card"><h1>Session complete</h1><p>Well done. You showed up for yourself today.</p><button onClick={()=>setView('home')}>Return home</button></div>;
  }

  return (
    <div className="screen card">
      <h1>Core Timer</h1>
      <p>{todayDone ? 'Today\'s session is complete.' : 'Today\'s session is ready when you are.'}</p>
      <p>Current streak: {data.currentStreak}</p>
      <p>Best streak: {data.bestStreak}</p>
      <button onClick={startSession}>Start today’s routine</button>
      <button onClick={() => setView('history')}>History</button>
      <button onClick={() => setView('settings')}>Settings</button>
      <p className="hint">Move gently, breathe naturally, and stay consistent over perfection.</p>
    </div>
  );
}
