import path from 'path';
import chalk from 'chalk';
import {
  createLogger, format, transports,
} from 'winston';

const {
  combine, timestamp, printf,
} = format;

const consoleFormat = printf((info) => {
  const {
    level, message,
  } = info;
  return `  ${chalk.red(level.toUpperCase())}: ${message}\n
  A complete log can be found in:
     ${path.resolve(process.cwd(), 'dbml-error.log')}`;
});

const fileFormat = printf((info) => {
  const {
    timestamp: ts, message, stack, rootError,
  } = info as any;
  let logContent = `${ts}\n${stack ?? message ?? ''}\n`;
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

export const consoleLogger = createLogger({
  format: combine(
    consoleFormat,
  ),
  transports: [
    new transports.Console({
      level: 'error',
    }),
  ],
});

export const fileLogger = createLogger({
  format: combine(
    timestamp(),
    format.uncolorize(),
    fileFormat,
  ),
  transports: [
    new transports.File({
      filename: 'dbml-error.log',
      level: 'error',
    }),
  ],
});
