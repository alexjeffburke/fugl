const Fugl = require('../src/Fugl');

module.exports = function main(cwd, yargv) {
  const options = {
    package: yargv.package,
    folder: yargv.folder || cwd,
    projects: yargv.projects,
    reporter: yargv.reporter,
    pretest: yargv.pretest,
    pretestOrIgnore: yargv.pretestOrIgnore,
    noClean: yargv.quick
  };

  if (!yargv.package && !yargv.folder) {
    // we may be running via npx
    options.package = cwd;
    options.packageInstaller = 'link';
  }

  return new Fugl(options).run().then(stats => {
    console.warn();
    if (stats.failures > 0) {
      console.error('completed with failures');
      process.exit(1);
    } else {
      console.warn('completed');
      process.exit(0);
    }
  });
};
