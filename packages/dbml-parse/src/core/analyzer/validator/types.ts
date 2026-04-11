import { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type Compiler from '@/compiler';

export interface ElementValidator {
  validate(): void;
}
