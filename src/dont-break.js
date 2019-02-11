var _ = require('lodash');
var chdir = require('chdir-promise');
var check = require('check-more-types');
var debug = require('./debug');
var fs = require('fs-extra');
var mkdirp = require('mkdirp');
var path = require('path');
var stripComments = require('strip-json-comments');
var la = require('./la');

var Fugl = require('./Fugl');
var ModuleStats = require('./ModuleStats');
var packageCheck = require('./package-check');

var dontBreakFilename = './.dont-break.json';

function currentPackageName(options) {
  return packageCheck(options.folder).name;
}

function getDependents(options) {
  options = options || {};

  if (options.dep) {
    const projects = options.dep;
    delete options.dep;
    return Promise.resolve({ projects });
  }

  var configFile = path.join(options.folder, dontBreakFilename);
  var forName = options.package;
  debug('getting dependents for %s', forName);

  var metric, n;
  if (check.number(options.topDownloads)) {
    metric = 'downloads';
    n = options.topDownloads;
  } else if (check.number(options.topStarred)) {
    metric = 'stars';
    n = options.topStarred;
  }

  var firstStep;
  if (check.unemptyString(metric) && check.number(n)) {
    firstStep = saveTopDependents(configFile, forName, metric, n);
  } else {
    firstStep = Promise.resolve();
  }

  return firstStep.then(() => getDependentsFromFile(options));
}

function getDependentsFromFile(options) {
  debug('getDependentsFromFile in %s', options.folder);

  var sawError = null;

  return chdir
    .to(options.folder)
    .then(() => fs.readFile(dontBreakFilename, 'utf-8'))
    .then(stripComments)
    .then(function(text) {
      debug('loaded dependencies file', text);
      return text;
    })
    .then(JSON.parse)
    .catch(err => {
      if (err.message.indexOf('ENOENT') !== -1) {
        sawError = new Error('missing .dont-break.json');
      } else {
        sawError = new Error('invalid .dont-break.json');
      }
      return [];
    })
    .then(data => {
      if (Array.isArray(data)) {
        data = { projects: data };
      }

      return chdir.back().then(() => {
        if (sawError) {
          throw sawError;
        } else {
          return data;
        }
      });
    });
}

function saveTopDependents(file, name, metric, n) {
  la(check.unemptyString(name), 'invalid package name', name);
  la(check.unemptyString(metric), 'invalid metric', metric);
  la(check.positiveNumber(n), 'invalid top number', n);

  return new ModuleStats(name)
    .fetchDepedentsWithMetric(metric)
    .then(metricResult => {
      const dependents = ModuleStats.packageNamesByMagnitude(metricResult);
      debug(dependents);
      la(
        check.array(dependents),
        'cannot select top n, not a list',
        dependents
      );
      debug(
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
      return fs.writeFile(file, str, 'utf-8').then(() => {
        debug(
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

module.exports = function dontBreak(options) {
  if (typeof options === 'string') {
    if (options.length > 0) {
      throw new Error('Invalid folder name suppled.');
    }
    options = {
      folder: options
    };
  } else if (options.folder) {
    if (!fs.existsSync(options.folder)) {
      mkdirp.sync(options.folder);
    }
  } else {
    options = Object.assign(
      {
        folder: process.cwd()
      },
      options
    );
  }

  if (!options.package) {
    options.package = currentPackageName(options);
  }

  return getDependents(options).then(config => {
    options.config = config;
    options.projects = config.projects;

    if (config.projects) {
      options.projects = config.projects;
    }
    if (typeof config.pretest === 'boolean') {
      options.pretest = config.pretest;
    }

    const fugl = options._fugl ? options._fugl(options) : new Fugl(options);
    return fugl.run();
  });
};
