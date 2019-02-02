const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const path = require('path');
const sinon = require('sinon');

const testDependent = require('../src/test-dependent');

describe('testDependent', () => {
  const toFolder = path.join(__dirname, 'scratch', 'foo');

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
});
