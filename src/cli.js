const Fugl = require('../src/Fugl');
const ModuleStats = require('../src/ModuleStats');
const Project = require('../src/Project');

exports.check = function check(cwd, yargv, options) {
  const fuglOptions = {
    package: yargv.package,
    folder: yargv.folder || cwd,
    projects: yargv.projects,
    reporter: yargv.reporter,
    pretest: yargv.pretest,
    pretestOrIgnore: yargv.pretestOrIgnore,
    noClean: yargv.quick,
    ci: yargv.ci
  };

  if (!yargv.package && !yargv.folder) {
    // we may be running via npx
    fuglOptions.package = cwd;
    fuglOptions.packageInstaller = 'link';
  }

  options = options || {};
  const FuglConstructor = options._Fugl || Fugl;
  const exit = options._exit || process.exit;
  const warn = options._warn || console.warn;

  return new FuglConstructor(fuglOptions).run().then(stats => {
    warn();
    if (stats.failures > 0) {
      warn('completed with failures');
      exit(1);
    } else {
      warn('completed');
      exit(0);
    }
  });
};

function makeRequirementFromMetric(metric) {
  switch (metric) {
    case 'downloads':
      return 'npmName';
    case 'stars':
      return 'repoUrl';
  }
}

function verifyProjects(requirement, projects) {
  return Promise.all(projects.map(project => project.verify(requirement)));
}

exports.fetch = function fetch(cwd, yargv, options) {
  const packageName = yargv.package;
  const metricName = yargv.metric;
  const requirement = makeRequirementFromMetric(metricName);
  const statsOptions = {
    librariesIoApiKey: yargv.librariesio || null
  };

  options = options || {};
  const ModuleStatsConstructor = options._ModuleStats || ModuleStats;
  const log = options._log || console.log;

  const moduleStats = new ModuleStatsConstructor(packageName, statsOptions);
  return moduleStats
    .fetchDependents()
    .then(dependents => dependents.map(dependent => new Project(dependent)))
    .then(projects => verifyProjects(requirement, projects))
    .then(projects => moduleStats.fetchMetricForProjects(metricName, projects))
    .then(metricResult =>
      ModuleStatsConstructor.packageNamesByMagnitude(metricResult)
    )
    .then(projects => {
      log(JSON.stringify({ projects }, null, 2));
    });
};
