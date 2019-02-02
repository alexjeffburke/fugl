var check = require('check-more-types');

var runInFolder = require('./run-in-folder');

var DEFAULT_TEST_COMMAND = 'npm test';

function testDependent({ moduleName, toFolder, ...options }, dependent) {
  var performDependentInstall = options._runInFolder || runInFolder;
  var performDependentTest = options._testInFolder || runInFolder;
  var modulePostinstallCommand =
    dependent.postinstall ||
    `npm install ${dependent.packageName}@${dependent.packageVersion}`;
  var moduleTestCommand = dependent.test || DEFAULT_TEST_COMMAND;

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
    return performDependentInstall(dependentFolder, command, {
      success: 'postinstall succeeded',
      failure: 'postinstall did not work'
    }).then(() => dependentFolder);
  }

  function testModuleInFolder(dependentFolder, testCommand) {
    return performDependentTest(dependentFolder, testCommand, {
      success: 'testing module succeeded',
      failure: 'testing module failed'
    }).then(() => dependentFolder);
  }

  var res = Promise.resolve(toFolder);

  var testWithPreviousVersion = dependent.pretest;
  if (testWithPreviousVersion) {
    var modulePretestCommand;
    if (check.type('string', testWithPreviousVersion)) {
      modulePretestCommand = testWithPreviousVersion;
    } else {
      modulePretestCommand = moduleTestCommand;
    }
    res = res.then(postInstallModuleInFolder).then(folder => {
      return testModuleInFolder(folder, modulePretestCommand).then(
        () => folder
      );
    });
  }

  return res.then(postInstallModuleInFolder).then(folder => {
    return testModuleInFolder(folder, moduleTestCommand).then(() => folder);
  });
}

module.exports = testDependent;
