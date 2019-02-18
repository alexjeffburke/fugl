const Fugl = require('../src/Fugl');
const ModuleStats = require('../src/ModuleStats');

exports.check = function check(cwd, yargv) {
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

exports.fetch = function fetch(cwd, yargv, options) {
  const packageName = yargv.package;
  const statsOptions = {
    librariesIoApiKey: yargv.librariesio || null
  };

  options = options || {};
  const ModuleStatsConstructor = options._ModuleStats || ModuleStats;
  const log = options._log || console.log;

  return new ModuleStatsConstructor(packageName, statsOptions)
    .fetchDepedentsWithMetric('downloads')
    .then(metricResult =>
      ModuleStatsConstructor.packageNamesByMagnitude(metricResult)
    )
    .then(projects => {
      log(JSON.stringify({ projects }, null, 2));
    });
};
