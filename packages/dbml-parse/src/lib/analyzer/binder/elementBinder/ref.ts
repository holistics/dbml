import { SymbolKind } from '@analyzer/symbol/symbolIndex';
import ElementBinder from './elementBinder';

export default class RefBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [
        {
          shouldBind: true as const,
          topSubnamesSymbolKind: [SymbolKind.Table, SymbolKind.Column],
          remainingSubnamesSymbolKind: SymbolKind.Schema,
          ignoreNameNotFound: false,
        },
      ],
    },
    settingList: {},
  };

  protected settingList = {};
}
