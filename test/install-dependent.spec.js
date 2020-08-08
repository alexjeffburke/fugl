const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const sinon = require('sinon');

const installDependent = require('../src/install-dependent');

function isDirectory(maybeDirPath) {
  const stat = fs.statSync(maybeDirPath);
  try {
    expect(stat.isDirectory(), 'to be true');
  } catch (e) {
    expect.fail({ message: `The path "${maybeDirPath}" is not a directory` });
  }
}

describe('installDependent', () => {
  const toFolder = path.join(__dirname, 'scratch', 'working');

  let isMocked;
  let provisionModule;
  let runInFolderSpy;

  beforeEach(() => {
    isMocked = true;
    provisionModule = sinon.stub(installDependent, 'provisionModule');
    runInFolderSpy = sinon.stub(installDependent, 'runInFolder');
  });

  afterEach(() => {
    if (!isMocked) return;
    sinon.restore();
  });

  it('should trigger installing the package in the dependent', () => {
    provisionModule.resolves();
    runInFolderSpy.resolves();

    return expect(
      installDependent(
        {
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          packageName: 'somepackage',
          packageVersion: 'latest'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'to have calls satisfying', [
        [toFolder, 'npm install']
      ]);
    });
  });

  it('should trigger installing the package in the dependent without timeout', () => {
    provisionModule.resolves();
    runInFolderSpy.resolves();

    return expect(
      installDependent(
        {
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder,
          timeout: 0
        },
        {
          packageName: 'somepackage',
          packageVersion: 'latest'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'to have calls satisfying', [
        [toFolder, 'npm install']
      ]);
    });
  });

  it('should error when install failed', () => {
    provisionModule.resolves();
    const installError = new Error('failure');
    runInFolderSpy.rejects(installError);

    return expect(
      installDependent(
        {
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder,
          timeout: 100
        },
        {
          packageName: 'somepackage',
          packageVersion: 'latest',
          install: 'false'
        }
      ),
      'to be rejected with',
      installError
    ).then(() => {
      expect(runInFolderSpy, 'to have calls satisfying', [[toFolder, 'false']]);
    });
  });

  it('should error when afterinstall failed', () => {
    provisionModule.resolves();
    const afterInstallError = new Error('failure');
    runInFolderSpy
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .rejects(afterInstallError);

    return expect(
      installDependent(
        {
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder,
          timeout: 100
        },
        {
          packageName: 'somepackage',
          packageVersion: 'latest',
          install: 'true',
          afterinstall: 'false'
        }
      ),
      'to be rejected with',
      afterInstallError
    ).then(() => {
      expect(runInFolderSpy, 'to have calls satisfying', [
        [toFolder, 'true'],
        [toFolder, 'false']
      ]);
    });
  });

  it('should error when the installation timeout is exceeded', () => {
    provisionModule.resolves();
    runInFolderSpy.callsFake(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve(), 200);
        })
    );

    return expect(
      installDependent(
        {
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder,
          timeout: 100
        },
        {
          packageName: 'somepackage',
          packageVersion: 'latest'
        }
      ),
      'to be rejected with',
      'install timed out for https://github.com/bahmutov/dont-break-bar'
    );
  });

  describe('when executed @integration', () => {
    beforeEach(() => {
      sinon.restore();
      isMocked = false;

      if (fs.existsSync(toFolder)) {
        fsExtra.removeSync(toFolder);
      }
    });

    it('should trigger installing the package in the dependent', () => {
      return expect(
        installDependent(
          {
            moduleName: 'https://github.com/alexjeffburke/fugl-test-project',
            toFolder: toFolder
          },
          {
            packageName: 'somepackage',
            packageVersion: 'latest'
          }
        ),
        'to be fulfilled'
      ).then(() => {
        isDirectory(path.join(toFolder, '.git'));
        isDirectory(path.join(toFolder, 'node_modules'));
      });
    });
  });
});
