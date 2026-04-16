// Minimal stub for monaco-editor-core used during testing.
// Only the shapes that the service layer actually reads at runtime are included.

export const Uri = {
  parse: (value: string) => ({ toString: () => value, authority: '', path: value, query: '', fragment: '', scheme: 'file' }),
  file: (path: string) => ({ toString: () => `file://${path}`, authority: '', path, query: '', fragment: '', scheme: 'file' }),
};

export const editor = {
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
};

export const languages = {};

export const CancellationToken = {};
export const IDisposable = {};
export const IPosition = {};
export const IRange = {};
export const MarkerSeverity = { Error: 8, Warning: 4, Info: 2, Hint: 1 };
