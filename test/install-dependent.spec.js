const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const installDependent = require('../src/install-dependency');

describe('installDependent', () => {
  const toFolder = path.join(__dirname, 'scratch', 'working');

  beforeEach(() => {
    if (fs.existsSync(toFolder)) {
      rimraf.sync(toFolder);
    }
  });

  it('should trigger installing the package in the dependent', () => {
    return expect(
      installDependent(
        {
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(fs.existsSync(path.join(toFolder, '.git')), 'to be true');
    });
  });
});
