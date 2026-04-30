import {
  ProgramNode, SyntaxNode,
} from '@dbml/parse';
import {
  serialize,
} from './index';
import type {
  Serializable, SerializedNode, SerializedValue, SerializeOpts,
} from './types';
import {
  getReadableId, minStart,
} from './utils';

export function serializeNode (node: SyntaxNode, {
  simple = false,
}: SerializeOpts = {}): SerializedNode {
  const id = getReadableId(node);
  if (simple) return {
    id,
  };

  const {
    id: _id,
    parent: _p,
    parentNode: _pn,
    kind: _k,
    startPos: _sp,
    endPos: _ep,
    start: _s,
    end: _e,
    filepath: _fp,
    fullStart,
    fullEnd,
    ...props
  } = node as SyntaxNode & Record<string, unknown>;
  // ProgramNode carries the full source text  -- redundant in the rendered tree.
  if (node instanceof ProgramNode) delete (props as any).source;

  const entries = Object.entries(props).sort(([, a], [, b]) => minStart(a) - minStart(b));
  const children: Record<string, SerializedValue> = {};
  for (const [k, v] of entries) children[k] = serialize(v as Serializable);

  const out: SerializedNode = {
    id,
  };
  if (typeof fullStart === 'number') out.fullStart = fullStart;
  if (typeof fullEnd === 'number') out.fullEnd = fullEnd;
  if (Object.keys(children).length > 0) out.children = children;
  return out;
}
