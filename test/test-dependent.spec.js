const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const sinon = require('sinon');

const testDependent = require('../src/test-dependent');

describe('testDependent', () => {
  const toFolder = path.join(__dirname, 'scratch', 'foo');

  it('should resolve with a test result structure', () => {
    const runInFolderSpy = sinon.stub().resolves();
    const testInFolderSpy = sinon.stub().resolves();

    return expect(
      testDependent(
        {
          _runInFolder: runInFolderSpy,
          _testInFolder: testInFolderSpy,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest',
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
    const runInFolderSpy = sinon.stub().resolves();
    const packageTestError = new Error('failure');
    const testInFolderSpy = sinon
      .stub()
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .rejects(packageTestError);

    return expect(
      testDependent(
        {
          _runInFolder: runInFolderSpy,
          _testInFolder: testInFolderSpy,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest',
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
    const runInFolderSpy = sinon.stub().resolves();
    const testInFolderSpy = sinon.stub().resolves();

    return expect(
      testDependent(
        {
          _runInFolder: runInFolderSpy,
          _testInFolder: testInFolderSpy,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest',
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(testInFolderSpy, 'was called times', 2).and(
        'to have all calls satisfying',
        [toFolder, 'npm test', {}]
      );
    });
  });

  it('should trigger installing the package in the dependent', () => {
    const runInFolderSpy = sinon.stub().resolves();
    const testInFolderSpy = sinon.stub().resolves();

    return expect(
      testDependent(
        {
          _runInFolder: runInFolderSpy,
          _testInFolder: testInFolderSpy,
          moduleName: 'https://github.com/bahmutov/dont-break-bar',
          toFolder: toFolder
        },
        {
          pretest: true,
          packageName: 'somepackage',
          packageVersion: 'latest',
          projects: [{ name: 'FOO' }],
          name: 'FOO'
        }
      ),
      'to be fulfilled'
    ).then(() => {
      expect(runInFolderSpy, 'was called times', 1).and(
        'to have a call satisfying',
        [toFolder, 'npm install somepackage@latest', {}]
      );
    });
  });

  describe('when operating with pretest', () => {
    it('should return pending if pretestOrIgnore', () => {
      const runInFolderSpy = sinon.stub().resolves();
      const preTestError = new Error('failure');
      const testInFolderSpy = sinon.stub().rejects(preTestError);

      return expect(
        testDependent(
          {
            _runInFolder: runInFolderSpy,
            _testInFolder: testInFolderSpy,
            moduleName: 'https://github.com/bahmutov/dont-break-bar',
            toFolder: toFolder,
            pretestOrIgnore: true
          },
          {
            pretest: true,
            packageName: 'somepackage',
            packageVersion: 'latest',
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
      const runInFolderSpy = sinon.stub().resolves();
      const testInFolderSpy = sinon.stub().resolves();

      return expect(
        testDependent(
          {
            _runInFolder: runInFolderSpy,
            _testInFolder: testInFolderSpy,
            moduleName: 'https://github.com/bahmutov/dont-break-bar',
            toFolder: toFolder
          },
          {
            pretest: false,
            packageName: 'somepackage',
            packageVersion: 'latest',
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
});
