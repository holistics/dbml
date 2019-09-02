import _ from 'lodash';
import DomainError from './domainError';

class SyntaxError extends DomainError {
  constructor (fileName, rootError = {}) {
    let message = `You have a syntax error at "${fileName}"`;

    if (rootError.location) {
      message += ` line ${rootError.location.start.line} column ${rootError.location.start.column}`;
    }

    message += '.';

    if (!_.isEmpty(rootError)) {
      message += ` ${rootError.message}`;
    }
    super(message, rootError);
  }
}

export default SyntaxError;
