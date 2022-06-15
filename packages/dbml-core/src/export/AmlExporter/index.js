import exportProject from './project';
import exportTable from './table';
import exportRef from './ref';

export default class AmlExporter {
  static export (normalizedDatabase, dataSource) {
    const database = normalizedDatabase.database['1'];

    const res = database.schemaIds.reduce((accumulator, schemaId) => {
      const schema = normalizedDatabase.schemas[schemaId];
      const { tableIds, enumIds, refIds } = schema;

      const tableModels = tableIds.map((tableId) => {
        const { name, content } = exportTable(tableId, normalizedDatabase, dataSource);
        const fullName = `models/${name}.model.aml`;
        return {
          name: fullName,
          content,
        };
      });
      accumulator.models.push(...tableModels);

      const relationships = refIds.map((refId) => {
        const { name, content } = exportRef(refId, normalizedDatabase);
        const fullName = `relationships/${name}.relationship.aml`;
        return {
          name: fullName,
          content,
        };
      });
      accumulator.relationships.push(...relationships);

      return accumulator;
    }, {
      models: [],
      relationships: [],
    });

    const amlProject = exportProject(database, normalizedDatabase, res.models, res.relationships, dataSource);
    const datasets = [{
      name: `datasets/${amlProject.name}.dataset.aml`,
      content: amlProject.content,
    }];

    return {
      ...res,
      datasets,
    };
  }
}
