const path = require('path');

const fs = jest.genMockFromModule('fs');

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let mockFiles = Object.create(null);
function __setMockFiles (newMockFiles) {
  mockFiles = Object.create(null);
  // eslint-disable-next-line
  for (const file in newMockFiles) {
    const dir = path.normalize(path.dirname(file));

    if (!mockFiles[dir]) {
      mockFiles[dir] = [];
    }
    mockFiles[dir].push(path.basename(file));
  }
}

function __clearMockFiles () {
  mockFiles = Object.create(null);
}

function readdir (directoryPath, callback) {
  callback(null, mockFiles[path.normalize(directoryPath)] || []);
}

fs.__setMockFiles = __setMockFiles;
fs.__clearMockFiles = __clearMockFiles;
fs.readFileSync = jest.requireActual('fs').readFileSync;
fs.readdir = readdir;

module.exports = fs;
