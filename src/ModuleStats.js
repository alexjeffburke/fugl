const _ = require('lodash');
const debug = require('./debug').extend('ModuleStats');
const fetch = require('node-fetch');
const Registry = require('npm-stats')();

const WEEK_IN_MILLISECONDS = 604800000; // 7 * 24 * 60 * 60 * 1000

function createPackageRequest(moduleName, methodName, options) {
  options = options || {};

  let registry;
  if (options._registry) {
    registry = options._registry;
    delete options._registry;
  } else {
    registry = Registry;
  }

  return new Promise((resolve, reject) => {
    const args = [
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    ];

    if (Object.keys(options).length > 0) {
      args.unshift(options);
    }

    registry.module(moduleName)[methodName](...args);
  });
}

const objectValues =
  Object.values ||
  function objectValues(object) {
    return Object.keys(object).map(key => object[key]);
  };

function parseLibrariesIoItemToRepoUrl(item) {
  const fullName = item.full_name;
  const hostType = item.host_type;

  if (hostType !== 'GitHub') {
    throw new Error(`Hosting was not by GitHub for ${fullName}`);
  }

  return `https://github.com/${fullName}`;
}

class ModuleStats {
  constructor(moduleName, options) {
    if (!(typeof moduleName === 'string' && moduleName.trim().length)) {
      throw new Error('Invalid module name.');
    }

    this.moduleName = moduleName;
    this.dependents = null;
    this.packageJson = null;

    options = options || {};
    this.librariesIoApiKey = options.librariesIoApiKey || null;

    this.fetchSource = this.librariesIoApiKey !== null ? 'libraries.io' : 'npm';
  }

  makeLibrariesIoUrl() {
    const what = encodeURIComponent(this.moduleName);

    return `https://libraries.io/api/NPM/${what}/dependent_repositories?api_key=${
      this.librariesIoApiKey
    }`;
  }

  fetchDependents() {
    if (this.dependents !== null) {
      return Promise.resolve(this.dependents);
    }

    switch (this.fetchSource) {
      case 'libraries.io':
        return this.fetchLibrariesIoDependents();
      case 'npm':
        return this.fetchNpmDependents();
      default:
        return Promise.reject(new Error('unsupported fetch source'));
    }
  }

  fetchLibrariesIoDependents() {
    const url = this.makeLibrariesIoUrl();

    return ModuleStats.fetch(url)
      .then(res => {
        return res.json();
      })
      .then(results => {
        const depdendents = [];

        return results.reduce((prev, item) => {
          return prev.then(() => {
            return Promise.resolve()
              .then(() => parseLibrariesIoItemToRepoUrl(item))
              .then(repoUrl => this.fetchPackageJsonFromGitHub(repoUrl))
              .then(depdendent => depdendents.push(depdendent))
              .catch(error => debug(error))
              .then(() => depdendents);
          });
        }, Promise.resolve(depdendents));
      })
      .then(dependents => {
        this.dependents = dependents;
        return dependents;
      });
  }

  fetchNpmDependents() {
    return ModuleStats.createPackageRequest(this.moduleName, 'dependents').then(
      result => {
        this.dependents = result;
        return result;
      }
    );
  }

  fetchDownloadsForProjects(projects) {
    const statsPromises = {};

    const until = Date.now();
    const durationOptions = {
      until,
      since: until - WEEK_IN_MILLISECONDS
    };

    projects.forEach(({ npmName: packageName }) => {
      statsPromises[packageName] = ModuleStats.createPackageRequest(
        packageName,
        'downloads',
        durationOptions
      ).then(dataPoints => {
        statsPromises[packageName] = 0;
        dataPoints.forEach(
          ({ value }) => (statsPromises[packageName] += value)
        );
      });
    });

    return Promise.all(objectValues(statsPromises)).then(() => {
      return statsPromises;
    });
  }

  fetchMetricForProjects(metric, projects) {
    switch (metric) {
      case 'downloads':
        return this.fetchDownloadsForProjects(projects);
      case 'stars':
        return Promise.reject(
          new Error('The stars metric is currently disabled.')
        );
      default:
        return Promise.reject(
          new Error(`${metric} is not a supported metric.`)
        );
    }
  }

  fetchInfo() {
    if (this.packageJson !== null) {
      return Promise.resolve(this.packageJson);
    }

    return ModuleStats.createPackageRequest(this.moduleName, 'latest').then(
      result => {
        this.packageJson = result;
        return result;
      }
    );
  }

  fetchPackageJsonFromGitHub(repoUrl) {
    const userContentUrl = repoUrl.replace(
      'github.com',
      'raw.githubusercontent.com'
    );

    return ModuleStats.fetch(`${userContentUrl}/master/package.json`)
      .then(res => res.json())
      .catch(() => {
        throw new Error(`Error feching package.json for ${repoUrl}`);
      })
      .then(packageJson => {
        if (packageJson.name) {
          return packageJson.name;
        } else {
          throw new Error(`Missing name in package.json for ${repoUrl}`);
        }
      });
  }
}

ModuleStats.createPackageRequest = createPackageRequest;

ModuleStats.fetch = fetch;

ModuleStats.packageNamesByMagnitude = metricResult =>
  _.chain(metricResult)
    .toPairs()
    .orderBy(([, magnitude]) => magnitude, 'desc')
    .map(([packageName]) => packageName)
    .value();

module.exports = ModuleStats;
