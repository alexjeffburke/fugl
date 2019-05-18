const spawn = require('cross-spawn');
const expect = require('unexpected');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

function spawnCli(cwd, options = {}) {
  const app = path.join(__dirname, '..', 'bin', 'fugl');
  const args = [];

  const { stdin, ...binOptions } = options;

  Object.keys(binOptions).forEach(key => {
    args.push(`--${key}`);
    args.push(binOptions[key]);
  });

  const spawnedCli = spawn(app, args, {
    cwd,
    stdio: [stdin ? 'pipe' : 'ignore']
  });

  const p = new Promise((resolve, reject) => {
    let sawExit = false;
    let stderr = '';

    spawnedCli.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });

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
        const error = new Error(`spawnCli error\n\n${stderr}`);
        error.code = code;
        reject(error);
      } else {
        resolve(stderr);
      }
    });
  });

  p._spawn = spawnedCli;

  return p;
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

  const isTravisWindows =
    process.env.TRAVIS === 'true' && process.platform === 'win32';

  describe('when used with a package', () => {
    const dir = path.join(path.join(__dirname, 'cli-package'));

    it('should have created the module folder in the specified folder', function() {
      if (isTravisWindows) {
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

        rimraf.sync(checkoutDir);

        if (error) {
          throw error;
        }
      });
    });

    it('should have created the module folder in os.tmpdir()', function() {
      if (isTravisWindows) {
        this.skip();
      }

      return spawnCli(dir, {
        reporter: 'none',
        projects: ['https://github.com/bahmutov/dont-break-bar']
      }).then(stderr => {
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

        rimraf.sync(checkoutDir);

        if (error) {
          throw error;
        }
      });
    });

    it('should have written an HTML report to a suffixed directory', function() {
      if (isTravisWindows) {
        this.skip();
      }

      const reportDir = path.join(dir, 'breakage', 'subfolder');

      return spawnCli(dir, {
        reporter: 'html',
        projects: ['https://github.com/bahmutov/dont-break-bar'],
        reportSuffix: 'subfolder'
      }).then(() => {
        let error;
        try {
          expect(fs.existsSync(reportDir), 'to be true');
        } catch (e) {
          error = e;
        }

        rimraf.sync(reportDir);

        if (error) {
          throw error;
        }
      });
    });
  });

  describe('when used with stdin', () => {
    it('should accept JSON', function() {
      const dir = path.join(path.join(__dirname, 'cli-projects'));
      const cli = spawnCli(dir, {
        stdin: true
      });

      const stdinObject = { package: 'fugl', projects: [] };
      cli._spawn.stdin.write(JSON.stringify(stdinObject));
      cli._spawn.stdin.end();

      return expect(
        () => cli,
        'to be rejected with',
        /Fugl: no projects specified/
      );
    });

    it('should accept project name strings', function() {
      const dir = path.join(path.join(__dirname, 'cli-package'));
      const buildsDir = path.join(path.join(dir, 'builds'));
      const checkoutDir = path.join(
        buildsDir,
        'https-github-com-bahmutov-dont-break-bar'
      );
      const cli = spawnCli(dir, {
        stdin: true,
        folder: dir
      });

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

        rimraf.sync(checkoutDir);

        if (error) {
          throw error;
        }
      });
    });
  });
});
