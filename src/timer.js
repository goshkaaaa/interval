export const defaultSettings = {
  focus: 25,
  short: 5,
  long: 15,
  goal: 4,
  sound: false,
};
export const modes = {
  focus: "Deep work",
  short: "Short break",
  long: "Long break",
};
export function remainingSeconds(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function weekDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (6 - index));
    return {
      key: localDate(day),
      label: day.toLocaleDateString("en", { weekday: "short" }),
    };
  });
}
export function validSettings(value) {
  return (
    value &&
    ["focus", "short", "long"].every(
      (key) =>
        Number.isInteger(value[key]) && value[key] >= 1 && value[key] <= 90,
    ) &&
    Number.isInteger(value.goal) &&
    value.goal >= 1 &&
    value.goal <= 16 &&
    typeof value.sound === "boolean"
  );
}
export function restoreState(value, now = Date.now()) {
  if (!value || value.version !== 1 || !validSettings(value.settings))
    return null;
  const tasks = Array.isArray(value.tasks)
    ? value.tasks
        .filter(
          (task) =>
            typeof task?.id === "string" &&
            typeof task.title === "string" &&
            task.title.trim() &&
            task.title.length <= 120 &&
            typeof task.done === "boolean",
        )
        .slice(0, 60)
    : [];
  const history = Array.isArray(value.history)
    ? value.history
        .filter(
          (item) =>
            typeof item?.id === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
            Number.isInteger(item.minutes) &&
            item.minutes >= 1 &&
            item.minutes <= 90,
        )
        .slice(-1000)
    : [];
  const mode = Object.hasOwn(modes, value.mode) ? value.mode : "focus";
  const duration = value.settings[mode] * 60;
  const remaining =
    Number.isFinite(value.remaining) &&
    value.remaining >= 0 &&
    value.remaining <= duration
      ? Math.ceil(value.remaining)
      : duration;
  const deadline =
    Number.isFinite(value.deadline) &&
    value.deadline > now - 7 * 86400000 &&
    value.deadline <= now + duration * 1000
      ? value.deadline
      : null;
  return {
    version: 1,
    settings: value.settings,
    tasks,
    history,
    mode,
    remaining,
    deadline,
    activeTask: tasks.some((task) => task.id === value.activeTask && !task.done)
      ? value.activeTask
      : null,
  };
}
export function finishSession(state, date = new Date()) {
  const history =
    state.mode === "focus"
      ? [
          ...state.history,
          {
            id: crypto.randomUUID(),
            date: localDate(date),
            minutes: state.settings.focus,
          },
        ].slice(-1000)
      : state.history;
  const nextMode =
    state.mode === "focus"
      ? history.filter((item) => item.date === localDate(date)).length % 4 === 0
        ? "long"
        : "short"
      : "focus";
  return {
    ...state,
    history,
    mode: nextMode,
    remaining: state.settings[nextMode] * 60,
    deadline: null,
  };
}
