import { SymbolKind } from '../../symbol/symbolIndex';
import ElementBinder from './elementBinder';
import { KEYWORDS_OF_DEFAULT_SETTING } from '../../../../constants';

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
        shouldBind: true as const,
        topSubnamesSymbolKind: [SymbolKind.Enum, SymbolKind.EnumField],
        remainingSubnamesSymbolKind: SymbolKind.Schema,
        ignoreNameNotFound: false,
        keywords: KEYWORDS_OF_DEFAULT_SETTING,
      },
    },
  };
  protected settingList = {};
}
