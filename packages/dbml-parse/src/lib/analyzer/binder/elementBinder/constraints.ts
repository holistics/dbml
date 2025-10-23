import ElementBinder from './elementBinder';

export default class ConstraintsBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [
        {
          shouldBind: false as const,
        },
      ],
    },
    settingList: {},
  };
  protected settingList = {};
}
