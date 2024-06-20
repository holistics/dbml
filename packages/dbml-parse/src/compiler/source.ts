// An interface representing a patch in source code
// This allows for lazyly updating the source
// to reduce source update overhead
interface SourcePatch {
  startIndex: number;
  endIndex: number;
  newText: string;
}

export class Source {
  private source: string = '';
  private sourcePatches: SourcePatch[] = [];

  set(source: string) {
    this.source = source;
    this.sourcePatches = [];
  }

  get(): string {
    return this.source;
  }

  patch(sourcePatch: SourcePatch) {
    this.sourcePatches.push(sourcePatch);
  }

  delete(deletePatch: Exclude<SourcePatch, 'newText'>) {
    this.sourcePatches.push({ ...deletePatch, newText: '' });
  }

  insert(insertPatch: Exclude<SourcePatch, 'endIndex'>) {
    this.sourcePatches.push({ ...insertPatch, endIndex: insertPatch.startIndex });
  }
}
