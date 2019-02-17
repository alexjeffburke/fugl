const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const NpmStrategy = require('../src/NpmStrategy');

describe('NpmStrategy', () => {
  it('should parse the version', () => {
    const packageInstaller = new NpmStrategy('somepackage@beta');

    return expect(packageInstaller, 'to satisfy', {
      packageName: 'somepackage',
      packageVersion: 'beta'
    });
  });

  it('should run an installation in the supplied folder', () => {
    const packageInstaller = new NpmStrategy('somepackage');
    const runInFolderSpy = sinon.stub().resolves();

    return expect(
      packageInstaller.installTo({
        toFolder: '/some/path',
        _runInFolder: runInFolderSpy
      }),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'to have a call satisfying', [
        '/some/path',
        'npm install somepackage@latest'
      ]);
    });
  });

  it('should run an installation in the presence of an override', () => {
    const packageInstaller = new NpmStrategy('somepackage');
    const runInFolderSpy = sinon.stub().resolves();

    return expect(
      packageInstaller.installTo(
        {
          toFolder: '/some/path',
          _runInFolder: runInFolderSpy
        },
        { postinstall: 'OTHER_POSTINSTALL' }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'to have a call satisfying', [
        '/some/path',
        'OTHER_POSTINSTALL'
      ]);
    });
  });
});
