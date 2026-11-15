/**
 * Process State Mapper
 * Maps Linux process states to standard unified state names.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const { PROCESS_STATES } = require('../../../../config/server.config');

const mapProcessState = (rawState) => {
  if (!rawState) return PROCESS_STATES.UNKNOWN;
  const s = rawState.toLowerCase();
  if (s.startsWith('r') || s === 'running') return PROCESS_STATES.RUNNING;
  if (s.startsWith('s') || s === 'sleeping') return PROCESS_STATES.SLEEPING;
  if (s.startsWith('t') || s === 'stopped' || s === 'paused') return PROCESS_STATES.STOPPED;
  if (s.startsWith('z') || s === 'zombie') return PROCESS_STATES.ZOMBIE;
  if (s.startsWith('i') || s === 'idle') return PROCESS_STATES.IDLE;
  return PROCESS_STATES.UNKNOWN;
};

module.exports = {
  mapProcessState,
};
