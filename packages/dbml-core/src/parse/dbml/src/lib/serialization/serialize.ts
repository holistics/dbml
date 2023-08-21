import { CompileError } from '../errors';
import { ProgramNode } from '../parser/nodes';
import Report from '../report';

export function serialize(report: Report<ProgramNode, CompileError>): string {
  return JSON.stringify(
    report,
    (key, value) => {
      if (['parentElement', 'declaration', 'references'].includes(key)) {
        return undefined;
      }
      if (value instanceof Map) {
        return {
          dataType: 'Map',
          value: Array.from(value.entries()),
        };
      }

      return value;
    },
    2,
  );
}
