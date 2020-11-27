const spawn = require('cross-spawn');
const expect = require('unexpected');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

function spawnCli(cwd, binOptions = {}, options = {}) {
  const app = path.join(__dirname, '..', 'bin', 'fugl');
  const args = [];

  Object.keys(binOptions).forEach(key => {
    args.push(`--${key}`);
    args.push(binOptions[key]);
  });

  const spawnedCli = spawn(app, args, {
    cwd,
    stdio: [options.stdin ? 'pipe' : 'ignore']
  });

  const p = new Promise((resolve, reject) => {
    let sawExit = false;
    let stdout = '';
    let stderr = '';

    spawnedCli.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
    });

    spawnedCli.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });

    const makeError = code => {
      const error = new Error('spawnCli error');
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      return error;
    };

    spawnedCli.on('error', () => {
      if (sawExit) {
        return;
      }

      sawExit = true;

      reject(makeError(null));
    });

    spawnedCli.on('exit', code => {
      if (sawExit) {
        return;
      }

      sawExit = true;

      if (code) {
        reject(makeError(code));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });

  p._spawn = spawnedCli;

  return p;
}

describe('cli @integration', () => {
  describe('when used with a file (projects)', () => {
    const dir = path.join(path.join(__dirname, 'cli-projects'));
    const buildsDir = path.join(path.join(dir, 'builds'));
    const checkoutDir = path.join(
      buildsDir,
      'https-github-com-bahmutov-dont-break-bar'
    );

    beforeEach(() => {
      fsExtra.removeSync(buildsDir);
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

  const isNode10 = /^v10\./.test(process.version);
  const isCiWindows =
    process.env.GITHUB_ACTIONS === 'true' && process.platform === 'win32';

  describe('when used with a package', () => {
    const dir = path.join(path.join(__dirname, 'cli-package'));

    it('should have created the module folder in the specified folder', function() {
      if (isCiWindows && isNode10) {
        this.skip();
      }

      const buildsDir = path.join(path.join(dir, 'builds'));
      const checkoutDir = path.join(
        buildsDir,
        'https-github-com-bahmutov-dont-break-bar'
      );

      return spawnCli(dir, {
        folder: dir,
        reporter: 'none',
        projects: ['https://github.com/bahmutov/dont-break-bar']
      }).then(() => {
        const stat = fs.lstatSync(
          path.join(checkoutDir, 'node_modules', 'dont-break-foo')
        );

        let error;
        try {
          expect(stat, 'to be an object');
          expect(stat.isSymbolicLink(), 'to be true');
        } catch (e) {
          error = e;
        }

        fsExtra.removeSync(checkoutDir);

        if (error) {
          throw error;
        }
      });
    });

    it('should have created the module folder in os.tmpdir()', function() {
      if (isCiWindows && isNode10) {
        this.skip();
      }

      return spawnCli(dir, {
        reporter: 'none',
        projects: ['https://github.com/bahmutov/dont-break-bar']
      }).then(({ stderr }) => {
        const tmpDirMatch = stderr.match(/builds located in (.*)/);
        if (!tmpDirMatch) {
          throw new Error('unable to determine builds folder from stderr');
        }
        const buildsDir = path.join(tmpDirMatch[1], 'builds');
        const checkoutDir = path.join(
          buildsDir,
          'https-github-com-bahmutov-dont-break-bar'
        );

        const stat = fs.lstatSync(
          path.join(checkoutDir, 'node_modules', 'dont-break-foo')
        );

        let error;
        try {
          expect(stat, 'to be an object');
          expect(stat.isSymbolicLink(), 'to be true');
        } catch (e) {
          error = e;
        }

        fsExtra.removeSync(checkoutDir);

        if (error) {
          throw error;
        }
      });
    });

    it('should have written an HTML report to a custom directory', function() {
      if (isCiWindows && isNode10) {
        this.skip();
      }

      const breakagePath = path.join(dir, 'nested');
      const reportPath = path.join(breakagePath, 'report');
      const file = path.join(reportPath, 'index.html');

      return spawnCli(dir, {
        reporter: 'html',
        projects: ['https://github.com/bahmutov/dont-break-bar'],
        reportPath
      }).then(() => {
        let error;
        try {
          expect(fs.existsSync(file), 'to be true');
        } catch (e) {
          error = e;
        }

        fsExtra.removeSync(breakagePath);

        if (error) {
          throw error;
        }
      });
    });
  });

  describe('when used with stdin', () => {
    it('should accept JSON', function() {
      const dir = path.join(path.join(__dirname, 'cli-projects'));
      const cli = spawnCli(dir, {}, { stdin: true });

      const stdinObject = { package: 'fugl', projects: [] };
      cli._spawn.stdin.write(JSON.stringify(stdinObject));
      cli._spawn.stdin.end();

      return expect(() => cli, 'to be rejected with', {
        stderr: /Fugl: no projects specified/
      });
    });

    it('should accept project name strings', function() {
      if (isCiWindows && isNode10) {
        this.skip();
      }

      const dir = path.join(path.join(__dirname, 'cli-package'));
      const buildsDir = path.join(path.join(dir, 'builds'));
      const checkoutDir = path.join(
        buildsDir,
        'https-github-com-bahmutov-dont-break-bar'
      );
      const cli = spawnCli(dir, { folder: dir }, { stdin: true });

      cli._spawn.stdin.write('https://github.com/bahmutov/dont-break-bar');
      cli._spawn.stdin.end();

      return expect(() => cli, 'to be fulfilled').then(() => {
        const stat = fs.lstatSync(
          path.join(checkoutDir, 'node_modules', 'dont-break-foo')
        );

        let error;
        try {
          expect(stat, 'to be an object');
          expect(stat.isSymbolicLink(), 'to be true');
        } catch (e) {
          error = e;
        }

        fsExtra.removeSync(checkoutDir);

        if (error) {
          throw error;
        }
      });
    });
  });

  describe('when used with the spec reporter', () => {
    it('should handle failure', function() {
      const dir = path.join(__dirname, 'cli-failure');
      const buildsDir = path.join(dir, 'builds');

      return spawnCli(dir, {
        folder: dir,
        projects: ['https://github.com/alexjeffburke/fugl-test-project']
      }).catch(({ stdout }) => {
        let error;
        try {
          expect(stdout, 'to contain', 'Test Failure');
        } catch (e) {
          error = e;
        }

        fsExtra.removeSync(buildsDir);

        if (error) {
          throw error;
        }
      });
    });
  });
});
