import { EnumSymbol } from '@/core/analyzer/symbol/symbols';
import { ElementDeclarationNode, SyntaxNodeKind } from '@/index';
import { analyze } from '@tests/utils';
import { describe, expect, test } from 'vitest';

describe('[example] binder - check with enum', () => {
  test('should bind simple enums in inline checks', () => {
    const source = `
Enum status { active }
Table users { id varchar [check: status] }
`;
    const result = analyze(source);

    const errors = result.getErrors();
    expect(errors).toHaveLength(0);

    const elements = result.getValue().body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
    const enumNode = elements[0];
    const enumSymbol = enumNode.symbol as EnumSymbol;

    expect(enumSymbol).toBeInstanceOf(EnumSymbol);

    expect(enumSymbol.references).toHaveLength(1);
    const enumRef = enumSymbol.references[0];
    expect(source.slice(enumRef.start, enumRef.end)).toBe('status');

    expect(enumRef.referee).toBe(enumSymbol);
  });
  test('should allow schema-qualified enums in inline checks', () => {
    const source = `
 Enum schema.status { active }
 Table users { id varchar [check: schema.status] }
`;
    const result = analyze(source);

    const errors = result.getErrors();
    expect(errors).toHaveLength(0);

    const elements = result.getValue().body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
    const enumNode = elements[0];
    const enumSymbol = enumNode.symbol as EnumSymbol;

    expect(enumSymbol).toBeInstanceOf(EnumSymbol);

    expect(enumSymbol.references).toHaveLength(1);
    const enumRef = enumSymbol.references[0];
    expect(source.slice(enumRef.start, enumRef.end)).toBe('status');

    expect(enumRef.referee).toBe(enumSymbol);
  });
});
