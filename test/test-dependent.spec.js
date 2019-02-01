const EventEmitter = require('events');
const expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'));
const sinon = require('sinon');

const testDependent = require('../src/test-dependent');

describe('testDependent', () => {
  it('should trigger installing the package in the dependent', () => {
    const dependentInstallSpy = sinon.stub().resolves();

    return expect(
      testDependent(
        new EventEmitter(),
        {
          _installDependent: dependentInstallSpy,
          _testDependent: () => Promise.resolve(),
          package: 'somepackage',
          folder: '/path/to/it',
          tmpDir: '/tmp/test_base',
          noClean: false,
          pretest: true
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
      expect(dependentInstallSpy, 'was called times', 1).and(
        'to have a call satisfying',
        [
          {
            moduleName: 'FOO',
            toFolder: '/tmp/test_base/foo',
            cmd: 'npm install'
          }
        ]
      );
    });
  });

  it('should emit failure', () => {
    const fakeEmitter = {
      emit: sinon.stub().named('emit')
    };
    const error = new Error('bad times');

    return expect(
      testDependent(
        fakeEmitter,
        {
          _installDependent: () => Promise.reject(error),
          package: 'somepackage',
          folder: '/path/to/it',
          tmpDir: '/tmp/test_base',
          noClean: false,
          pretest: true
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
      expect(fakeEmitter.emit, 'to have a call satisfying', [
        'fail',
        {
          title: 'FOO',
          body: '',
          duration: 0,
          fullTitle: expect.it('to be a function'),
          slow: expect.it('to be a function')
        },
        error
      ]);
    });
  });
});
