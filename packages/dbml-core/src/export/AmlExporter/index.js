import _ from 'lodash';
import { shouldPrintSchema } from '../utils';
import { DEFAULT_SCHEMA_NAME } from '../../model_structure/config';

export default class AmlExporter {
  static export (model, dataSource) {
    let res = {
      datasets: [
        { 
          name: 'ds1.dataset.aml',
          content: 'test dataset', 
        },
        { 
          name: 'ds2.dataset.aml',
          content: 'test dataset2', 
        },
      ],
      models: [
        { 
          name: 'm1.model.aml',
          content: 'test model', 
        },
        { 
          name: 'm2.model.aml',
          content: 'test model2', 
        },
      ],
      relationships:[
        { 
          name: 'r1.relationship.aml',
          content: 'test relationship', 
        },
        { 
          name: 'r2.relationship.aml',
          content: 'test relationship2', 
        },
      ],
    };
  //   let hasBlockAbove = false;
  //   const database = model.database['1'];

  //   database.schemaIds.forEach((schemaId) => {
  //     const {
  //       enumIds, tableIds, tableGroupIds, refIds,
  //     } = model.schemas[schemaId];

  //     if (!_.isEmpty(enumIds)) {
  //       if (hasBlockAbove) res += '\n';
  //       res += DbmlExporter.exportEnums(enumIds, model);
  //       hasBlockAbove = true;
  //     }

  //     if (!_.isEmpty(tableIds)) {
  //       if (hasBlockAbove) res += '\n';
  //       res += DbmlExporter.exportTables(tableIds, model);
  //       hasBlockAbove = true;
  //     }

  //     if (!_.isEmpty(tableGroupIds)) {
  //       if (hasBlockAbove) res += '\n';
  //       res += DbmlExporter.exportTableGroups(tableGroupIds, model);
  //       hasBlockAbove = true;
  //     }

  //     if (!_.isEmpty(refIds)) {
  //       if (hasBlockAbove) res += '\n';
  //       res += DbmlExporter.exportRefs(refIds, model);
  //       hasBlockAbove = true;
  //     }
  //   });
    return res;
  }
};
