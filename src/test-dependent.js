var debug = require('./debug').extend('testDependent');
var runInFolder = require('./run-in-folder');

var DEFAULT_TEST_COMMAND = 'npm test';

function testDependent(options, dependent) {
  const { moduleName, toFolder } = options;
  var packageInstaller = options.packageInstaller;
  var performDependentTest = options._testInFolder || runInFolder;
  var moduleTestCommand = dependent.test || DEFAULT_TEST_COMMAND;

  process.env.CURRENT_MODULE_NAME = moduleName;
  process.env.CURRENT_MODULE_DIR = options.folder;

  function testModuleInFolder(dependentFolder, testCommand) {
    debug('testing for %s', dependent.name);

    return performDependentTest(dependentFolder, testCommand)
      .then(() => {
        debug('testing succeeded for %s', dependent.name);
        return dependentFolder;
      })
      .catch(error => {
        debug('testing failed for %s', dependent.name);
        throw error;
      });
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
    if (typeof testWithPreviousVersion === 'string') {
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

    return Promise.resolve()
      .then(() => packageInstaller.installTo({ toFolder }, dependent))
      .then(() => folder)
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
