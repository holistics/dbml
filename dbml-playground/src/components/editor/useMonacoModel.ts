import {
  ref, shallowRef, watch, onBeforeUnmount, computed,
  type Ref,
} from 'vue';
import * as monaco from 'monaco-editor';

function getOrCreateModel (
  uri: monaco.Uri | undefined,
): monaco.editor.ITextModel {
  const existing = uri
    ? monaco.editor.getModel(uri)
    : undefined;
  if (existing) {
    return existing;
  }
  return monaco.editor.createModel('', undefined, uri);
}

export function useMonacoModel (uri: Ref<monaco.Uri | undefined>) {
  const model = shallowRef(getOrCreateModel(uri.value));
  const content = ref(model.value.getValue());

  let contentDisposable = model.value.onDidChangeContent(() => {
    content.value = model.value.getValue();
  });

  function reattachContentListener (): void {
    contentDisposable.dispose();
    contentDisposable = model.value.onDidChangeContent(() => {
      content.value = model.value.getValue();
    });
  }

  watch(uri, () => {
    const prevLanguage = model.value.getLanguageId();
    contentDisposable.dispose();
    model.value = getOrCreateModel(uri.value);
    monaco.editor.setModelLanguage(model.value, prevLanguage);
    content.value = model.value.getValue();
    reattachContentListener();
  });

  onBeforeUnmount(() => {
    contentDisposable.dispose();
  });

  function setContent (value: string): void {
    model.value.setValue(value);
  }

  function setLanguage (language: string): void {
    monaco.editor.setModelLanguage(model.value, language);
  }

  function getLanguage (): string {
    return model.value.getLanguageId();
  }

  return {
    model,
    content: computed(() => content.value),
    setContent,
    setLanguage,
    getLanguage,
  };
}
