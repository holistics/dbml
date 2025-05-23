import { SymbolKind } from '../../symbol/symbolIndex';
import ElementBinder from './elementBinder';

export default class TableBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [
        { shouldBind: false as const },
        {
          shouldBind: true as const,
          topSubnamesSymbolKind: [SymbolKind.Enum],
          remainingSubnamesSymbolKind: SymbolKind.Schema,
          ignoreNameNotFound: true,
        },
      ],
    },
    settingList: {
      ref: {
        shouldBind: true as const,
        topSubnamesSymbolKind: [SymbolKind.Table, SymbolKind.Column],
        remainingSubnamesSymbolKind: SymbolKind.Schema,
        ignoreNameNotFound: false,
      },
      default: {
        shouldBind: false as const,
      },
    },
  };
  protected settingList = {};

  protected injectionBinderRule = {
    shouldBind: true as const,
    topSubnamesSymbolKind: [],
    remainingSubnamesSymbolKind: SymbolKind.TablePartial,
    ignoreNameNotFound: false,
  };
}
