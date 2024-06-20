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
}
