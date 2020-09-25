const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const sinon = require('sinon');

const testDependent = require('../src/test-dependent');

function createFakePackageInstaller() {
  return {
    installTo: sinon.stub().named('installTo')
  };
}

describe('testDependent', () => {
  const toFolder = path.join(__dirname, 'scratch', 'foo');

  let packageInstaller;
  let runInFolderSpy;

  beforeEach(() => {
    packageInstaller = createFakePackageInstaller();
    runInFolderSpy = sinon.stub(testDependent, 'runInFolder');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should resolve with a test result structure', () => {
    packageInstaller.installTo.resolves();
    runInFolderSpy.resolves();

    return expect(
      testDependent(
        {
          packageInstaller,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ),
      'to be fulfilled with',
      expect.it('to equal', {
        pretest: { status: 'pass' },
        packagetest: { status: 'pass' }
      })
    );
  });

  it('should resolve with a package test failure', () => {
    packageInstaller.installTo.resolves();
    const packageTestError = new Error('failure');
    runInFolderSpy
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .rejects(packageTestError);

    return expect(
      testDependent(
        {
          packageInstaller,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ),
      'to be fulfilled with',
      expect.it('to equal', {
        pretest: { status: 'pass' },
        packagetest: { status: 'fail', error: packageTestError }
      })
    );
  });

  it('should trigger tests of the dependent', () => {
    packageInstaller.installTo.resolves();
    runInFolderSpy.resolves();

    return expect(
      testDependent(
        {
          packageInstaller,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(
        runInFolderSpy,
        'was called times',
        2
      ).and('to have all calls satisfying', [toFolder, 'npm test']);
    });
  });

  it('should trigger installing the package in the dependent', () => {
    packageInstaller.installTo.resolves();
    runInFolderSpy.resolves();

    return expect(
      testDependent(
        {
          packageInstaller,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(
        packageInstaller.installTo,
        'was called times',
        1
      ).and('to have a call exhaustively satisfying', [
        { toFolder },
        { pretest: true, name: 'FOO', projects: [{ name: 'FOO' }] }
      ]);
    });
  });

  describe('when operating with pretest', () => {
    it('should return pending if pretestOrIgnore', () => {
      packageInstaller.installTo.resolves();
      const preTestError = new Error('failure');
      runInFolderSpy.rejects(preTestError);

      return expect(
        testDependent(
          {
            packageInstaller,
            moduleName: 'https://github.com/bahmutov/dont-break-bar',
            toFolder: toFolder,
            pretestOrIgnore: true
          },
          {
            pretest: true,
            projects: [{ name: 'FOO' }],
            name: 'FOO'
          }
        ),
        'to be fulfilled with',
        expect.it('to equal', {
          pretest: { status: 'pending' }
        })
      );
    });
  });

  describe('when operating without pretest', () => {
    it('should return test result structure', () => {
      packageInstaller.installTo.resolves();
      runInFolderSpy.resolves();

      return expect(
        testDependent(
          {
            packageInstaller,
            moduleName: 'https://github.com/bahmutov/dont-break-bar',
            toFolder: toFolder
          },
          {
            pretest: false,
            projects: [{ name: 'FOO' }],
            name: 'FOO'
          }
        ),
        'to be fulfilled with',
        expect.it('to equal', {
          packagetest: { status: 'pass' }
        })
      );
    });
  });

  describe('with aftertest hook', () => {
    it('should execute an aftertest command', () => {
      packageInstaller.installTo.resolves();
      runInFolderSpy.resolves();

      return expect(
        testDependent(
          {
            packageInstaller,
            moduleName: 'https://github.com/bahmutov/dont-break-bar',
            toFolder: toFolder
          },
          {
            pretest: true,
            projects: [{ name: 'FOO' }],
            name: 'FOO',
            aftertest: 'some_command'
          }
        ),
        'to be fulfilled'
      ).then(() => {
        expect(runInFolderSpy, 'was called times', 3).and(
          'to have calls satisfying',
          [
            [toFolder, 'npm test'],
            [toFolder, 'npm test'],
            [toFolder, 'some_command']
          ]
        );
      });
    });
  });
});
