import getenv from './getenv';
import * as util from 'util';

const LOG_LEVEL = getenv('LOG_LEVEL', false, 'INFO');
const SHOW_ERROR = LOG_LEVEL !== 'NONE';
const SHOW_WARN = SHOW_ERROR && LOG_LEVEL !== 'ERROR';
const SHOW_INFO = SHOW_WARN && LOG_LEVEL !== 'WARN';

export interface ILogger {
  error: (message: {} | string) => void;
  warn: (message: {} | string) => void;
  info: (message: {} | string) => void;
};

const expandObject = (message: {} | string) => {
  if (typeof message === 'object') {
    return util.inspect(message, false, null, false);
  }

  return message;
}

const error = (message: {} | string) => {
  if (SHOW_ERROR) {
    message = expandObject(message);
    console.log(`ERROR [${ new Date().toISOString() }]: ${message}`);
  }
}

const warn = (message: {} | string) => {
  if (SHOW_WARN) {
    message = expandObject(message);
    console.log(`WARNING [${ new Date().toISOString() }]: ${message}`);
  }
}

const info = (message: {} | string) => {
  if (SHOW_INFO) {
    message = expandObject(message);
    console.log(`INFO [${ new Date().toISOString() }]: ${message}`);
  }
}

const log: ILogger = {
  error: error,
  warn: warn,
  info: info,
}

export default log;