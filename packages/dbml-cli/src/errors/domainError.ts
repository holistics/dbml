class DomainError extends Error {
  rootError: unknown;

  constructor (message: string, rootError: unknown = {}) {
    super(message);
    this.name = this.constructor.name;
    this.rootError = rootError;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default DomainError;
