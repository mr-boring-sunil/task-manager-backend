/**
 * Internal Engine Logger
 * Handles logging within an engine boundary (e.g. [CEE], [SE], [DSE]).
 * Raspberry Pi Task Manager — Unified Backend
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevelWeight = LOG_LEVELS[currentLevel] !== undefined ? LOG_LEVELS[currentLevel] : LOG_LEVELS.info;

const shouldLog = (level) => {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_LOGS) {
    return false;
  }
  return LOG_LEVELS[level] >= currentLevelWeight;
};

const formatMessage = (engine, level, message, meta = null) => {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${engine}] [${level.toUpperCase()}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    // Sanitize any potential secret keys
    const sanitized = { ...meta };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    line += ` | ${JSON.stringify(sanitized)}`;
  }
  return line;
};

const createEngineLogger = (engineName) => {
  return {
    debug(message, meta) {
      if (shouldLog('debug')) {
        console.debug(formatMessage(engineName, 'debug', message, meta));
      }
    },
    info(message, meta) {
      if (shouldLog('info')) {
        console.info(formatMessage(engineName, 'info', message, meta));
      }
    },
    warn(message, meta) {
      if (shouldLog('warn')) {
        console.warn(formatMessage(engineName, 'warn', message, meta));
      }
    },
    error(message, errorOrMeta) {
      if (shouldLog('error')) {
        const meta = errorOrMeta instanceof Error ? { message: errorOrMeta.message, code: errorOrMeta.code } : errorOrMeta;
        console.error(formatMessage(engineName, 'error', message, meta));
      }
    },
  };
};

module.exports = {
  createEngineLogger,
  ceeLogger: createEngineLogger('CEE'),
  seLogger: createEngineLogger('SE'),
  dseLogger: createEngineLogger('DSE'),
};
