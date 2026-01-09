import { SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import ElementBinder from './elementBinder';

export default class TablePartialBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [
        { shouldBind: false as const },
        {
          shouldBind: true as const,
          topSubnamesSymbolKind: [SymbolKind.Enum],
          remainingSubnamesSymbolKind: SymbolKind.Schema,
          ignoreNameNotFound: true,
          ignoreNameNotFoundForQuotedVariable: false,
        },
      ],
    },
    settingList: {
      ref: {
        shouldBind: true as const,
        topSubnamesSymbolKind: [SymbolKind.Table, SymbolKind.Column],
        remainingSubnamesSymbolKind: SymbolKind.Schema,
        ignoreNameNotFound: false,
        ignoreNameNotFoundForQuotedVariable: false,
      },
      default: {
        shouldBind: false as const,
      },
      check: {
        shouldBind: false as const,
      },
    },
  };

  protected settingList = {};
}
