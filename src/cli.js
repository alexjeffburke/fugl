const os = require('os');
const path = require('path');

const Fugl = require('../src/Fugl');

exports.check = function check(cwd, yargv, options) {
  const fuglOptions = {
    package: yargv.package,
    folder: yargv.folder || cwd,
    projects: yargv.projects,
    reporter: yargv.reporter,
    pretest: yargv.pretest,
    pretestOrIgnore: yargv.pretestOrIgnore,
    reportSuffix: yargv.reportSuffix,
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
