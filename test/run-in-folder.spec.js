const AssertionError = require('assert').AssertionError;
const expect = require('unexpected');
const fsExtra = require('fs-extra');
const path = require('path');
const rimraf = require('rimraf');
const spawn = require('cross-spawn');

const runInFolder = require('../src/run-in-folder');

describe('runInFolder', () => {
  it('should reject on missing folder', () => {
    return expect(
      () => {
        return runInFolder();
      },
      'to be rejected with',
      new AssertionError({ message: 'expected folder' })
    );
  });

  it('should reject on missing command', () => {
    return expect(
      () => {
        return runInFolder('/some/folder');
      },
      'to be rejected with',
      new AssertionError({ message: 'expected command' })
    );
  });

  it('should reject on empty command', () => {
    return expect(
      () => {
        return runInFolder('/some/folder', ' ');
      },
      'to be rejected with',
      new AssertionError({ message: 'expected command' })
    );
  });

  describe('when executed @integration', () => {
    const baseDir = path.join(__dirname, 'scratch');
    const toFolder = path.join(baseDir, 'builds', 'run-in-folder');

    beforeEach(() => {
      rimraf.sync(baseDir);

      fsExtra.ensureDirSync(toFolder);

      spawn.sync(
        'git',
        ['clone', 'https://github.com/bahmutov/dont-break-bar.git', '.'],
        {
          cwd: toFolder
        }
      );
    });

    it('should error on command failure', () => {
      return expect(
        () => {
          return runInFolder(toFolder, 'foobar');
        },
        'when rejected',
        'to have message',
        expect.it('to start with', 'Command Failure')
      );
    });

    it('should error on execution failure', () => {
      return expect(
        () => {
          return runInFolder(toFolder, 'npm test');
        },
        'when rejected',
        'to have message',
        expect.it('to start with', 'Test Failure')
      );
    });
  });
});
