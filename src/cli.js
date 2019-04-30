const os = require('os');
const path = require('path');

const Shoulder = require('shoulder');

const Fugl = require('../src/Fugl');
const packageCheck = require('../src/package-check');

exports.check = function check(cwd, yargv, options) {
  const fuglOptions = {
    package: yargv.package,
    folder: yargv.folder || cwd,
    projects: yargv.projects,
    reporter: yargv.reporter,
    pretest: yargv.pretest,
    pretestOrIgnore: yargv.pretestOrIgnore,
    timeout: yargv.timeout,
    noClean: yargv.quick,
    ci: yargv.ci
  };

  if (!yargv.package) {
    // we may be running via npx
    fuglOptions.package = cwd;
    fuglOptions.packageInstaller = 'link';
  }

  let osTmpDir = false;
  if (!yargv.folder) {
    osTmpDir = true;
    fuglOptions.osTmpDir = true;
    fuglOptions.tmpDir = path.join(os.tmpdir(), 'fugl');
  }

  options = options || {};
  const FuglConstructor = options._Fugl || Fugl;
  const exit = options._exit || process.exit;
  const warn = options._warn || console.warn;

  return new FuglConstructor(fuglOptions).run().then(stats => {
    warn();
    if (osTmpDir) {
      warn(`builds located in ${fuglOptions.tmpDir}`);
    }
    if (stats.failures > 0) {
      warn('completed with failures');
      exit(1);
    } else {
      warn('completed');
      exit(0);
    }
  });
};

exports.fetch = function fetch(cwd, yargv, options) {
  const shoulderOptions = {
    package: yargv.package
  };
  const runOptions = {
    metric: yargv.metric,
    librariesIoApiKey: yargv.librariesio
  };

  options = options || {};
  const ShoulderConstructor = options._Shoulder || Shoulder;
  const log = options._log || console.log;

  return new ShoulderConstructor(shoulderOptions)
    .run(runOptions)
    .then(projectNames => {
      const output = {};

      // include the package name in the output if:
      // - we were an arbitrary call
      // - we were called within a package that did not match
      const packageName = shoulderOptions.package;
      const cwdPackage = packageCheck.safe(cwd);
      if (!cwdPackage || cwdPackage.name !== packageName) {
        output.package = packageName;
      }

      // include the projects list
      output.projects = projectNames;

      log(JSON.stringify(output, null, 2));
    });
};
