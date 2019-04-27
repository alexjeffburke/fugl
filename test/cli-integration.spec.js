const spawn = require('cross-spawn');
const expect = require('unexpected');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

function spawnCli(cwd, options = {}) {
  const app = path.join(__dirname, '..', 'bin', 'fugl');
  const args = [];

  Object.keys(options).forEach(key => {
    args.push(`--${key}`);
    args.push(options[key]);
  });

  const spawnedCli = spawn(app, args, { cwd });

  return new Promise((resolve, reject) => {
    let sawExit = false;

    spawnedCli.on('error', err => {
      if (sawExit) {
        return;
      }
      sawExit = true;
      reject(err);
    });

    spawnedCli.on('exit', code => {
      if (sawExit) {
        return;
      }

      sawExit = true;

      if (code) {
        const error = new Error('spawnCli error');
        error.code = code;
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

describe('cli - integration', () => {
  describe('when used with a file (projects)', () => {
    const dir = path.join(path.join(__dirname, 'cli-projects'));
    const buildsDir = path.join(path.join(dir, 'builds'));
    const checkoutDir = path.join(
      buildsDir,
      'https-github-com-bahmutov-dont-break-bar'
    );

    beforeEach(() => {
      rimraf.sync(buildsDir);
    });

    it('should have created the module folder', () => {
      return spawnCli(dir, {
        config: '.fugl.json',
        package: 'dont-break-foo',
        reporter: 'none',
        folder: dir
      }).then(() => {
        expect(fs.existsSync(checkoutDir), 'to be true');
      });
    });
  });

  function skipIf(bool, block, descr) {
    (bool ? it.skip : it)(block, descr);
  }

  describe('when used with a package', () => {
    const dir = path.join(path.join(__dirname, 'cli-package'));
    const buildsDir = path.join(path.join(dir, 'builds'));
    const checkoutDir = path.join(
      buildsDir,
      'https-github-com-bahmutov-dont-break-bar'
    );

    beforeEach(() => {
      rimraf.sync(buildsDir);
    });

    it('should have created the module folder using npm', () => {
      return spawnCli(dir, {
        folder: dir,
        reporter: 'none',
        projects: ['https://github.com/bahmutov/dont-break-bar']
      }).then(() => {
        const stat = fs.lstatSync(
          path.join(checkoutDir, 'node_modules', 'dont-break-foo')
        );
        expect(stat, 'to be an object');
        expect(stat.isSymbolicLink(), 'to be true');
      });
    });

    const isWin = process.platform === 'win32';

    skipIf(isWin, 'should have created the module folder using link', () => {
      return spawnCli(dir, {
        reporter: 'none',
        projects: ['https://github.com/bahmutov/dont-break-bar']
      }).then(() => {
        const stat = fs.lstatSync(
          path.join(checkoutDir, 'node_modules', 'dont-break-foo')
        );
        expect(stat, 'to be an object');
        expect(stat.isSymbolicLink(), 'to be true');
      });
    });
  });
});
