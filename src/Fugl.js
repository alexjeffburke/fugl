var _ = require('lodash');
var la = require('./la');
var check = require('check-more-types');
var debug = require('./debug');
var EventEmitter = require('events');
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs-extra');
var exists = require('fs').existsSync;

var installDependent = require('./install-dependency');
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
    this.options = options = Object.assign({}, options || {});

    if (!options.package) {
      throw new Error('Fugl: missing package');
    }

    if (!options.folder) {
      throw new Error('Fugl: missing folder');
    }

    let projects;
    if (!Array.isArray(options.projects)) {
      throw new Error('Fugl: missing projects');
    } else {
      projects = options.projects;
      delete options.projects;
    }

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
    const packageInfo = parsePackage(options.package);
    this.config.packageName = packageInfo.name;
    this.config.packageVersion = packageInfo.version || 'latest';
    this.config.projects = projects || this.config.projects;
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

  executeDependent(emitter, options, dependent) {
    const test = {
      title: dependent.name,
      body: '',
      duration: 0,
      fullTitle: () => dependent.name,
      slow: () => 0
    };

    const moduleName = dependent.name;
    const safeName = _.kebabCase(_.deburr(moduleName));
    debug('original name "%s", safe "%s"', moduleName, safeName);
    const toFolder = path.join(options.tmpDir, safeName);
    debug('testing folder %s', toFolder);

    const dependentOptions = {
      ...options,
      moduleName,
      toFolder
    };

    return Promise.resolve()
      .then(() => this.installDependent(dependentOptions, dependent))
      .then(() => this.testDependent(dependentOptions, dependent))
      .then(() => {
        debug('testDependent passed for %s', dependent.name);
        emitter.emit('pass', test);
      })
      .catch(err => {
        debug('testDependent failed for %s: %s', dependent.name, err);
        emitter.emit('fail', test, err);
      });
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
          return this.executeDependent(
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

    return Promise.resolve().then(() => {
      // update configuration
      this.config = Object.assign({}, this.config, checkConfig(this.config));

      return this.testDependents();
    });
  }
}

module.exports = Fugl;
