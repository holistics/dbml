import { defineStore } from 'pinia';
import { Compiler } from '@dbml/parse';

const compiler = new Compiler();

export const useCompilerStore = defineStore('compiler', {
  state: () => ({
    compiler,
    source: '',
    errors: [],
  }),
  actions: {
    setSource(newSource: string) {
      this.compiler.setSource(newSource);
      this.source = compiler.parse.source();
      this.errors = compiler.parse.errors();
    },
  },
});
