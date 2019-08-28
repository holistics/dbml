import fs from 'fs';

class OutputFilePlugin {
  constructor (filePath, header) {
    this.filePath = filePath;
    this.header = header;
    this.isWrite = false;
  }

  start () {
    fs.writeFileSync(this.filePath, '');
    this.stream = fs.createWriteStream(this.filePath, { flags: 'a' });
    if (this.header) this.stream.write(this.header);
    this.isWrite = true;
  }

  write (content) {
    if (!this.isWrite) this.start();
    this.stream.write(content);
  }
}

export default OutputFilePlugin;
