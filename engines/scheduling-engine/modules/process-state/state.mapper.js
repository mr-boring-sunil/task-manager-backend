/**
 * Process State Mapper
 * Maps Linux process states to standard unified state names.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const { PROCESS_STATES } = require('../../../../config/server.config');

const mapProcessState = (rawState) => {
  if (!rawState || rawState === '') return PROCESS_STATES.UNKNOWN;
  const s = rawState.toLowerCase().trim();

  // Running: R (running/runnable on run queue)
  if (s === 'r' || s === 'running') return PROCESS_STATES.RUNNING;

  // Sleeping: S (interruptible sleep), D (uninterruptible sleep / disk wait), W (paging)
  if (s === 's' || s === 'd' || s === 'w' || s === 'sleeping') return PROCESS_STATES.SLEEPING;

  // Stopped: T (stopped by signal), t (stopped by debugger), P (parked)
  if (s === 't' || s === 'p' || s === 'stopped' || s === 'paused') return PROCESS_STATES.STOPPED;

  // Zombie: Z (zombie)
  if (s === 'z' || s === 'zombie') return PROCESS_STATES.ZOMBIE;

  // Idle: I (idle kernel thread), X (dead - treat as idle/terminated)
  if (s === 'i' || s === 'x' || s === 'idle') return PROCESS_STATES.IDLE;

  return PROCESS_STATES.UNKNOWN;
};

module.exports = {
  mapProcessState,
};
