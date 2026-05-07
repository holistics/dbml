import {
  ref, watch, onBeforeUnmount, type ShallowRef,
} from 'vue';
import { initVimMode, type VimAdapterInstance } from 'monaco-vim';
import type * as monaco from 'monaco-editor';
import logger from '@/utils/logger';

export function useVimController (editor: ShallowRef<monaco.editor.IStandaloneCodeEditor | null>) {
  const enabled = ref(false);

  const modeStatus = ref('NORMAL');
  let vimAdapter: VimAdapterInstance | null = null;

  function setup (_editor: monaco.editor.IStandaloneCodeEditor): void {
    try {
      vimAdapter = initVimMode(_editor);
      _editor.updateOptions({
        cursorWidth: 2,
      });
      modeStatus.value = 'NORMAL';

      vimAdapter.on('vim-mode-change', (mode: { mode: string }) => {
        modeStatus.value = (mode.mode || 'NORMAL').toUpperCase();
      });
    } catch (error) {
      logger.warn('Failed to initialize vim mode:', error);
    }
  }

  function clear (): void {
    if (vimAdapter) {
      vimAdapter.dispose();
      vimAdapter = null;
    }
    editor.value?.updateOptions({
      cursorWidth: 1,
    });
  }

  function enable (): void {
    enabled.value = true;
  }

  function disable (): void {
    enabled.value = false;
  }

  watch([editor, enabled], ([_editor, on]) => {
    clear();
    if (_editor && on) {
      setup(_editor);
    }
  }, {
    immediate: true,
  });

  onBeforeUnmount(() => {
    if (vimAdapter) {
      vimAdapter.dispose();
      vimAdapter = null;
    }
  });

  return {
    enabled,
    modeStatus,
    enable,
    disable,
  };
}
