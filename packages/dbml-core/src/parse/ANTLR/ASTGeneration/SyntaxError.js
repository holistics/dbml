export default class SyntaxError extends Error {
  constructor (line, column, msg) {
    super(msg);
    // maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SyntaxError);
    }

    // These properies names and structures are needed by other app (for example dbdiagram) to display error.
    this.text = msg;
    this.location = {
      start: {
        line,
        column,
      },
    };
  }
}
