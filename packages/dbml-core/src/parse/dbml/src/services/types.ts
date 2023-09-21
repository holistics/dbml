import * as monaco from 'monaco-editor-core';

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
export type CompletionItemKind = monaco.languages.CompletionItemKind;
export type CompletionItemInsertTextRule = monaco.languages.CompletionItemInsertTextRule;

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
