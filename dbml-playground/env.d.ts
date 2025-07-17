/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'monaco-editor' {
  export * from 'monaco-editor/esm/vs/editor/editor.api'
}

declare module 'vue-json-viewer' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<any, any, any>
  export default component
}

declare module '@dbml/parse' {
  export class Compiler {
    setSource(source: string): void
    parse: {
      tokens(): any[]
      ast(): any
      errors(): any[]
      rawDb(): any
    }
  }
} 