import Exporter from './Exporter';

class JsonExporter extends Exporter {
  constructor (schema = {}) {
    super(schema);
  }

  export () {
    return JSON.stringify(this.schema.export());
  }
}

export default JsonExporter;
