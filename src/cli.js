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

  return new Fugl(options).run().then(stats => {
    if (stats.failures > 0) {
      throw new Error('failed');
    }
  });
};
