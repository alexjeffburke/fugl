var debug = require('./debug').extend('testDependent');
var runInFolder = require('./run-in-folder');

var DEFAULT_TEST_COMMAND = 'npm test';

async function moduleTestInFolder(cmd, cmdKey, { toFolder, dependent }) {
  if (!cmd) {
    debug('%s command skipped for %s', cmdKey, dependent.name);
    return toFolder;
  }

  debug('%s command for %s', cmdKey, dependent.name);

  try {
    await testDependent.runInFolder(toFolder, cmd);

    debug('%s command succeeded for %s', cmdKey, dependent.name);
    return toFolder;
  } catch (error) {
    debug('%s command failed for %s', cmdKey, dependent.name);
    throw error;
  }
}

async function testDependent(options, dependent) {
  const { moduleName, toFolder } = options;
  const testOptions = { toFolder, dependent };
  var packageInstaller = options.packageInstaller;
  var moduleTestCommand = dependent.test || DEFAULT_TEST_COMMAND;

  process.env.CURRENT_MODULE_NAME = moduleName;
  process.env.CURRENT_MODULE_DIR = options.folder;

  var result = {};

  async function withResult(resultType, promise) {
    result[resultType] = {
      status: null
    };
    const testResult = result[resultType];

    try {
      await promise;

      testResult.status = 'pass';
    } catch (error) {
      testResult.status = 'fail';
      testResult.error = error;
    }
  }

  var testWithPreviousVersion = dependent.pretest;
  if (testWithPreviousVersion) {
    var modulePretestCommand;
    if (typeof testWithPreviousVersion === 'string') {
      modulePretestCommand = testWithPreviousVersion;
    } else {
      modulePretestCommand = moduleTestCommand;
    }

    await withResult(
      'pretest',
      moduleTestInFolder(modulePretestCommand, 'pretest', testOptions)
    );
  }

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

  await packageInstaller.installTo({ toFolder }, dependent);
  await withResult(
    'packagetest',
    moduleTestInFolder(moduleTestCommand, 'packagetest', testOptions)
  );
  await moduleTestInFolder(dependent.aftertest, 'aftertest', testOptions);

  return result;
}

testDependent.runInFolder = runInFolder;

module.exports = testDependent;
