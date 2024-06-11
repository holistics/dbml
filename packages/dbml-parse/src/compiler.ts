import { findLastIndex, last } from 'lodash';
import { SymbolKind, destructureIndex } from './lib/analyzer/symbol/symbolIndex';
import { generatePossibleIndexes } from './lib/analyzer/symbol/utils';
import SymbolTable from './lib/analyzer/symbol/symbolTable';
import { isOffsetWithinSpan } from './lib/utils';
import { CompileError } from './lib/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrefixExpressionNode,
  ProgramNode,
  SyntaxNode,
  SyntaxNodeIdGenerator,
  TupleExpressionNode,
} from './lib/parser/nodes';
import { NodeSymbol, NodeSymbolIdGenerator } from './lib/analyzer/symbol/symbols';
import Report from './lib/report';
import Lexer from './lib/lexer/lexer';
import Parser from './lib/parser/parser';
import Analyzer from './lib/analyzer/analyzer';
import Interpreter from './lib/interpreter/interpreter';
import { SyntaxToken, SyntaxTokenKind } from './lib/lexer/tokens';
import { getMemberChain, isInvalidToken } from './lib/parser/utils';
import { Database } from './lib/interpreter/types';
import { DBMLCompletionItemProvider, DBMLDefinitionProvider, DBMLReferencesProvider } from './services/index';

const enum Query {
  _Interpret,
  Parse_Ast,
  Parse_Errors,
  Parse_RawDb,
  Parse_Tokens,
  Parse_PublicSymbolTable,
  Token_InvalidStream,
  Token_FlatStream,
  Symbol_OfName,
  Symbol_Members,
  Container_Stack,
  Container_Token,
  Container_Element,
  Container_Context,
  Container_Scope,
  Container_Scope_Kind,
  /* Not correspond to a query - all meaningful queries should be placed above this */
  TOTAL_QUERY_COUNT,
}

type Cache = Map<any, any> | any;

export const enum ScopeKind {
  TABLE,
  ENUM,
  TABLEGROUP,
  INDEXES,
  NOTE,
  REF,
  PROJECT,
  CUSTOM,
  TOPLEVEL,
}

export default class Compiler {
  private source = '';
  private cache: Cache[] = new Array(Query.TOTAL_QUERY_COUNT).fill(null);

  private nodeIdGenerator = new SyntaxNodeIdGenerator();
  private symbolIdGenerator = new NodeSymbolIdGenerator();

  private createQuery<V>(kind: Query, queryCallback: () => V): () => V;
  private createQuery<V, U, K>(
    kind: Query,
    queryCallback: (arg: U) => V,
    toKey?: (arg: U) => K,
  ): (arg: U) => V;
  private createQuery<V, U, K>(
    kind: Query,
    queryCallback: (arg: U | undefined) => V,
    toKey?: (arg: U) => K,
  ): (arg: U | undefined) => V {
    return (arg: U | undefined): V => {
      const cacheEntry = this.cache[kind];
      const key = arg && toKey ? toKey(arg) : arg;
      if (cacheEntry !== null) {
        if (!(cacheEntry instanceof Map)) {
          return cacheEntry;
        }

        if (cacheEntry.has(key)) {
          return cacheEntry.get(key);
        }
      }

      const res = queryCallback(arg);

      if (arg !== undefined) {
        if (cacheEntry instanceof Map) {
          cacheEntry.set(key, res);
        } else {
          this.cache[kind] = new Map();
          this.cache[kind].set(key, res);
        }
      } else {
        this.cache[kind] = res;
      }

      return res;
    };
  }

  setSource(source: string) {
    this.source = source;
    this.cache = new Array(Query.TOTAL_QUERY_COUNT).fill(null);
    this.nodeIdGenerator.reset();
    this.symbolIdGenerator.reset();
  }

