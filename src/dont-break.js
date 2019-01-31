var _ = require('lodash');
var chdir = require('chdir-promise');
var check = require('check-more-types');
var debug = require('./debug');
var fs = require('fs-extra');
var path = require('path');
var stripComments = require('strip-json-comments');
var npm = require('top-dependents');
var la = require('./la');

var Fugl = require('./Fugl');

var dontBreakFilename = './.dont-break.json';

function currentPackageName(options) {
  try {
    const pkg = require(path.join(options.folder, 'package.json'));
    if (!pkg.name) {
      throw new Error(`The package in ${options.folder} has no name.`);
    }
    return pkg.name;
  } catch (e) {
    throw new Error(`The folder ${options.folder} contain no valid package.`);
  }
}

function getDependents(options) {
  options = options || {};

  if (options.dep) {
    const projects = options.dep;
    delete options.dep;
    return Promise.resolve({ projects });
  }

  var forName = options.package;
  debug('getting dependents for %s', forName);

  var metric, n;
  if (check.number(options.topDownloads)) {
    metric = 'downloads';
    n = options.topDownloads;
  } else if (check.number(options.topStarred)) {
    metric = 'starred';
    n = options.topStarred;
  }

  var firstStep;
  if (check.unemptyString(metric) && check.number(n)) {
    firstStep = saveTopDependents(forName, metric, n);
  } else {
    firstStep = Promise.resolve();
  }

  return firstStep.then(() => getDependentsFromFile(options));
}

function getDependentsFromFile(options) {
  debug('getDependentsFromFile in %s', options.folder);

  return chdir
    .to(options.folder)
    .then(() => fs.readFile(dontBreakFilename, 'utf-8'))
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
        dontBreakFilename,
        'in',
        options.folder
      );
      console.log(
        'no dependent projects, maybe query NPM for projects that depend on this one.'
      );
      return [];
    })
    .then(data => {
      if (Array.isArray(data)) {
        data = { projects: data };
      }

      return chdir.back().then(() => data);
    });
}

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

module.exports = function dontBreak(options) {
  if (typeof options === 'string') {
    if (options.length > 0) {
      throw new Error('Invalid folder name suppled.');
    }
    options = {
      folder: options
    };
  } else if (!options.folder) {
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

    return new Fugl(options).run();
  });
};
