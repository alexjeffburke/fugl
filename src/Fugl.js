var la = require('./la');
var check = require('check-more-types');
var EventEmitter = require('events');
var path = require('path');
var chdir = require('chdir-promise');
var mkdirp = require('mkdirp');
var debug = require('debug')('dont-break');
var _ = require('lodash');
var fs = require('fs-extra');
var exists = require('fs').existsSync;

var npm = require('top-dependents');
var stripComments = require('strip-json-comments');
// write found dependencies into a hidden file
var dontBreakFilename = './.dont-break.json';

var testDependent = require('./test-dependent');

var MOCHA_HTML_DOCUMENT = `<html>
  <head>
    <link href="index.css" rel="stylesheet">
  <head>
  <body>
    <div id="mocha"></div>
  </body>
</html>
`;

function saveTopDependents(name, metric, n) {
  la(check.unemptyString(name), 'invalid package name', name);
  la(check.unemptyString(metric), 'invalid metric', metric);
  la(check.positiveNumber(n), 'invalid top number', n);

  var fetchTop = _.partial(npm.downloads, metric);
  return npm
    .topDependents(name, n)
    .then(fetchTop)
    .then(npm.sortedByDownloads)
    .then(function(dependents) {
      la(
        check.array(dependents),
        'cannot select top n, not a list',
        dependents
      );
      console.log(
        'limiting top downloads to first',
        n,
        'from the list of',
        dependents.length
      );
      return _.take(dependents, n);
    })
    .then(function saveToFile(topDependents) {
      la(
        check.arrayOfStrings(topDependents),
        'expected list of top strings',
        topDependents
      );
      // TODO use template library instead of manual concat
      var str =
        '// top ' +
        n +
        ' most dependent modules by ' +
        metric +
        ' for ' +
        name +
        '\n';
      str += '// data from NPM registry on ' + new Date().toDateString() + '\n';
      str += JSON.stringify(topDependents, null, 2) + '\n';
      return fs.writeFile(dontBreakFilename, str, 'utf-8').then(function() {
        console.log(
          'saved top',
          n,
          'dependents for',
          name,
          'by',
          metric,
          'to',
          dontBreakFilename
        );
        return topDependents;
      });
    });
}

function getDependentsFromFile(options) {
  debug('getDependentsFromFile in %s', options.folder);

  return chdir
    .to(options.folder)
    .then(() => fs.readFile(dontBreakFilename, 'utf-8'))
    .then(stripComments)
    .then(function(text) {
      debug('loaded dependencies file', text);
      return text;
    })
    .then(JSON.parse)
    .catch(function(err) {
      // the file does not exist probably
      console.log(err && err.message);
      console.log(
        'could not find file',
        dontBreakFilename,
        'in',
        options.folder
      );
      console.log(
        'no dependent projects, maybe query NPM for projects that depend on this one.'
      );
      return [];
    })
    .then(data => {
      if (Array.isArray(data)) {
        data = { projects: data };
      }

      return chdir.back().then(() => data);
    });
}

function currentPackageName(options) {
  try {
    const pkg = require(path.join(options.folder, 'package.json'));
    if (!pkg.name) {
      throw new Error(`The package in ${options.folder} has no name.`);
    }
    return pkg.name;
  } catch (e) {
    throw new Error(`The folder ${options.folder} contain no valid package.`);
  }
}

function determinePackage(options) {
  if (options.package) {
    return options.package;
  } else {
    return currentPackageName(options);
  }
}

function parsePackage(packageString) {
  if (typeof packageString !== 'string' || packageString.trim().length === 0) {
    throw new Error(`Invalid package @{package}`);
  }

  let packageParts;
  let name;
  if (packageString[0] === '@') {
    packageParts = packageString.slice(1).split('@');
    name = '@';
  } else {
    packageParts = packageString.split('@');
    name = '';
  }

  name += packageParts[0];

  let version = null;
  if (packageParts.length === 2) {
    version = packageParts[1];
  } else {
    version = null;
  }

  return { name, version };
}

function getDependents(options) {
  options = options || {};
  var forName = options.packageName;

  debug('getting dependents for %s', forName);

  var metric, n;
  if (check.number(options.topDownloads)) {
    metric = 'downloads';
    n = options.topDownloads;
  } else if (check.number(options.topStarred)) {
    metric = 'starred';
    n = options.topStarred;
  }

  var firstStep;
  if (check.unemptyString(metric) && check.number(n)) {
    firstStep = saveTopDependents(forName, metric, n);
  } else {
    firstStep = Promise.resolve();
  }

  return firstStep.then(() => getDependentsFromFile(options));
}

