/// <reference types="monaco-editor-core/monaco.d.ts"/>
import { AreEnumsIdentical, IsTrue, _metacheck } from './_meta';

export type Position = monaco.Position;
export type TextModel = monaco.editor.ITextModel;
export type ProviderResult<T> = monaco.languages.ProviderResult<T>;
export type Range = monaco.IRange;
export type Location = monaco.languages.Location;
export type Disposable = monaco.IDisposable;

// Autocompletion types
export type CompletionContext = monaco.languages.CompletionContext;
export type CancellationToken = monaco.CancellationToken;

export interface CompletionItemProvider {
  triggerCharacters?: string[];
  provideCompletionItems(
    model: TextModel,
    position: Position,
    context: CompletionContext,
    token: CancellationToken,
  ): ProviderResult<CompletionList>;
  resolveCompletionItem?(
    item: CompletionItem,
    token: CancellationToken,
  ): ProviderResult<CompletionItem>;
}
export type CompletionItem = monaco.languages.CompletionItem;
export type CompletionList = monaco.languages.CompletionList;

// Color provider types
export type DocumentColorProvider = monaco.languages.DocumentColorProvider;
export type ColorInformation = monaco.languages.IColorInformation;
export type ColorPresentation = monaco.languages.IColorPresentation;
export type Color = monaco.languages.IColor;

// Go to definition
export type DefinitionProvider = monaco.languages.DefinitionProvider;
export type Definition = monaco.languages.Definition;
export type CodeActionList = monaco.languages.CodeActionList;
export type SignatureHelpResult = monaco.languages.SignatureHelpResult;

// Show references
export type ReferenceProvider = monaco.languages.ReferenceProvider;

// Redefine monaco enums
// as enums have compilation targets so importing from monaco.d.ts alone does not suffice

/* eslint-disable @typescript-eslint/no-unused-vars */
// monaco.languages.MonacoCompletionItemKind
_metacheck<
  IsTrue<AreEnumsIdentical<typeof CompletionItemKind, typeof monaco.languages.CompletionItemKind>>
>();

export enum CompletionItemKind {
  Method = 0,
  Function = 1,
  Constructor = 2,
  Field = 3,
  Variable = 4,
  Class = 5,
  Struct = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Event = 10,
  Operator = 11,
  Unit = 12,
  Value = 13,
  Constant = 14,
  Enum = 15,
  EnumMember = 16,
  Keyword = 17,
  Text = 18,
  Color = 19,
  File = 20,
  Reference = 21,
  Customcolor = 22,
  Folder = 23,
  TypeParameter = 24,
  User = 25,
  Issue = 26,
  Snippet = 27,
}

// monaco.languages.MonacoCompletionItemInsertTextRule {}
_metacheck<
  IsTrue<
    AreEnumsIdentical<
      typeof monaco.languages.CompletionItemInsertTextRule,
      typeof CompletionItemInsertTextRule
    >
  >
>;

export enum CompletionItemInsertTextRule {
  None = 0,
  /**
   * Adjust whitespace/indentation of multiline insert texts to
   * match the current line indentation.
   */
  KeepWhitespace = 1,
  /**
   * `insertText` is a snippet.
   */
  InsertAsSnippet = 4,
}

/* eslint-enable @typescript-eslint/no-unused-vars */
