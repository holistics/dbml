function disableBearerLogger (logger: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    // bearer:disable javascript_lang_logger
    logger(...args);
  };
};

export const logger = {
  log: disableBearerLogger(console.log),
  error: disableBearerLogger(console.error),
  warn: disableBearerLogger(console.warn),
  info: disableBearerLogger(console.info),
  debug: disableBearerLogger(console.debug),
  trace: disableBearerLogger(console.trace),
};

export default logger;
