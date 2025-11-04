export class CompilerError {
  /**
   * @param {import("../../types").CompilerDiagnostic[]} diags
   */
  constructor (diags) {
    this.diags = diags;
  }

  static create (nestedDiags) {
     
    return new CompilerError(flattenDiag(nestedDiags));
  }

  map (callback) {
    return CompilerError.create(this.diags.map(callback));
  }
}

function flattenDiag (diag) {
  if (Array.isArray(diag)) return diag.flatMap(flattenDiag);
  if (diag instanceof CompilerError) return diag.diags;
  return [diag];
}
