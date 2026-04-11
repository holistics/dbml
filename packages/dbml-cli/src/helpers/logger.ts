import { createLogger, format, transports } from 'winston';
import chalk from 'chalk';
import path from 'path';

const { combine, timestamp, printf } = format;

const consoleFormat = printf((info) => {
  const { level, message } = info;
  return `  ${chalk.red(level.toUpperCase())}: ${message}\n
  A complete log can be found in:
     ${path.resolve(process.cwd(), 'dbml-error.log')}`;
});

const fileFormat = printf((info) => {
  const { timestamp: ts, stack, rootError } = info as unknown as { timestamp: string; stack?: string; rootError?: { stack?: string; location?: unknown } };
  let logContent = `${ts}\n${stack}\n`;
  if (rootError) {
    logContent += '\nROOT_ERROR:';
    logContent += `\n${rootError.stack}`;
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
  debug (msg: string) {
    consoleLogger.debug(msg);
  },
  info (msg: string) {
    consoleLogger.info(msg);
  },
  warn (msg: string) {
    consoleLogger.warn(msg);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error (msg: any) {
    consoleLogger.error(msg);
    fileLogger.error(msg);
  },
};

export default logger;
