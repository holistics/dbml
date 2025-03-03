import ElementBinder from './elementBinder';

export default class CustomBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [],
    },
    settingList: {},
  };
  protected settingList = {};
}
