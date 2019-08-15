import { createLogger, format, transports } from 'winston';
import chalk from 'chalk';
import path from 'path';

const { combine, timestamp, printf } = format;

const consoleFormat = printf((info) => {
  const { level, message } = info;
  return `  ${chalk.bgRed.bold(level.toUpperCase())}: ${message}\n
  A complete log can be found in:
     ${path.resolve(process.cwd(), 'dbml-error.log')}`;
});

const fileFormat = printf((info) => {
  const { timestamp, stack, rootError } = info;
  return `${timestamp} ${stack}\n${rootError ? `\n${rootError}\n` : ''}`;
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
