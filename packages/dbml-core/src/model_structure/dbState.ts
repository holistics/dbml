export default class DbState {
    dbId = 1;
    schemaId = 1;
    enumId = 1;
    tableGroupId = 1;
    refId = 1;
    tableId = 1;
    enumValueId = 1;
    endpointId = 1;
    indexId = 1;
    fieldId = 1;
    indexColumnId = 1;

    generateId(el: string) {
        const id = this[el];
        this[el] += 1;
        return id;
    }
}
