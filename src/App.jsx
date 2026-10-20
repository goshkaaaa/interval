import { useEffect, useRef, useState } from "react";
import {
  defaultSettings,
  finishSession,
  formatTime,
  localDate,
  modes,
  remainingSeconds,
  restoreState,
  weekDays,
} from "./timer";

const storageKey = "interval:workspace:v1";
const initialState = {
  version: 1,
  settings: defaultSettings,
  mode: "focus",
  remaining: 1500,
  deadline: null,
  history: [],
  tasks: [
    { id: "first", title: "Pick one thing that matters today", done: false },
    { id: "second", title: "Close the tabs you don’t need", done: false },
  ],
  activeTask: "first",
};

function load() {
  try {
    return (
      restoreState(JSON.parse(localStorage.getItem(storageKey))) || initialState
    );
  } catch {
    return initialState;
  }
}

export default function App() {
  const [state, setState] = useState(load);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const audio = useRef(null);
  const taskInput = useRef(null);
  const settingsDialog = useRef(null);
  const running = state.deadline !== null;
  const remaining = running
    ? remainingSeconds(state.deadline, now)
    : state.remaining;
  const today = localDate(new Date(now));
  const sessions = state.history.filter((item) => item.date === today);
  const minutes = sessions.reduce((sum, item) => sum + item.minutes, 0);
  const activeTask = state.tasks.find(
    (task) => task.id === state.activeTask && !task.done,
  );
  const done = state.tasks.filter((task) => task.done).length;
  const days = weekDays(new Date(now));
  const dailyMinutes = days.map((day) =>
    state.history
      .filter((item) => item.date === day.key)
      .reduce((sum, item) => sum + item.minutes, 0),
  );
  const maxMinutes = Math.max(60, ...dailyMinutes);
  const progress = Math.max(
    0,
    Math.min(100, (1 - remaining / (state.settings[state.mode] * 60)) * 100),
  );

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      setMessage(
        "Browser storage is unavailable. Keep this tab open to keep your workspace.",
      );
    }
  }, [state]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 250);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    document.title = running
      ? `${formatTime(remaining)} · ${modes[state.mode]} — Interval`
      : "Interval — Make room for deep work";
  }, [remaining, running, state.mode]);

  useEffect(() => {
    if (!running || remaining > 0) return;
    const finishedMode = state.mode;
    setState((current) =>
      current.deadline === state.deadline
        ? finishSession(current, new Date(current.deadline))
        : current,
    );
    setMessage(
      finishedMode === "focus"
        ? "Session complete. Step away for a moment. Your break is ready."
        : "Break complete. A fresh focus session is ready when you are.",
    );
    if (state.settings.sound && audio.current?.state === "running") {
      const oscillator = audio.current.createOscillator();
      const volume = audio.current.createGain();
      oscillator.frequency.value = 660;
      volume.gain.setValueAtTime(0.12, audio.current.currentTime);
      volume.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.8,
      );
      oscillator.connect(volume);
      volume.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.8);
    }
  }, [remaining, running, state.deadline, state.mode, state.settings.sound]);

  function toggleTimer() {
    if (state.settings.sound && !running) {
      try {
        audio.current ||= new AudioContext();
        audio.current
          .resume()
          .catch(() =>
            setMessage("Sound could not start. The timer will still work."),
          );
      } catch {
        setMessage("Sound is unavailable in this browser.");
      }
    }
    const time = Date.now();
    setNow(time);
    setState((current) =>
      current.deadline
        ? {
            ...current,
            remaining: remainingSeconds(current.deadline, time),
            deadline: null,
          }
        : { ...current, deadline: time + current.remaining * 1000 },
    );
  }

  useEffect(() => {
    function keydown(event) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        settingsOpen ||
        event.target.closest("input,button,select,a,textarea,[contenteditable]")
      )
        return;
      event.preventDefault();
      const time = Date.now();
      setNow(time);
      setState((current) =>
        current.deadline
          ? {
              ...current,
              remaining: remainingSeconds(current.deadline, time),
              deadline: null,
            }
          : { ...current, deadline: time + current.remaining * 1000 },
      );
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsOpen) settingsDialog.current.showModal();
    else settingsDialog.current.close();
  }, [settingsOpen]);

  function changeMode(mode) {
    setState((current) => ({
      ...current,
      mode,
      remaining: current.settings[mode] * 60,
      deadline: null,
    }));
    setMessage("");
  }

  function addTask(event) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title")).trim();
    if (!title || state.tasks.length >= 60) return;
    const id = crypto.randomUUID();
    setState((current) => ({
      ...current,
      tasks: [...current.tasks, { id, title, done: false }],
      activeTask: current.activeTask || id,
    }));
    event.currentTarget.reset();
    taskInput.current.focus();
  }

  function toggleTask(id) {
    setState((current) => {
      const tasks = current.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      );
      return {
        ...current,
        tasks,
        activeTask: tasks.some(
          (task) => task.id === current.activeTask && !task.done,
        )
          ? current.activeTask
          : tasks.find((task) => !task.done)?.id || null,
      };
    });
  }

  function saveSettings(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const settings = {
      focus: Number(form.get("focus")),
      short: Number(form.get("short")),
      long: Number(form.get("long")),
      goal: Number(form.get("goal")),
      sound: form.get("sound") === "on",
    };
    setState((current) => ({
      ...current,
      settings,
      deadline: null,
      remaining: settings[current.mode] * 60,
    }));
    setSettingsOpen(false);
    setMessage("Preferences saved. The timer has been reset.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="logo" href="#main">
          <span className="logo-mark">Ⅱ</span> interval
          <span className="logo-period">.</span>
        </a>
        <div className="sidebar-label">YOUR DAILY PRACTICE</div>
        <a className="sidebar-link selected" href="#main">
          <span>◷</span> Focus room <span>01</span>
        </a>
        <a className="sidebar-link" href="#week">
          <span>▥</span> The bigger picture
        </a>
        <button
          className="sidebar-link"
          aria-label="Preferences"
          onClick={() => setSettingsOpen(true)}
        >
          <span>⚙</span> Preferences
        </button>
        <div className="sidebar-bottom">
          <div className="little-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <p>
            One thing at a time.
            <br />
            That&apos;s enough.
          </p>
          <span>LESS NOISE. MORE INTENTION.</span>
        </div>
        <a className="source-link" href="https://github.com/goshkaaaa/interval">
          Open source ↗
        </a>
      </aside>
      <main id="main">
        <header className="workspace-header">
          <span className="breadcrumb">
            WORKSPACE <span>/</span> FOCUS ROOM
          </span>
          <span className="date">
            {new Date(now).toLocaleDateString("en", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        </header>
        <section className="greeting">
          <div>
            <h1>
              Your next
              <br />
              25 minutes.
            </h1>
          </div>
          <p>
            Choose a task. Start a session.
            <br />
            Give it your full attention.
          </p>
        </section>
        <div className="focus-layout">
          <section className="timer-panel">
            <div className="panel-top">
              <span className="eyebrow">THE FOCUS TIMER</span>
              <span className={`live-dot ${running ? "running" : ""}`}>
                {running ? "IN THE ZONE" : "READY WHEN YOU ARE"}
              </span>
            </div>
            <div className="mode-tabs" role="group" aria-label="Timer mode">
              {Object.entries(modes).map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={state.mode === key}
                  className={state.mode === key ? "active" : ""}
                  onClick={() => changeMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="timer-face"
              role="timer"
              aria-label={`${modes[state.mode]} time remaining`}
            >
              <span>{formatTime(remaining).split(":")[0]}</span>
              <span className="colon">:</span>
              <span>{formatTime(remaining).split(":")[1]}</span>
            </div>
            <p className="timer-caption">
              {state.mode === "focus"
                ? "A little less distraction. A little more progress."
                : "Unclench your jaw. Look away from the screen."}
            </p>
            <div className="timer-controls">
              <button className="start-button" onClick={toggleTimer}>
                {running
                  ? "Ⅱ Pause session"
                  : remaining < state.settings[state.mode] * 60
                    ? "▶ Resume session"
                    : "▶ Start session"}
              </button>
              <button
                className="reset-button"
                aria-label="Reset timer"
                onClick={() => {
                  changeMode(state.mode);
                  setMessage("Timer reset.");
                }}
              >
                ↶
              </button>
            </div>
            <div
              className="session-track"
              aria-label={`${Math.min(sessions.length, state.settings.goal)} of ${state.settings.goal} daily sessions complete`}
            >
              {Array.from({ length: state.settings.goal }, (_, index) => (
                <span
                  className={index < sessions.length ? "filled" : ""}
                  key={index}
                />
              ))}
              <small>
                {sessions.length} / {state.settings.goal} sessions
              </small>
            </div>
            <div
              className="timer-progress"
              style={{ "--progress": `${progress}%` }}
            />
            <div className="currently">
              <span>↳ CURRENTLY FOCUSING ON</span>
              <p>{activeTask?.title || "Choose a task, or simply be here."}</p>
            </div>
          </section>
          <section className="task-panel">
            <div className="panel-top">
              <h2>A short list.</h2>
              <span className="task-count">
                {done}/{state.tasks.length}
              </span>
            </div>
            <p className="panel-description">
              Give your attention somewhere to land.
            </p>
            <form className="task-form" onSubmit={addTask}>
              <input
                ref={taskInput}
                name="title"
                aria-label="New task"
                placeholder="What needs your attention?"
                maxLength={120}
                required
              />
              <button aria-label="Add task" disabled={state.tasks.length >= 60}>
                +
              </button>
            </form>
            <ul className="task-list">
              {state.tasks.map((task) => (
                <li
                  key={task.id}
                  className={`${task.done ? "done" : ""} ${task.id === state.activeTask ? "current" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    aria-label={`Complete ${task.title}`}
                    onChange={() => toggleTask(task.id)}
                  />
                  <button
                    className="task-title"
                    disabled={task.done}
                    aria-pressed={task.id === state.activeTask}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        activeTask: task.id,
                      }))
                    }
                  >
                    {task.title}
                    <span>
                      {task.id === state.activeTask && !task.done
                        ? "IN FOCUS"
                        : ""}
                    </span>
                  </button>
                  <button
                    className="delete-task"
                    aria-label={`Delete ${task.title}`}
                    onClick={() =>
                      setState((current) => {
                        const tasks = current.tasks.filter(
                          (item) => item.id !== task.id,
                        );
                        return {
                          ...current,
                          tasks,
                          activeTask:
                            current.activeTask === task.id
                              ? tasks.find((item) => !item.done)?.id || null
                              : current.activeTask,
                        };
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {!state.tasks.length ? (
              <p className="empty-tasks">
                A clean slate.
                <br />
                Add one thing you&apos;d like to finish.
              </p>
            ) : null}
            <div className="task-bottom">
              <span>{state.tasks.length - done} still to do</span>
              <button
                disabled={!done}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    tasks: current.tasks.filter((task) => !task.done),
                  }))
                }
              >
                Clear completed ↗
              </button>
            </div>
            <div className="task-note">
              <span>✳</span>
              <p>
                Keep it small. Three meaningful tasks
                <br />
                beat a list that never ends.
              </p>
            </div>
          </section>
        </div>
        <section className="stats" id="week">
          <div className="stat-card">
            <p className="eyebrow">FOCUS TIME TODAY</p>
            <div className="stat-value">
              {minutes}
              <span>min</span>
            </div>
            <p>Time well spent, one interval at a time.</p>
            <span className="stat-symbol">↗</span>
          </div>
          <div className="stat-card">
            <p className="eyebrow">SESSIONS COMPLETE</p>
            <div className="stat-value">
              {sessions.length}
              <span>/ {state.settings.goal}</span>
            </div>
            <p>
              {sessions.length >= state.settings.goal
                ? "Your daily goal is in the bag. Nicely done."
                : "A little progress is still progress."}
            </p>
            <div className="goal-meter">
              <span
                style={{
                  width: `${Math.min(100, (sessions.length / state.settings.goal) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="week-card">
            <div>
              <p className="eyebrow">YOUR LAST SEVEN DAYS</p>
              <span>
                {dailyMinutes.reduce((sum, value) => sum + value, 0)} min total
              </span>
            </div>
            <div
              className="chart"
              role="img"
              aria-label={days
                .map(
                  (day, index) =>
                    `${day.label}: ${dailyMinutes[index]} minutes`,
                )
                .join(", ")}
            >
              {days.map((day, index) => (
                <div className="bar-column" key={day.key}>
                  <div className="bar-track">
                    <span
                      className={day.key === today ? "today" : ""}
                      style={{
                        height: `${Math.max(3, (dailyMinutes[index] / maxMinutes) * 100)}%`,
                      }}
                      title={`${dailyMinutes[index]} minutes`}
                    />
                  </div>
                  <span>{day.label.slice(0, 1)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <p role="status" className="status">
          {message}
        </p>
        <footer>
          <span>BUILT FOR A CALMER KIND OF PRODUCTIVE.</span>
          <span>
            Your workspace stays on this device. <kbd>space</kbd> to play /
            pause
          </span>
        </footer>
      </main>
      <dialog
        ref={settingsDialog}
        onCancel={() => setSettingsOpen(false)}
        onClose={() => setSettingsOpen(false)}
        aria-labelledby="settings-title"
      >
        <form onSubmit={saveSettings}>
          <div className="dialog-heading">
            <h2 id="settings-title">Find your rhythm.</h2>
            <button
              type="button"
              aria-label="Close preferences"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
          </div>
          <p>
            Choose your session lengths in minutes.
            <br />
            Saving preferences resets the current timer.
          </p>
          {settingsOpen ? (
            <>
              <div className="settings-fields">
                {Object.entries(modes).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      name={key}
                      min="1"
                      max="90"
                      step="1"
                      defaultValue={state.settings[key]}
                      required
                    />
                  </label>
                ))}
                <label>
                  Daily session goal
                  <input
                    type="number"
                    name="goal"
                    min="1"
                    max="16"
                    step="1"
                    defaultValue={state.settings.goal}
                    required
                  />
                </label>
              </div>
              <label className="sound-setting">
                <input
                  type="checkbox"
                  name="sound"
                  defaultChecked={state.settings.sound}
                />{" "}
                Play a gentle sound when a session ends
              </label>
            </>
          ) : null}
          <button className="start-button" type="submit">
            Save preferences ↗
          </button>
        </form>
      </dialog>
    </div>
  );
}
