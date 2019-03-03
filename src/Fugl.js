var _ = require('lodash');
var copyFileSync = require('fs-copy-file-sync');
var debug = require('./debug');
var EventEmitter = require('events');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var installDependent = require('./install-dependent');
var LinkStrategy = require('./LinkStrategy');
var NpmStrategy = require('./NpmStrategy');
var Project = require('./Project');
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

function checkConfig(loadedConfig) {
  const projects = loadedConfig.projects.map(project => {
    try {
      return new Project(project);
    } catch (e) {
      throw new Error(`Fugl: ${e.message}`);
    }
  });

  const config = { projects };

  ['install', 'postinstall', 'test'].forEach(configKey => {
    if (typeof loadedConfig[configKey] === 'string') {
      config[configKey] = loadedConfig[configKey];
    }
  });

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

    options.ci = !!options.ci;
    options.noClean = !!options.noClean;
    options.pretest =
      typeof options.pretest === 'undefined' ? true : !!options.pretest;
    options.pretestOrIgnore = options.pretestOrIgnore || false;
    options.reporter = options.reporter || 'console';
    options.reportDir = options.reportDir
      ? path.resolve(options.reportDir)
      : path.resolve(options.folder, 'breakage');
    options.tmpDir = options.tmpDir
      ? path.resolve(options.tmpDir)
      : path.resolve(options.folder, 'builds');

    if (!options.pretest && options.pretestOrIgnore) {
      throw new Error('Fugl: cannot pretestOrIgnore without pretest');
    }

    if (options.ci && options.reporter === 'json') {
      throw new Error('Fugl: the JSON reporter conflicts with CI mode');
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

  executeDependent(emitter, project) {
    const test = {
      title: project.name,
      body: '',
      duration: 0,
      fullTitle: () => project.name,
      isPending: () => false,
      currentRetry: () => 0,
      slow: () => 0
    };

    let dependent;
    let dependentOptions;
    const startTime = Date.now();

    emitter.emit('test begin', test);

    return Promise.resolve()
      .then(() => this.checkProject(project))
      .then(() => {
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
      })
      .then(() => this.installDependent(dependentOptions, dependent))
      .then(() => this.testDependent(dependentOptions, dependent))
      .catch(error => ({ packagetest: { status: 'fail', error } }))
      .then(executionResults => {
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
            debug('testDependent passed for %s', project.name);
            emitter.emit('pass', test);
            break;
          case 'fail':
            debug(
              'testDependent failed for %s: %s',
              project.name,
              executionResult.error
            );
            emitter.emit('fail', test, executionResult.error);
            break;
          case 'pending':
            debug('testDependent skipped for %s', project.name);
            emitter.emit('pending', test);
            break;
        }

        emitter.emit('test end', test);
      });
  }

  checkProject(project) {
    return project.verify();
  }

  installDependent(options, dependent) {
    return installDependent(options, dependent);
  }

  testDependent(options, dependent) {
    return testDependent(options, dependent);
  }

  testDependents() {
    const options = this.options;
    const config = this.config;
    const stats = {
      passes: 0,
      failures: 0,
      skipped: 0
    };

    if (config.projects.length === 0) {
      throw new Error('Fugl: no projects specified');
    }

    const emitter = this;
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
        }
        const Reporter = require(`mocha/lib/reporters/${options.reporter}`);
        reporter = new Reporter(emitter);
      } catch (e) {
        // ignore
      }
    }

    if ((!reporter && options.reporter === 'console') || options.ci) {
      emitter.once('start', () => console.log());
      emitter.on('pass', test => console.log(`  ${test.title} PASSED`));
      emitter.on('fail', test => console.log(`  ${test.title} FAILED`));
      emitter.on('fail', (_, error) => console.log(`${error}\n`));
      emitter.on('pending', test => console.log(`  ${test.title} SKIPPED`));
    }

    emitter.emit('start');

    // TODO switch to parallel testing!
    return config.projects
      .reduce((prev, project) => {
        return prev.then(() => {
          return this.executeDependent(emitter, project);
        });
      }, Promise.resolve(true))
      .then(() => {
        emitter.emit('end');
      })
      .then(() => {
        if (options.reporter === 'html') {
          if (!fs.existsSync(options.reportDir)) {
            mkdirp.sync(options.reportDir);
          }
          copyFileSync(
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

    if (!fs.existsSync(options.folder)) {
      mkdirp.sync(options.folder);
    }

    debug('working in folder %s', options.folder);

    return Promise.resolve().then(() => {
      return this.testDependents();
    });
  }
}

module.exports = Fugl;