function checkConfig(loadedConfig) {
  const dependents = loadedConfig.projects;

  if (
    !(
      check.arrayOf(check.object, dependents) ||
      check.arrayOfStrings(dependents)
    )
  ) {
    la(false, 'invalid dependents');
  }

  const projects = dependents.map(project => {
    if (typeof project === 'string') {
      return { name: project.trim() };
    } else {
      return project;
    }
  });

  const config = { projects };

  ['install', 'postinstall', 'test'].forEach(configKey => {
    if (typeof loadedConfig[configKey] === 'string') {
      config[configKey] = loadedConfig[configKey];
    }
  });

  return config;
}

class Fugl {
  constructor(options) {
    this.options = options = options || {};
    options.folder = options.folder || process.cwd();
    options.noClean = !!options.noClean;
    options.pretest =
      typeof options.pretest === 'undefined' ? true : !!options.pretest;
    options.reporter = options.reporter || 'console';
    options.reportDir =
      options.reportDir || path.resolve(options.folder, 'breakage');
    options.tmpDir = options.tmpDir
      ? path.resolve(options.tmpDir)
      : path.resolve(options.folder, 'builds');

    this.config = options.config ? Object.assign({}, options.config) : {};
    const packageInfo = parsePackage(determinePackage(options));
    this.config.packageName = packageInfo.name;
    this.config.packageVersion = packageInfo.version || 'latest';
  }

  configForDependent(dependent) {
    return Object.assign(
      {
        pretest: this.options.pretest
      },
      this.config,
      dependent
    );
  }

  testDependent(emitter, options, dependent) {
    return testDependent(emitter, options, dependent);
  }

  testDependents() {
    const options = this.options;
    const config = this.config;
    const stats = {
      passes: 0,
      failures: 0
    };

    la(check.array(config.projects), 'expected dependents', config.projects);

    const emitter = new EventEmitter();
    emitter.on('pass', () => (stats.passes += 1));
    emitter.on('fail', () => (stats.failures += 1));

    let reporter;
    if (options.reporter !== 'console' && options.reporter !== 'none') {
      try {
        if (options.reporter === 'html') {
          const jsdom = require('jsdom');
          const dom = new jsdom.JSDOM(MOCHA_HTML_DOCUMENT);
          // disable canvas
          dom.window.HTMLCanvasElement.prototype.getContext = null;
          global.window = dom.window;
          global.document = dom.window.document;
          global.fragment = html => new dom.window.DocumentFragment(html);
        }
        const Reporter = require(`mocha/lib/reporters/${options.reporter}`);
        reporter = new Reporter(emitter);
      } catch (e) {
        // ignore
      }
    }

    if (!reporter && options.reporter === 'console') {
      emitter.once('start', () => console.log());
      emitter.on('pass', test => console.log(`  ${test.title} PASSED`));
      emitter.on('fail', test => console.log(`  ${test.title} FAILED`));
    }

    emitter.emit('start');

    // TODO switch to parallel testing!
    return config.projects
      .reduce((prev, dependent) => {
        return prev.then(() => {
          return this.testDependent(
            emitter,
            options,
            this.configForDependent(dependent)
          );
        });
      }, Promise.resolve(true))
      .then(() => {
        emitter.emit('end');
      })
      .then(() => {
        if (options.reporter === 'html') {
          fs.ensureDirSync(options.reportDir);
          fs.copyFileSync(
            require.resolve('mocha/mocha.css'),
            path.join(options.reportDir, 'index.css')
          );
          fs.writeFileSync(
            path.join(options.reportDir, 'index.html'),
            document.documentElement.outerHTML
          );
        }
      })
      .then(() => stats);
  }

  run() {
    const options = this.options;

    if (!exists(options.folder)) {
      mkdirp.sync(options.folder);
    }

    debug('working in folder %s', options.folder);

    let start;
    if (check.arrayOfStrings(options.projects)) {
      start = Promise.resolve({ projects: options.projects });
    } else {
      start = getDependents(options);
    }

    return start.then(config => {
      var checkedConfig = checkConfig(config);
      // update configuration
      this.config = Object.assign({}, this.config, checkedConfig);

      // update the top-level pretest flag
      if (typeof config.pretest === 'boolean') {
        options.pretest = config.pretest;
      }

      return this.testDependents();
    });
  }
}

module.exports = Fugl;
