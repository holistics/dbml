class DomainError extends Error {
  constructor (message, rootError = {}) {
    super(message);
    this.name = this.constructor.name;
    this.rootError = rootError;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default DomainError;
