import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSettings,
  finishSession,
  formatTime,
  localDate,
  remainingSeconds,
  restoreState,
  weekDays,
} from "../src/timer.js";
const state = {
  version: 1,
  settings: defaultSettings,
  mode: "focus",
  remaining: 1500,
  deadline: null,
  history: [],
  tasks: [],
  activeTask: null,
};

test("timer uses a deadline and rounds up the last partial second", () => {
  assert.equal(remainingSeconds(10000, 8500), 2);
  assert.equal(remainingSeconds(10000, 10000), 0);
  assert.equal(remainingSeconds(10000, 12000), 0);
});
test("clock format is padded", () => {
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(0), "00:00");
});
test("focus completion records one session and prepares a paused break", () => {
  const next = finishSession(state, new Date(2026, 9, 20, 12));
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].minutes, 25);
  assert.equal(next.mode, "short");
  assert.equal(next.remaining, 300);
  assert.equal(next.deadline, null);
});
test("every fourth focus session prepares a long break", () => {
  const date = new Date(2026, 9, 20, 12);
  const history = Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    date: localDate(date),
    minutes: 25,
  }));
  assert.equal(finishSession({ ...state, history }, date).mode, "long");
});
test("breaks do not increase focus statistics", () => {
  const next = finishSession({ ...state, mode: "short" });
  assert.equal(next.history.length, 0);
  assert.equal(next.mode, "focus");
});
test("restore rejects settings outside allowed bounds", () => {
  assert.equal(
    restoreState({ ...state, settings: { ...defaultSettings, focus: -2 } }),
    null,
  );
  assert.equal(
    restoreState({ ...state, settings: { ...defaultSettings, focus: 1.5 } }),
    null,
  );
});
test("restore drops malformed tasks and impossible deadlines", () => {
  const next = restoreState({
    ...state,
    tasks: [{ id: "1", title: " ", done: false }],
    deadline: Date.now() + 1e9,
  });
  assert.deepEqual(next.tasks, []);
  assert.equal(next.deadline, null);
});
test("week uses calendar dates across month boundaries", () => {
  const days = weekDays(new Date(2026, 2, 2, 12));
  assert.equal(days[0].key, "2026-02-24");
  assert.equal(days[6].key, "2026-03-02");
});
