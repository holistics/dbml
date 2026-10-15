import { computed } from 'vue';
import { defineStore } from 'pinia';
import {
  compileArch, isArchitecture, isArchitectureSource,
  type ArchDiagnostic, type NetworkModel,
} from '@dbml/arch';
import { useProjectStore } from './projectStore';

/**
 * THE ARCHITECTURE DIALECT, READ FROM THE SAME FILES AS EVERYTHING ELSE.
 *
 * It is a second compiler over the same project for now, which is honest about where the work
 * stands: `@dbml/arch` binds its own tree rather than registering `GlobalModule`s, so the two
 * vocabularies cannot yet share one parse. When it does, this store collapses into the parser
 * store and the document is read once.
 *
 * WHAT DECIDES WHETHER A DOCUMENT IS ARCHITECTURE. Not its name: dbdiagram's cloud documents
 * have no path at all, so a filename can never be the signal, and `.arch.dbml` is a convention
 * for a file tree and a CI glob, nothing more.
 *
 * THE MARKER DECIDES, AND IT DECIDES FIRST. `isArchitectureSource` reads `diagram_type` off
 * the raw string with a regular expression, before any lexer or parser has run, which is
 * exactly why the marker lives in front matter rather than inside `Project`: reaching it
 * inside `Project` would mean parsing the file, and parsing is the thing being chosen. A
 * document that says it is a schema is never handed to this compiler at all.
 *
 * Content is the FALLBACK, for a document that says nothing: one with `Kind` declarations and
 * elements built on them is an architecture diagram wherever it is stored. The marker also
 * covers the one case inference cannot: four `Kind` lines and nothing drawn yet is not
 * "unknown", and a canvas must not flicker between answers while somebody is typing.
 */
export const useArchStore = defineStore('arch', () => {
  const project = useProjectStore();

  const result = computed(() => {
    const files: Record<string, string> = {};
    for (const [path, source] of Object.entries(project.files)) {
      files[path.startsWith('/') ? path : `/${path}`] = source;
    }
    const entry = project.currentFile.startsWith('/') ? project.currentFile : `/${project.currentFile}`;

    // a document that says it is something else is not compiled at all: routing happens before
    // the work, not after it
    const source = files[entry] ?? '';
    const marker = /^\s*---[ \t]*\r?\n/.test(source);
    if (marker && !isArchitectureSource(source)) {
      return { model: null as NetworkModel | null, diagramType: null as string | null, diagnostics: [] as ArchDiagnostic[] };
    }

    try {
      return compileArch(files, entry);
    } catch (error) {
      return {
        model: null as NetworkModel | null,
        diagramType: null as string | null,
        diagnostics: [{
          severity: 'error' as const,
          code: 'crash',
          message: (error as Error).message,
          file: entry,
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        }] as ArchDiagnostic[],
      };
    }
  });

  const model = computed(() => result.value.model);
  const diagnostics = computed(() => result.value.diagnostics);
  const diagramType = computed(() => result.value.diagramType);

  /**
   * Whether to offer the canvas at all. The rule lives in `@dbml/arch` because it is a question
   * about the language, not about this view, and because getting it wrong means every DBML user
   * on the public playground sees an empty tab.
   */
  const hasArchitecture = computed(() => isArchitecture(result.value as never));

  const counts = computed(() => {
    const current = model.value;
    if (!current) return { nodes: 0, groups: 0, links: 0 };
    let nodes = 0;
    let groups = 0;
    for (const element of current.elements.values()) {
      if (element.sort === 'node') nodes += 1;
      if (element.sort === 'group') groups += 1;
    }
    return { nodes, groups, links: current.links.length };
  });

  const errors = computed(() => diagnostics.value.filter((d) => d.severity === 'error'));
  const warnings = computed(() => diagnostics.value.filter((d) => d.severity === 'warning'));

  return {
    model, diagnostics, diagramType, hasArchitecture, counts, errors, warnings,
  };
});
