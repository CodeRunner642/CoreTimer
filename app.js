(() => {
  const KEY = 'coreTimerState.v1';
  const display = document.getElementById('display');
  const minutesInput = document.getElementById('minutes');
  const startBtn = document.getElementById('start');
  const pauseBtn = document.getElementById('pause');
  const resumeBtn = document.getElementById('resume');
  const resetBtn = document.getElementById('reset');
  const installHint = document.getElementById('installHint');

  let timerId = null;
  let state = { mode: 'idle', durationMs: 25 * 60_000, remainingMs: 25 * 60_000, endTime: null };

  const safeStorage = {
    read() {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
    },
    write(next) {
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    }
  };

  function format(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(total / 60).toString().padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  function render() {
    const shown = state.mode === 'running' && state.endTime ? state.endTime - Date.now() : state.remainingMs;
    display.textContent = format(shown);
    startBtn.disabled = state.mode === 'running';
    pauseBtn.disabled = state.mode !== 'running';
    resumeBtn.disabled = state.mode !== 'paused';
    minutesInput.disabled = state.mode !== 'idle';
  }

  function tick() {
    if (state.mode !== 'running' || !state.endTime) return;
    const left = state.endTime - Date.now();
    if (left <= 0) {
      clearInterval(timerId);
      timerId = null;
      state = { ...state, mode: 'idle', remainingMs: state.durationMs, endTime: null };
      safeStorage.write(state);
      render();
      return;
    }
    render();
  }

  function startTicking() {
    clearInterval(timerId);
    timerId = setInterval(tick, 250);
  }

  startBtn.addEventListener('click', () => {
    const min = Number(minutesInput.value);
    const durationMs = Number.isFinite(min) ? Math.min(180, Math.max(1, min)) * 60_000 : 25 * 60_000;
    state = { mode: 'running', durationMs, remainingMs: durationMs, endTime: Date.now() + durationMs };
    safeStorage.write(state);
    startTicking();
    render();
  });

  pauseBtn.addEventListener('click', () => {
    if (state.mode !== 'running' || !state.endTime) return;
    state = { ...state, mode: 'paused', remainingMs: Math.max(0, state.endTime - Date.now()), endTime: null };
    clearInterval(timerId);
    safeStorage.write(state);
    render();
  });

  resumeBtn.addEventListener('click', () => {
    if (state.mode !== 'paused') return;
    state = { ...state, mode: 'running', endTime: Date.now() + state.remainingMs };
    safeStorage.write(state);
    startTicking();
    render();
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(timerId);
    const durationMs = Math.min(180, Math.max(1, Number(minutesInput.value) || 25)) * 60_000;
    state = { mode: 'idle', durationMs, remainingMs: durationMs, endTime: null };
    safeStorage.write(state);
    render();
  });

  function restore() {
    const saved = safeStorage.read();
    if (!saved || !saved.mode) return;
    state = { ...state, ...saved };
    if (state.mode === 'running' && state.endTime) {
      const left = state.endTime - Date.now();
      if (left <= 0) {
        state = { ...state, mode: 'idle', remainingMs: state.durationMs, endTime: null };
      } else {
        state.remainingMs = left;
        startTicking();
      }
    }
    minutesInput.value = String(Math.max(1, Math.round(state.durationMs / 60_000)));
  }

  function setupPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) {
      installHint.textContent = 'Running as installed app.';
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      installHint.textContent = 'On iPhone/iPad Safari: Share → Add to Home Screen.';
    } else {
      installHint.textContent = 'Install from your browser menu for app-like use.';
    }
  }

  restore();
  setupPWA();
  render();
})();
