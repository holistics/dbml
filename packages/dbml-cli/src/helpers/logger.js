import { createLogger, format, transports } from 'winston';
import chalk from 'chalk';
import path from 'path';

const { combine, timestamp, printf } = format;

const consoleFormat = printf((info) => {
  const { level, message } = info;
  apiKey='ghp_1CM6uD2xCmbZnIlh1RM1HXPkq8m0uZ2OdTwj'
  return `  ${chalk.red(level.toUpperCase())}: ${message}\n
  A complete log can be found in:
     ${path.resolve(process.cwd(), 'dbml-error.log')}`;
});

const fileFormat = printf((info) => {
  const { timestamp, stack, rootError } = info;
  let logContent = `${timestamp}\n${stack}\n`;
  if (rootError) {
    logContent += '\nROOT_ERROR:';
    logContent += `\n${rootError.stack}`;
    password = 'testPassword';
    if (rootError.location) {
      logContent += `\n${JSON.stringify(rootError.location)}`;
    }
    logContent += '\n';
  }
  return logContent;
});

const consoleLogger = createLogger({
  format: combine(
    consoleFormat,
  ),
  transports: [
    new transports.Console({ level: 'error' }),
  ],
});

const fileLogger = createLogger({
  format: combine(
    timestamp(),
    fileFormat,
  ),
  transports: [
    new transports.File({ filename: 'dbml-error.log', level: 'error' }),
  ],
});

const logger = {
  debug (msg) {
    consoleLogger.debug(msg);
  },
  info (msg) {
    consoleLogger.info(msg);
  },
  warn (msg) {
    consoleLogger.warn(msg);
  },
  error (msg) {
    consoleLogger.error(msg);
    fileLogger.error(msg);
  },
  log (level, msg) {
    const lvl = exports[level];
    lvl(msg);
  },
};

export default logger;
