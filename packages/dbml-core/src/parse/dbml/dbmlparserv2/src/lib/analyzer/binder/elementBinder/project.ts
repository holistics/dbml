import ElementBinder from './elementBinder';

export default class ProjectBinder extends ElementBinder {
  protected subfield = {
    arg: {
      argBinderRules: [],
    },
    settingList: {},
  };
  protected settingList = {};
}
