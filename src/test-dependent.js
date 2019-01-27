var _ = require('lodash');
var check = require('check-more-types');
var debug = require('debug')('dont-break');
var fs = require('fs');
var path = require('path');

var la = require('./la');
var isRepoUrl = require('./is-repo-url');
var installDependent = require('./install-dependency');
var runInFolder = require('./run-in-folder');

var NAME_COMMAND_SEPARATOR = ':';
var DEFAULT_INSTALL_COMMAND = 'npm install';
var DEFAULT_TEST_COMMAND = 'npm test';
var INSTALL_TIMEOUT_SECONDS = 2 * 60 * 1000; // 2 minutes

function testInFolder(emitter, dependent, testCommand, folder) {
  const test = {
    title: dependent.name,
    body: '',
    duration: 0,
    fullTitle: () => dependent.name,
    slow: () => 0
  };

  return runInFolder(folder, testCommand, {
    success: () => emitter.emit('pass', test),
    failure: err => {
      emitter.emit('fail', test, err);
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

function testDependent(emitter, options, dependent) {
  var moduleInstallCommand = dependent.install || DEFAULT_INSTALL_COMMAND;
  var modulePostinstallCommand =
    dependent.postinstall ||
    `npm install ${options.packageName}@${options.packageVersion}`;
  var moduleTestCommand = dependent.test || DEFAULT_TEST_COMMAND;

  const moduleName = getDependencyName(dependent.name);

  la(check.unemptyString(moduleName), 'invalid dependent', moduleName);

  function formFullFolderName() {
    if (isRepoUrl(moduleName)) {
      // simple repo installation
      return toFolder;
    } else {
      let scoped = moduleName.startsWith('@');
      let idx = scoped ? 1 : 0;
      let moduleDir = moduleName.split('@')[idx];
      moduleDir = scoped ? `@${moduleDir}` : moduleDir;
      return path.join(toFolder, 'node_modules', moduleDir);
    }
  }

  var cwd = process.cwd();
  process.env.CURRENT_MODULE_NAME = moduleName;
  process.env.CURRENT_MODULE_DIR = cwd;

  function expandCommandVars(command) {
    if (!command) {
      return command;
    }
    command = command.replace('$CURRENT_MODULE_DIR', cwd);
    command = command.replace('$CURRENT_MODULE_NAME', moduleName);
    return command;
  }

  function postInstallModuleInFolder(dependentFolder) {
    var command = expandCommandVars(modulePostinstallCommand);
    return runInFolder(dependentFolder, command, {
      success: 'postinstall succeeded',
      failure: 'postinstall did not work'
    });
  }

  var safeName = _.kebabCase(_.deburr(moduleName));
  debug('original name "%s", safe "%s"', moduleName, safeName);
  var toFolder = path.join(options.tmpDir, safeName);
  debug('testing folder %s', toFolder);

  var timeoutSeconds = options.timeout || INSTALL_TIMEOUT_SECONDS;
  la(
    check.positiveNumber(timeoutSeconds),
    'wrong timeout',
    timeoutSeconds,
    options
  );

  var installOptions = {
    moduleName,
    toFolder,
    cmd: expandCommandVars(moduleInstallCommand)
  };

  var res = Promise.race([
    installDependent(installOptions),
    new Promise(resolve =>
      setTimeout(() => resolve({ timeout: true }), timeoutSeconds)
    )
  ])
    .then(result => {
      if (result && result.timeout) {
        debug('install timed out for ' + moduleName);
        throw new Error('timeout');
      }
      return result;
    })
    .then(formFullFolderName)
    .then(function checkInstalledFolder(folder) {
      la(check.unemptyString(folder), 'expected folder', folder);
      la(fs.existsSync(folder), 'expected folder to exist', folder);
      return folder;
    });

  var testWithPreviousVersion = dependent.pretest;
  if (testWithPreviousVersion) {
    var modulePretestCommand;
    if (check.type('string', testWithPreviousVersion)) {
      modulePretestCommand = testWithPreviousVersion;
    } else {
      modulePretestCommand = moduleTestCommand;
    }
    res = res.then(postInstallModuleInFolder).then(folder => {
      return testInFolder(emitter, dependent, modulePretestCommand, folder);
    });
  }

  const test = {
    title: dependent.name,
    body: '',
    duration: 0,
    fullTitle: () => dependent.name,
    slow: () => 0
  };

  return res
    .then(postInstallModuleInFolder)
    .then(folder => {
      return testInFolder(emitter, dependent, moduleTestCommand, folder);
    })
    .then(() => emitter.emit('pass', test))
    .catch(err => emitter.emit('fail', test, err));
}

module.exports = testDependent;
