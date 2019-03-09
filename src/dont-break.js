var chdir = require('chdir-promise');
var debug = require('./debug');
var fs = require('fs-extra');
var mkdirp = require('mkdirp');
var stripComments = require('strip-json-comments');

var Fugl = require('./Fugl');
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

  return Promise.resolve().then(() => {
    if (typeof options.topDownloads === 'number') {
      throw new Error('Use `fugl fetch downloads`');
    } else if (typeof options.topStarred === 'number') {
      throw new Error('Use `fugl fetch stars`');
    }

    return getDependentsFromFile(options);
  });
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

    if (typeof config.pretest === 'boolean') {
      options.pretest = config.pretest;
    }

    const fugl = options._fugl ? options._fugl(options) : new Fugl(options);
    return fugl.run();
  });
};
