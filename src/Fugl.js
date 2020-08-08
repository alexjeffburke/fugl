var _ = require('lodash');
var debug = require('./debug').extend('Fugl');
var EventEmitter = require('events');
var fs = require('fs');
var fsExtra = require('fs-extra');
var path = require('path');

var installDependent = require('./install-dependent');
var LinkStrategy = require('./LinkStrategy');
var NpmStrategy = require('./NpmStrategy');
var Project = require('./Project');
var testDependent = require('./test-dependent');

var IS_PLATFORM_WHIMSY = ['linux', 'darwin'].includes(process.platform);
var MOCHA_HTML_DOCUMENT = `<html>
  <head>
    <link href="index.css" rel="stylesheet">
  <head>
  <body>
    <div id="mocha"></div>
  </body>
</html>
`;

function checkConfig(loadedConfig) {
  const projects = loadedConfig.projects.map(project => {
    try {
      return new Project(project);
    } catch (e) {
      throw new Error(`Fugl: ${e.message}`);
    }
  });

  const config = { projects };

  ['install', 'afterinstall', 'postinstall', 'test', 'aftertest'].forEach(
    configKey => {
      if (typeof loadedConfig[configKey] === 'string') {
        config[configKey] = loadedConfig[configKey];
      }
    }
  );

  return Object.assign({}, loadedConfig, config);
}

class Fugl extends EventEmitter {
  constructor(options) {
    super();

    if (!(options && typeof options === 'object')) {
      throw new Error('Fugl: missing options');
    }

    this.options = options = Object.assign({}, options);

    if (!options.package) {
      throw new Error('Fugl: missing package');
    }

    if (!options.folder) {
      throw new Error('Fugl: missing folder');
    }

    if (!Array.isArray(options.projects)) {
      throw new Error('Fugl: missing projects');
    }

    if (typeof options.timeout === 'number' && isNaN(options.timeout)) {
      throw new Error('Fugl: invalid timeout');
    }

    options.ci = !!options.ci;
    options.noClean = !!options.noClean;
    options.pretest =
      typeof options.pretest === 'undefined' ? true : !!options.pretest;
    options.pretestOrIgnore = options.pretestOrIgnore || false;
    options.reporter = options.reporter || 'console';
    const reportSuffix =
      typeof options.reportSuffix === 'string' ? options.reportSuffix : '';
    options.reportDir = options.reportDir
      ? path.resolve(options.reportDir)
      : path.resolve(options.folder, 'breakage', reportSuffix);
    options.tmpDir = options.tmpDir
      ? path.resolve(options.tmpDir, 'builds')
      : path.resolve(options.folder, 'builds');

    if (!options.pretest && options.pretestOrIgnore) {
      throw new Error('Fugl: cannot pretestOrIgnore without pretest');
    }

    const config = options.config ? Object.assign({}, options.config) : {};
    if (!config.projects) {
      config.projects = options.projects;
      delete options.projects;
    }
    this.config = checkConfig(config);

    this.packageInstaller = null;

    const packageInstaller = options.packageInstaller || 'npm';
    delete options.packageInstaller;

    switch (packageInstaller) {
      case 'link':
        this.packageInstaller = new LinkStrategy(options.package);
        break;
      case 'npm':
        this.packageInstaller = new NpmStrategy(options.package);
        break;
      default:
        throw new Error(
          `Fugl: unsupported package installer ${packageInstaller}`
        );
    }
  }

  configForDependent(project) {
    return Object.assign(
      {
        pretest: this.options.pretest
      },
      this.config,
      project.toDependent()
    );
  }

