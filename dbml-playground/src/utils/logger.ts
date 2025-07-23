const disableBearerLog = (logFunction: any) => (...args: any[]) => {
  // bearer:disable javascript_lang_logger
  logFunction(...args);
};

export const consoleLogger = {
  log: disableBearerLog(console.log),
  error: disableBearerLog(console.error),
  warn: disableBearerLog(console.warn),
  info: disableBearerLog(console.info),
  debug: disableBearerLog(console.debug),
  trace: disableBearerLog(console.trace),
};

export default consoleLogger;
