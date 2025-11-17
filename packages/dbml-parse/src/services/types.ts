import type {
  Position as IPosition, editor, languages, IRange, IDisposable, CancellationToken as ICancellationToken,
} from 'monaco-editor-core';

export type Position = IPosition;
export type TextModel = editor.ITextModel;
export type ProviderResult<T> = languages.ProviderResult<T>;
export type Range = IRange;
export type Location = languages.Location;
export type Disposable = IDisposable;

// Autocompletion types
export type CompletionContext = languages.CompletionContext;
export type CancellationToken = ICancellationToken;

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
export type CompletionItem = languages.CompletionItem;
export type CompletionList = languages.CompletionList;
export enum CompletionItemKind {
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
export enum CompletionItemInsertTextRule {
  None = 0,
  KeepWhitespace = 1,
  InsertAsSnippet = 4,
}

// Color provider types
export type DocumentColorProvider = languages.DocumentColorProvider;
export type ColorInformation = languages.IColorInformation;
export type ColorPresentation = languages.IColorPresentation;
export type Color = languages.IColor;

// Go to definition
export type DefinitionProvider = languages.DefinitionProvider;
export type Definition = languages.Definition;
export type CodeActionList = languages.CodeActionList;
export type SignatureHelpResult = languages.SignatureHelpResult;

// Show references
export type ReferenceProvider = languages.ReferenceProvider;
