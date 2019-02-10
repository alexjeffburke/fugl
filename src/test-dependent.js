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

  process.env.CURRENT_MODULE_NAME = moduleName;
  process.env.CURRENT_MODULE_DIR = options.folder;

  function expandCommandVars(command) {
    if (!command) {
      return command;
    }
    command = command.replace('$CURRENT_MODULE_DIR', options.folder);
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

  var result = {};

  function withResult(resultType, promise) {
    result[resultType] = {
      status: null
    };
    const testResult = result[resultType];

    return promise
      .then(() => {
        testResult.status = 'pass';
      })
      .catch(error => {
        testResult.status = 'fail';
        testResult.error = error;
      });
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
    res = res.then(folder =>
      withResult(
        'pretest',
        testModuleInFolder(folder, modulePretestCommand)
      ).then(() => folder)
    );
  }

  return res.then(folder => {
    if (
      options.pretestOrIgnore &&
      result.pretest &&
      result.pretest.status === 'fail'
    ) {
      // A failure has occurred in the presence of the ignore flag.
      // Immediately mark it for the parent and skip test execution.
      return {
        pretest: {
          status: 'pending'
        }
      };
    }

    return Promise.resolve(folder)
      .then(postInstallModuleInFolder)
      .then(folder =>
        withResult(
          'packagetest',
          testModuleInFolder(folder, moduleTestCommand)
        ).then(() => folder)
      )
      .then(() => result);
  });
}

module.exports = testDependent;