  // A namespace for token-related queries
  readonly token = {
    invalidStream: this.createQuery(Query.Token_InvalidStream, (): readonly SyntaxToken[] =>
      this.parse.tokens().filter(isInvalidToken),
    ),
    // Valid + Invalid tokens (which are guarenteed to be non-trivials) are included in the stream
    flatStream: this.createQuery(Query.Token_FlatStream, (): readonly SyntaxToken[] =>
      this.parse
        .tokens()
        .flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid]),
    ),
  };

  // A namespace for parsing-related utility
  readonly parse = {
    source: () => this.source as Readonly<string>,
    _: this.createQuery(
      Query._Interpret,
      (): Report<
        Readonly<{ ast: ProgramNode; tokens: SyntaxToken[]; rawDb?: Database }>,
        CompileError
      > => {
        const parseRes = new Lexer(this.source)
          .lex()
          .chain((tokens) => {
            const parser = new Parser(tokens as SyntaxToken[], this.nodeIdGenerator);

            return parser.parse();
          })
          .chain(({ ast, tokens }) => {
            const analyzer = new Analyzer(ast, this.symbolIdGenerator);

            return analyzer.analyze().map(() => ({ ast, tokens }));
          });
        if (parseRes.getErrors().length > 0) {
          return parseRes;
        }

        return parseRes.chain(({ ast, tokens }) => {
          const interpreter = new Interpreter(ast);

          return interpreter
            .interpret()
            .map((interpretedRes) => ({ ast, tokens, rawDb: interpretedRes }));
        });
      },
    ),
    ast: this.createQuery(
      Query.Parse_Ast,
      (): Readonly<ProgramNode> => this.parse._().getValue().ast,
    ),
    errors: this.createQuery(Query.Parse_Errors, (): readonly Readonly<CompileError>[] => {
      return this.parse._().getErrors();
    }),
    tokens: this.createQuery(
      Query.Parse_Tokens,
      (): Readonly<SyntaxToken>[] => this.parse._().getValue().tokens,
    ),
    rawDb: this.createQuery(
      Query.Parse_RawDb,
      (): Readonly<Database> | undefined => this.parse._().getValue().rawDb,
    ),
    publicSymbolTable: this.createQuery(
      Query.Parse_PublicSymbolTable,
      (): Readonly<SymbolTable> => this.parse._().getValue().ast.symbol!.symbolTable!,
    ),
  };

  readonly container = {
    stack: this.createQuery(
      Query.Container_Stack,
      (offset: number): readonly Readonly<SyntaxNode>[] => {
        const tokens = this.token.flatStream();
        const { index: startIndex, token } = this.container.token(offset);
        const validIndex = startIndex === undefined ? -1 : findLastIndex(tokens, (token) => !token.isInvalid, startIndex);
        if (validIndex === -1) {
          return [this.parse.ast()];
        }

        const searchOffset = tokens[validIndex].start;

        let curNode: Readonly<SyntaxNode> = this.parse.ast();
        const res: SyntaxNode[] = [curNode];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const memberChain = getMemberChain(curNode);
          const foundMem = memberChain.find((mem) => isOffsetWithinSpan(searchOffset, mem));
          if (foundMem === undefined || foundMem instanceof SyntaxToken) {
            break;
          }
          res.push(foundMem);
          curNode = foundMem;
        }

        if (token?.kind === SyntaxTokenKind.COLON) {
          return res;
        }

        while (res.length > 0) {
          let popOnce = false;
          const lastContainer = last(res)!;

          if (lastContainer instanceof FunctionApplicationNode) {
            const source = this.parse.source();
            for (let i = lastContainer.end; i < offset; i += 1) {
              if (source[i] === '\n') {
                res.pop();
                popOnce = true;
              }
            }
          } else if (
            lastContainer instanceof PrefixExpressionNode ||
            lastContainer instanceof InfixExpressionNode
          ) {
            if (this.container.token(offset).token !== lastContainer.op) {
              res.pop();
              popOnce = true;
            }
          } else if (lastContainer instanceof ListExpressionNode) {
            if (lastContainer.listCloseBracket && lastContainer.end <= offset) {
              res.pop();
              popOnce = true;
            }
          } else if (lastContainer instanceof TupleExpressionNode) {
            if (lastContainer.tupleCloseParen && lastContainer.end <= offset) {
              res.pop();
              popOnce = true;
            }
          } else if (lastContainer instanceof BlockExpressionNode) {
            if (lastContainer.blockCloseBrace && lastContainer.end <= offset) {
              res.pop();
              popOnce = true;
            }
          } else if (!(lastContainer instanceof IdentiferStreamNode)) {
            if (lastContainer.end < offset) {
              res.pop();
              popOnce = true;
            }
          }

          if (popOnce) {
            const maybeElement = last(res);
            if (maybeElement instanceof ElementDeclarationNode && maybeElement.end <= offset) {
              res.pop();
            }
          }
          if (!popOnce) {
            break;
          }
        }

        return res;
      },
    ),

    token: this.createQuery(
      Query.Container_Token,
      (
        offset: number,
      ): { token: SyntaxToken; index: number } | { token: undefined; index: undefined } => {
        const id = this.token.flatStream().findIndex((token) => token.start >= offset);
        if (id === undefined) {
          return { token: undefined, index: undefined };
        }

        if (id <= 0) {
          return { token: undefined, index: undefined };
        }

        return {
          token: this.token.flatStream()[id - 1],
          index: id - 1,
        };
      },
    ),

    element: this.createQuery(
      Query.Container_Element,
      (offset: number): Readonly<ElementDeclarationNode | ProgramNode> => {
        const containers = this.container.stack(offset);
        for (let i = containers.length - 1; i >= 0; i -= 1) {
          if (containers[i] instanceof ElementDeclarationNode) {
            return containers[i];
          }
        }

        return this.parse.ast();
      },
    ),

    scope: this.createQuery(
      Query.Container_Scope,
      (offset: number): Readonly<SymbolTable> | undefined =>
        this.container.element(offset)?.symbol?.symbolTable,
    ),

    scopeKind: this.createQuery(Query.Container_Scope_Kind, (offset: number): ScopeKind => {
      const element = this.container.element(offset);
      if (element instanceof ProgramNode) {
        return ScopeKind.TOPLEVEL;
      }

      switch (
        (this.container.element(offset) as ElementDeclarationNode).type?.value.toLowerCase()
      ) {
        case 'table':
          return ScopeKind.TABLE;
        case 'enum':
          return ScopeKind.ENUM;
        case 'ref':
          return ScopeKind.REF;
        case 'tablegroup':
          return ScopeKind.TABLEGROUP;
        case 'indexes':
          return ScopeKind.INDEXES;
        case 'note':
          return ScopeKind.NOTE;
        case 'project':
          return ScopeKind.PROJECT;
        default:
          return ScopeKind.CUSTOM;
      }
    }),
  };

  // A namespace for symbol-related queries
  readonly symbol = {
    // Given a stack of name and the current scope
    // Try looking up the first name in the stack in the current scope
    // and resolve the rest of the name stack as members
    // Then try to do the same with all ancestor scopes
    ofName: this.createQuery(
      Query.Symbol_OfName,
      ({
        nameStack,
        owner = this.parse.ast(),
      }: {
        nameStack: string[];
        owner: ElementDeclarationNode | ProgramNode;
      }): readonly Readonly<{ symbol: NodeSymbol; kind: SymbolKind; name: string }>[] => {
        if (nameStack.length === 0) {
          return [];
        }

        const res: { symbol: NodeSymbol; kind: SymbolKind; name: string }[] = [];

        for (
          let currentOwner: ElementDeclarationNode | ProgramNode | undefined = owner;
          currentOwner;
          currentOwner =
            currentOwner instanceof ElementDeclarationNode ? currentOwner.parent : undefined
        ) {
          if (!currentOwner.symbol?.symbolTable) {
            continue;
          }
          const { symbolTable } = currentOwner.symbol;
          let currentPossibleSymbolTables: SymbolTable[] = [symbolTable];
          let currentPossibleSymbols: { symbol: NodeSymbol; kind: SymbolKind; name: string }[] = [];
          // eslint-disable-next-line no-restricted-syntax
          for (const name of nameStack) {
            currentPossibleSymbols = currentPossibleSymbolTables.flatMap((st) =>
              generatePossibleIndexes(name).flatMap((index) => {
                const symbol = st.get(index);
                const desRes = destructureIndex(index).unwrap_or(undefined);

                return !symbol || !desRes ? [] : { ...desRes, symbol };
              }),
            );
            currentPossibleSymbolTables = currentPossibleSymbols.flatMap((e) =>
              (e.symbol.symbolTable ? e.symbol.symbolTable : []),
            );
          }

          res.push(...currentPossibleSymbols);
        }

        return res;
      },
      ({ nameStack, owner }) => `${nameStack.join('.')}@${owner.id}`,
    ),
    members: this.createQuery(
      Query.Symbol_Members,
      (
        ownerSymbol: NodeSymbol,
      ): readonly Readonly<{ symbol: NodeSymbol; kind: SymbolKind; name: string }>[] =>
        (ownerSymbol.symbolTable ?
          [...ownerSymbol.symbolTable.entries()].map(([index, symbol]) => ({
              ...destructureIndex(index).unwrap(),
              symbol,
            })) :
          []),
    ),
  };

  initMonacoServices() {
    return {
      definitionProvider: new DBMLDefinitionProvider(this),
      referenceProvider: new DBMLReferencesProvider(this),
      autocompletionProvider: new DBMLCompletionItemProvider(this),
    };
  }
}
