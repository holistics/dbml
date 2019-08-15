import _ from 'lodash';

class DomainError extends Error {
  constructor (message, rootError = {}) {
    super(message);
    this.name = this.constructor.name;
    this.rootError = rootError;
    Error.captureStackTrace(this, this.constructor);
  }
}

class SyntaxError extends DomainError {
  constructor (fileName, rootError = {}) {
    let message = `You have a syntax error at ${fileName}.`;
    if (!_.isEmpty(rootError)) {
      message += ` ${rootError.message}`;
    }
    super(message, rootError);
  }
}

export {
  DomainError,
  SyntaxError,
};
