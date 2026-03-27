import { Filepath, FilepathId } from '@/compiler/projectLayout';
import type Compiler from '../../../index';
import { AnalysisResult } from '@/core/analyzer/analyzer';
import Report from '@/core/report';

// Collect a file and all its transitive dependencies in dependency order.
function collectDependencies (compiler: Compiler, entrypoint: Filepath): Filepath[] {
  const visited = new Set<FilepathId>();
  const order: Filepath[] = [];

  const collect = (fp: Filepath) => {
    const id = fp.intern();
    if (visited.has(id)) return;
    visited.add(id);
    order.push(fp);

    for (const depId of compiler.localFileDependencies(fp)) {
      collect(Filepath.from(depId));
    }
  };
  collect(entrypoint);
  return order;
}

// Analyze files in the project. Returns a map of filepath -> AnalysisResult.
// If entrypoint is provided, only that file and its transitive dependencies are analyzed.
// If entrypoint is undefined, all files in the project are analyzed.
export function analyzeProject (this: Compiler, entrypoint?: Filepath): Report<AnalysisResult> {
  const files = entrypoint ? collectDependencies(this, entrypoint) : this.layout().listAllFiles();
}
