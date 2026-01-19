# DBML Diagnostics Provider

The Diagnostics Provider offers a unified interface to access compilation errors and warnings from DBML source code.

## Features

- **Unified Diagnostics**: Get all errors and warnings in a single call
- **Filtered Access**: Retrieve only errors or only warnings
- **Monaco Integration**: Convert diagnostics to Monaco editor markers
- **Rich Information**: Full position information, severity levels, and error codes

## Usage

### Basic Usage

```typescript
import Compiler from '@dbml/parse';

const compiler = new Compiler();
compiler.setSource(yourDBMLCode);

const services = compiler.initMonacoServices();
const diagnosticsProvider = services.diagnosticsProvider;

// Get all diagnostics (errors + warnings)
const allDiagnostics = diagnosticsProvider.provideDiagnostics();

// Get only errors
const errors = diagnosticsProvider.provideErrors();

// Get only warnings
const warnings = diagnosticsProvider.provideWarnings();

// Get Monaco markers (for editor integration)
const markers = diagnosticsProvider.provideMarkers();
```

### Diagnostic Structure

Each diagnostic contains:

```typescript
interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code?: string | number;
  source?: string;
}
```

### Monaco Marker Structure

For Monaco editor integration:

```typescript
interface MarkerData {
  severity: MarkerSeverity;  // 8 = Error, 4 = Warning
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code?: string | number;
  source?: string;
}
```

## Error vs Warning

### Errors
Errors are critical issues that prevent proper compilation:
- Syntax errors
- Binding errors (undefined references)
- Structural issues

### Warnings
Warnings are validation issues that don't prevent compilation but indicate potential problems:
- Constraint violations (PK, UNIQUE, FK)
- Type compatibility issues
- NOT NULL violations
- Data validation failures

## Example

```typescript
const compiler = new Compiler();

const source = `
  Table users {
    id int [pk]
    email varchar [unique]
  }

  records users(id, email) {
    1, "user1@example.com"
    1, "user2@example.com"  // Duplicate PK warning
    2, "user1@example.com"  // Duplicate UNIQUE warning
  }
`;

compiler.setSource(source);

const { diagnosticsProvider } = compiler.initMonacoServices();
const diagnostics = diagnosticsProvider.provideDiagnostics();

diagnostics.forEach((diag) => {
  console.log(`[${diag.severity}] Line ${diag.startLineNumber}: ${diag.message}`);
});

// Output:
// [warning] Line 9: Duplicate PK: users.id = 1
// [warning] Line 10: Duplicate UNIQUE: users.email = "user1@example.com"
```

## Monaco Editor Integration

```typescript
import * as monaco from 'monaco-editor';

const compiler = new Compiler();
compiler.setSource(yourCode);

const { diagnosticsProvider } = compiler.initMonacoServices();
const markers = diagnosticsProvider.provideMarkers();

// Set markers in Monaco editor
monaco.editor.setModelMarkers(model, 'dbml', markers);
```

## Direct Compiler Access

You can also access errors and warnings directly from the compiler:

```typescript
const compiler = new Compiler();
compiler.setSource(yourCode);

// Direct access
const errors = compiler.parse.errors();
const warnings = compiler.parse.warnings();

console.log(`Found ${errors.length} errors and ${warnings.length} warnings`);
```

## Error Codes

Error codes are defined in `CompileErrorCode` enum and include:

- `1000-1999`: Symbol and token errors
- `3000-3999`: Validation errors (names, settings, etc.)
- `4000-4999`: Binding errors
- `5000-5999`: Semantic errors (circular refs, unsupported operations)

See `src/core/errors.ts` for the complete list.
