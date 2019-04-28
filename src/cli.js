const os = require('os');
const path = require('path');

const Fugl = require('../src/Fugl');
const ModuleStats = require('../src/ModuleStats');
const Project = require('../src/Project');
const ProjectStats = require('../src/ProjectStats');
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

function makeRequirementFromMetric(metric) {
  switch (metric) {
    case 'downloads':
      return 'npmName';
    case 'stars':
      return 'repoUrl';
  }
}

function verifyProjects(requirement, projects, options) {
  const ProjectStatsConstructor = options._ProjectStats || ProjectStats;

  return Promise.all(
    projects.map(project =>
      project.verify(requirement).catch(error => {
        if (error.isNotFatal) {
          console.warn(error.message);
          return null;
        } else {
          throw error;
        }
      })
    )
  )
    .then(projects => projects.filter(Boolean))
    .then(projects => new ProjectStatsConstructor(projects));
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
    .then(projects => verifyProjects(requirement, projects, options))
    .then(projectStats => projectStats.outputProjectNamesForMetric(metricName))
    .then(projects => {
      const output = {};

      // include the package name in the output if:
      // - we were an arbitrary call
      // - we were called within a package that did not match
      const cwdPackage = packageCheck.safe(cwd);
      if (!cwdPackage || cwdPackage.name !== packageName) {
        output.package = packageName;
      }

      // include the projects list
      output.projects = projects;

      log(JSON.stringify(output, null, 2));
    });
};
