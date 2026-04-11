import fs from 'fs';

class OutputFilePlugin {
  filePath: string;
  header: string | undefined;
  isWrite: boolean;
  stream!: fs.WriteStream;

  constructor (filePath: string, header?: string) {
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

  write (content: string) {
    if (!this.isWrite) this.start();
    this.stream.write(content);
  }
}

export default OutputFilePlugin;
