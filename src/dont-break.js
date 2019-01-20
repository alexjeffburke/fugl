'use strict';

var la = require('lazy-ass');
var check = require('check-more-types');
var EventEmitter = require('events');
var path = require('path');
var osTmpdir = require('os-tmpdir');
var join = path.join;
var quote = require('quote');
var chdir = require('chdir-promise');
var debug = require('debug')('dont-break');
var isRepoUrl = require('./is-repo-url');

var _ = require('lodash');

var fs = require('fs-extra');
var exists = fs.existsSync;

var stripComments = require('strip-json-comments');
// write found dependencies into a hidden file
var dontBreakFilename = './.dont-break.json';

var MOCHA_HTML_DOCUMENT = `<html>
  <head>
    <link href="index.css" rel="stylesheet">
  <head>
  <body>
    <div id="mocha"></div>
  </body>
</html>
`;
var NAME_COMMAND_SEPARATOR = ':';
var DEFAULT_TEST_COMMAND = 'npm test';
var INSTALL_TIMEOUT_SECONDS = 3 * 60;

var install = require('./install-dependency');
var runInFolder = require('./run-in-folder');

var npm = require('top-dependents');
la(
  check.schema(
    {
      downloads: check.fn,
      sortedByDownloads: check.fn,
      topDependents: check.fn
    },
    npm
  ),
  'invalid npm methods',
  npm
);

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

function getDependentsFromFile() {
  return fs
    .readFile(dontBreakFilename, 'utf-8')
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
        quote(dontBreakFilename),
        'in',
        quote(process.cwd())
      );
      console.log(
        'no dependent projects, maybe query NPM for projects that depend on this one.'
      );
      return [];
    });
}

var currentPackageName = _.memoize(function() {
  var pkg = require(join(process.cwd(), 'package.json'));
  return pkg.name;
});

function getDependents(options, name) {
  options = options || {};
  var forName = name;

  if (!name) {
    forName = currentPackageName();
  }

  var firstStep;

  var metric, n;
  if (check.number(options.topDownloads)) {
    metric = 'downloads';
    n = options.topDownloads;
  } else if (check.number(options.topStarred)) {
    metric = 'starred';
    n = options.topStarred;
  }
  if (check.unemptyString(metric) && check.number(n)) {
    firstStep = saveTopDependents(forName, metric, n);
  } else {
    firstStep = Promise.resolve();
  }

  return firstStep.then(getDependentsFromFile);
}

function testInFolder(emitter, dependent, testCommand, folder) {
  return runInFolder(folder, testCommand, {
    missing: 'missing test command',
    success: () =>
      emitter.emit('pass', {
        title: dependent,
        body: '',
        duration: 0,
        fullTitle: () => dependent,
        slow: () => 0
      }),
    failure: err => {
      emitter.emit('fail', {
        title: dependent,
        fullTitle: () => dependent,
        err
      });
    }
  });
}

function getDependencyName(dependent) {
  if (isRepoUrl(dependent)) {
    debug('dependent is git repo url %s', dependent);
    return dependent;
  }
  const nameParts = dependent.split(NAME_COMMAND_SEPARATOR);
  la(nameParts.length, 'expected at least module name', dependent);
  const moduleName = nameParts[0].trim();
  return moduleName;
}