  async executeDependent(emitter, project) {
    const test = {
      title: project.name,
      body: '',
      duration: 0,
      fullTitle: () => project.name,
      titlePath: () => [project.name],
      isPending: () => false,
      currentRetry: () => 0,
      slow: () => 0
    };

    let dependent;
    let dependentOptions;
    const startTime = Date.now();

    emitter.emit('test', test);

    let executionResults;
    try {
      await this.checkProject(project);

      const { options, packageInstaller } = this;

      const moduleName = project.repoUrl;
      const safeName = _.kebabCase(_.deburr(moduleName));
      debug('original name "%s", safe "%s"', moduleName, safeName);

      const toFolder = path.join(options.tmpDir, safeName);
      debug('testing folder %s', toFolder);

      dependent = this.configForDependent(project);
      dependentOptions = Object.assign({}, options, {
        packageInstaller,
        moduleName,
        toFolder
      });

      await this.installDependent(dependentOptions, dependent);
      executionResults = await this.testDependent(dependentOptions, dependent);
    } catch (error) {
      executionResults = { packagetest: { status: 'fail', error } };
    }

    let executionResult;
    const pretestResult = executionResults.pretest || { status: 'none' };
    if (pretestResult.status === 'fail') {
      test.title += ' (pretest)';
      executionResult = pretestResult;
    } else if (pretestResult.status === 'pending') {
      test.title += ' (skipped)';
      executionResult = pretestResult;
    } else {
      executionResult = executionResults.packagetest;
    }

    // update how long the test took
    const endTime = Date.now();
    test.duration = endTime - startTime;

    if (executionResult.status === 'pending') {
      // identify it as such
      test.isPending = () => true;
    }

    switch (executionResult.status) {
      case 'pass':
        debug('execution passed for %s', project.name);
        emitter.emit('pass', test);
        break;
      case 'fail':
        debug(
          'execution failed for %s: %s',
          project.name,
          executionResult.error
        );
        emitter.emit('fail', test, executionResult.error);
        break;
      case 'pending':
        debug('execution skipped for %s', project.name);
        emitter.emit('pending', test);
        break;
    }

    emitter.emit('test end', test);

    return test;
  }

  checkProject(project) {
    return project.verify('repoUrl');
  }

  installDependent(options, dependent) {
    return installDependent(options, dependent);
  }

  testDependent(options, dependent) {
    return testDependent(options, dependent);
  }

  async testDependents(options) {
    const config = this.config;

    if (config.projects.length === 0) {
      throw new Error('Fugl: no projects specified');
    }

    // begin setting up a "mocha-esque" runner
    const emitter = this;

    const stats = {
      tests: config.projects.length,
      start: 0,
      duration: 0, // support epilogue generation
      passes: 0,
      failures: 0,
      skipped: 0
    };
    // hold a reference to stats as it is taken by reporters
    this.stats = stats;

    // keep a running count of executed tests to support progress
    this.total = 0;

    emitter.on('pass', () => (stats.passes += 1));
    emitter.on('fail', () => (stats.failures += 1));
    emitter.on('pending', () => (stats.skipped += 1));

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

          emitter.on('end', () => {
            if (!fs.existsSync(options.reportDir)) {
              fsExtra.mkdirpSync(options.reportDir);
            }
            fsExtra.copySync(
              require.resolve('mocha/mocha.css'),
              path.join(options.reportDir, 'index.css')
            );
            fs.writeFileSync(
              path.join(options.reportDir, 'index.html'),
              dom.window.document.documentElement.outerHTML
            );
          });
        }
        const Reporter = require(`mocha/lib/reporters/${options.reporter}`);
        reporter = new Reporter(emitter);
      } catch (e) {
        // ignore
      }
    }

    if ((!reporter && options.reporter === 'console') || options.ci) {
      const print = options.ci ? console.warn : console.log;

      emitter.once('start', () => print());
      emitter.on('pass', test => print(`  ${test.title} PASSED`));
      emitter.on('fail', test => print(`  ${test.title} FAILED`));
      emitter.on('fail', (_, error) => print(`${error}\n`));
      emitter.on('pending', test => print(`  ${test.title} SKIPPED`));
    }

    // update the start time
    stats.start = Date.now();

    emitter.emit('start');

    // TODO switch to parallel testing!
    for (const project of config.projects) {
      // record the execution of a test
      this.total += 1;

      const executionResult = await this.executeDependent(emitter, project);

      // update overall duration with this test
      stats.duration += executionResult.duration;
    }

    emitter.emit('end');

    return stats;
  }

  run() {
    const options = this.options;

    if (!fs.existsSync(options.folder)) {
      fsExtra.mkdirpSync(options.folder);
    }

    if (options.osTmpDir) {
      if (!fs.existsSync(options.tmpDir)) {
        fsExtra.mkdirpSync(options.tmpDir);
      }

      if (IS_PLATFORM_WHIMSY) {
        try {
          fs.writeFileSync(path.join(options.tmpDir, '..', '🐦'), '');
        } catch (e) {}
      }
    }

    debug('package: %s', options.package);
    debug('folder: %s', options.folder);

    return this.testDependents(options);
  }
}

module.exports = Fugl;
