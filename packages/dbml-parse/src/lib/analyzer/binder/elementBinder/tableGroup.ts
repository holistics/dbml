import { SymbolKind } from '@analyzer/symbol/symbolIndex';
import ElementBinder from './elementBinder';

export default class TableGroupBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [
        {
          shouldBind: true as const,
          topSubnamesSymbolKind: [SymbolKind.Table],
          remainingSubnamesSymbolKind: SymbolKind.Schema,
          ignoreNameNotFound: false,
        },
      ],
    },
    settingList: {},
  };
  protected settingList = {};
}
