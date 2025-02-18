import { SymbolKind } from '../symbol/symbolIndex';

export type BinderRule =
  | {
      // Whether the binder should run
      shouldBind: true;
      // The kinds of the symbols the last subnames would be bound to
      // e.g [TableSymbol, ColumnSymbol]
      //     In `a.b.c`, `b` would be bound to a TableSymbol
      //                 `c` would be bound to a ColumnSymbol
      topSubnamesSymbolKind: SymbolKind[];
      // The kind of the symbols the ramining subnames would be bound to
      // e.g SchemaSymbol
      //     In the above example, `a` would be bound to a SchemaSymbol
      remainingSubnamesSymbolKind: SymbolKind;
      // Should the binding error be ignored
      // Useful when trying to bind an enum name in a column type
      // e.g
      //    Table Emp {
      //      status e_status // if `e_status` enum exists, it would be bound,
      //                      // otherwise, `e_status` is just a plain type
      //    }
      ignoreNameNotFound: boolean;
      // A list of keywords that, when encountered by the binder as a standalone variable, skipped
      settingList?: SettingListBinderRule,
      keywords?: readonly string[];
    }
  | {
      shouldBind: false;
    };

export interface ArgumentBinderRule {
  argBinderRules: BinderRule[];
}

export interface SettingListBinderRule {
  // only the key "settingList" should have "SettingListBinderRule" type. Other keys should have type BinderRule
  [index: string]: BinderRule,
}
