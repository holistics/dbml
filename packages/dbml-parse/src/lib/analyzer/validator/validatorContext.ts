export const enum ValidatorContext {
  TopLevelContext,
  ProjectContext,
  TableContext,
  TableGroupContext,
  EnumContext,
  RefContext,
  IndexesContext,
  NoteContext,
  CustomContext,
}

export function canBeNestedWithin(
  container: ValidatorContext,
  containee: ValidatorContext,
): boolean {
  switch (container) {
    case ValidatorContext.TopLevelContext:
      return (
        containee === ValidatorContext.ProjectContext ||
        containee === ValidatorContext.TableContext ||
        containee === ValidatorContext.TableGroupContext ||
        containee === ValidatorContext.EnumContext ||
        containee === ValidatorContext.RefContext
      );
    case ValidatorContext.ProjectContext:
      return (
        containee === ValidatorContext.TableContext ||
        containee === ValidatorContext.TableGroupContext ||
        containee === ValidatorContext.EnumContext ||
        containee === ValidatorContext.NoteContext ||
        containee === ValidatorContext.RefContext ||
        containee === ValidatorContext.CustomContext
      );
    case ValidatorContext.TableContext:
      return (
        containee === ValidatorContext.IndexesContext ||
        containee === ValidatorContext.NoteContext ||
        containee === ValidatorContext.RefContext
      );
    default:
      return false;
  }
}

export function canContainField(container: ValidatorContext, fieldName: string) {
  // eslint-disable-next-line
  const _fieldName = fieldName.toLowerCase();

  switch (container) {
    case ValidatorContext.ProjectContext:
      return true;
    case ValidatorContext.TableContext:
      return _fieldName === 'note' || _fieldName === 'ref';
    default:
      return false;
  }
}

export class ContextStack {
  private stack: ValidatorContext[] = [ValidatorContext.TopLevelContext];

  push(ctx: ValidatorContext) {
    this.stack.push(ctx);
  }

  pop(): ValidatorContext {
    return this.stack.length === 1 ? this.stack[0] : this.stack.pop()!;
  }

  top(): ValidatorContext {
    return this.stack[this.stack.length - 1];
  }

  parent(): ValidatorContext {
    return this.stack.length === 1 ? this.stack[0] : this.stack[this.stack.length - 2];
  }

  isWithinContext(ctx: ValidatorContext): boolean {
    for (let i = this.stack.length - 1; i >= 0; i -= 1) {
      if (this.stack[i] === ctx) {
        return true;
      }
    }

    return false;
  }
}
