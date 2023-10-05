import { SymbolKind } from '../symbol/symbolIndex';

export type BinderRule =
  | {
      shouldBind: true;
      topSubnamesSymbolKind: SymbolKind[];
      remainingSubnamesSymbolKind: SymbolKind;
      ignoreNameNotFound: boolean;
    }
  | {
      shouldBind: false;
    };

export interface ArgumentBinderRule {
  argBinderRules: BinderRule[];
}

export interface SettingListBinderRule {
  [index: string]: BinderRule;
}
