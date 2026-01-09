import ElementBinder from './elementBinder';

export default class ChecksBinder extends ElementBinder {
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