function testDependent(emitter, options, dependent, config) {
  var moduleTestCommand;
  var modulePostinstallCommand;
  var testWithPreviousVersion;
  if (check.string(dependent)) {
    dependent = { name: dependent.trim() };
  }

  dependent = Object.assign(
    { pretest: true, currentModuleInstall: 'npm install $CURRENT_MODULE_DIR' },
    config,
    dependent
  );
  moduleTestCommand = dependent.test;
  modulePostinstallCommand = dependent.postinstall || 'npm install';
  testWithPreviousVersion = dependent.pretest;
  var dependentInstall = dependent.install;

  dependent = dependent.name;

  la(check.unemptyString(dependent), 'invalid dependent', dependent);

  const moduleName = getDependencyName(dependent);

  function formFullFolderName() {
    if (isRepoUrl(dependent)) {
      // simple repo installation
      return toFolder;
    } else {
      let scoped = moduleName.startsWith('@');
      let idx = scoped ? 1 : 0;
      let moduleDir = moduleName.split('@')[idx];
      moduleDir = scoped ? `@${moduleDir}` : moduleDir;
      return join(toFolder, 'node_modules', moduleDir);
    }
  }

  // var nameParts = dependent.split(NAME_COMMAND_SEPARATOR)
  // la(nameParts.length, 'expected at least module name', dependent)
  // var moduleName = nameParts[0].trim()
  // var moduleTestCommand = nameParts[1] || DEFAULT_TEST_COMMAND
  moduleTestCommand = moduleTestCommand || DEFAULT_TEST_COMMAND;

  var cwd = process.cwd();
  var pkg = require(join(cwd, 'package.json'));
  process.env.CURRENT_MODULE_NAME = pkg.name;
  process.env.CURRENT_MODULE_DIR = cwd;

  function expandCommandVars(command) {
    if (!command) {
      return command;
    }
    command = command.replace('$CURRENT_MODULE_DIR', cwd);
    command = command.replace('$CURRENT_MODULE_NAME', pkg.name);
    return command;
  }

  function postInstallInFolder(dependentFolder, command) {
    if (command) {
      command = expandCommandVars(command);
      return runInFolder(dependentFolder, command, {
        success: 'postinstall succeeded',
        failure: 'postinstall did not work'
      });
    } else {
      return dependentFolder;
    }
  }

  var depName = pkg.name + '-v' + pkg.version + '-against-' + moduleName;
  var safeName = _.kebabCase(_.deburr(depName));
  debug('original name "%s", safe "%s"', depName, safeName);
  var toFolder = join(osTmpdir(), safeName);
  debug('testing folder %s', quote(toFolder));

  var timeoutSeconds = options.timeout || INSTALL_TIMEOUT_SECONDS;
  la(
    check.positiveNumber(timeoutSeconds),
    'wrong timeout',
    timeoutSeconds,
    options
  );

  var installOptions = {
    name: moduleName,
    prefix: toFolder,
    cmd: expandCommandVars(dependentInstall)
  };

  var postInstallModuleInFolder = _.partialRight(
    postInstallInFolder,
    modulePostinstallCommand
  );

  var res = install(installOptions)
    .timeout(timeoutSeconds * 1000, 'install timed out for ' + moduleName)
    .then(formFullFolderName)
    .then(function checkInstalledFolder(folder) {
      la(check.unemptyString(folder), 'expected folder', folder);
      la(exists(folder), 'expected folder to exist', folder);
      return folder;
    });

  if (testWithPreviousVersion) {
    var modulePretestCommand;
    if (check.type('string', testWithPreviousVersion)) {
      modulePretestCommand = testWithPreviousVersion;
    } else {
      modulePretestCommand = moduleTestCommand;
    }
    var pretestModuleInFolder = _.partial(testInFolder, modulePretestCommand);
    res = res.then(postInstallModuleInFolder).then(pretestModuleInFolder);
  }

  return res
    .then(postInstallModuleInFolder)
    .then(folder => {
      return testInFolder(emitter, dependent, moduleTestCommand, folder);
    })
    .catch(err => {
      emitter.emit('fail', {
        title: dependent,
        err
      });
    })
    .finally(function() {
      debug('restoring original directory', cwd);
      process.chdir(cwd);
    });
}

function testDependents(options, config) {
  var stats = {
    passes: 0,
    failures: 0
  };

  la(check.array(config.projects), 'expected dependents', config.projects);

  const emitter = new EventEmitter();
  emitter.on('pass', () => (stats.passes += 1));
  emitter.on('fail', () => (stats.failures += 1));

  let reporter;
  if (options.reporter !== 'console') {
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

  if (!reporter) {
    emitter.once('start', () => console.log());
    emitter.on('pass', test => console.log(`  ${test.title} PASSED`));
    emitter.on('fail', test => console.log(`  ${test.title} FAILED`));
  }

  emitter.emit('start');

  // TODO switch to parallel testing!
  return config.projects
    .reduce(function(prev, dependent) {
      return prev.then(function() {
        return testDependent(emitter, options, dependent, config);
      });
    }, Promise.resolve(true))
    .then(() => {
      emitter.emit('end');
    })
    .then(() => {
      if (options.reporter === 'html') {
        fs.ensureDirSync(options.reportDir);
        fs.copyFileSync(
          path.join(__dirname, '../node_modules/mocha/mocha.css'),
          path.join(options.reportDir, 'index.css')
        )
        fs.writeFileSync(
          path.join(options.reportDir, 'index.html'),
          document.documentElement.outerHTML
        );
      }
    });
}

function dontBreakDependents(options, dependents) {
  if (
    check.arrayOf(check.object, dependents) ||
    check.arrayOfStrings(dependents)
  ) {
    dependents = {
      projects: dependents
    };
  }
  la(
    check.arrayOf(function(item) {
      return check.object(item) || check.string(item);
    }, dependents.projects),
    'invalid dependents',
    dependents.projects
  );
  debug('testing the following dependents', JSON.stringify(dependents));
  if (check.empty(dependents)) {
    return Promise.resolve();
  }

  return testDependents(options, dependents);
}

function dontBreak(options) {
  if (check.unemptyString(options)) {
    options = {
      folder: options
    };
  }
  options = options || {};
  options.folder = options.folder || process.cwd();
  options.reporter = options.reporter || 'console';
  options.reportDir = options.reportDir || path.resolve(options.folder, 'breakage');

  debug('working in folder %s', options.folder);
  var start = chdir.to(options.folder);

  if (check.arrayOfStrings(options.dep)) {
    start = start.then(function() {
      return options.dep;
    });
  } else {
    start = start.then(function() {
      debug('getting dependents');
      return getDependents(options);
    });
  }

  return start
    .then(dependents => {
      return dontBreakDependents(options, dependents);
    })
    .then(stats => {
      return chdir.back().then(() => stats);
    })
    .then(stats => {
      if (stats.fail > 0) {
        throw new Error('failed');
      }
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = dontBreak;
