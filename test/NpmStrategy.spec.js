const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const fsExtra = require('fs-extra');
const path = require('path');
const sinon = require('sinon');

const NpmStrategy = require('../src/NpmStrategy');

describe('NpmStrategy', () => {
  const moduleDir = path.join(__dirname, 'module');
  const buildsFolder = path.join(moduleDir, 'builds');
  const toFolder = path.join(buildsFolder, 'example');

  beforeEach(() => {
    fsExtra.removeSync(buildsFolder);
  });

  it('should default the "latest" version', () => {
    const packageInstaller = new NpmStrategy('somepackage');

    return expect(packageInstaller, 'to satisfy', {
      packageName: 'somepackage',
      packageVersion: 'latest'
    });
  });

  it('should parse any supplied version', () => {
    const packageInstaller = new NpmStrategy('somepackage@beta');

    return expect(packageInstaller, 'to satisfy', {
      packageName: 'somepackage',
      packageVersion: 'beta'
    });
  });

  it('should allow overriding the version via process.env.FUGL_PACKAGE_VERSION', () => {
    process.env.FUGL_PACKAGE_VERSION = 'beta';

    const packageInstaller = new NpmStrategy('somepackage@1.0.0');

    delete process.env.FUGL_PACKAGE_VERSION;

    return expect(packageInstaller, 'to satisfy', {
      packageName: 'somepackage',
      packageVersion: 'beta'
    });
  });

  it('should run an installation in the supplied folder', () => {
    const packageInstaller = new NpmStrategy('somepackage');
    const runInFolderSpy = sinon.stub().resolves();

    // create folder
    fsExtra.mkdirpSync(toFolder);

    return expect(
      packageInstaller.installTo({
        toFolder,
        _runInFolder: runInFolderSpy
      }),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'to have a call satisfying', [
        toFolder,
        'npm install somepackage@latest'
      ]);
    });
  });

  it('should run an installation in the presence of an override', () => {
    const packageInstaller = new NpmStrategy('somepackage');
    const runInFolderSpy = sinon.stub().resolves();

    // create folder
    fsExtra.mkdirpSync(toFolder);

    return expect(
      packageInstaller.installTo(
        {
          toFolder,
          _runInFolder: runInFolderSpy
        },
        { postinstall: 'OTHER_POSTINSTALL' }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'to have a call satisfying', [
        toFolder,
        'OTHER_POSTINSTALL'
      ]);
    });
  });

  it('should reject if no toFolder is supplied', () => {
    return expect(
      () => new NpmStrategy('somepackage').installTo({}),
      'to be rejected with',
      'Install Failure: cannot npm install into missing folder'
    );
  });

  it('should reject if execution fails', () => {
    const runInFolderSpy = sinon.stub().rejects(new Error('fail'));

    // create folder
    fsExtra.mkdirpSync(toFolder);

    return expect(
      () =>
        new NpmStrategy('somepackage').installTo({
          toFolder,
          _runInFolder: runInFolderSpy
        }),
      'to be rejected with',
      'Install Failure: unable to npm install package'
    );
  });
});
