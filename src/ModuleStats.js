const _ = require('lodash');
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

class ModuleStats {
  constructor(moduleName) {
    if (!(typeof moduleName === 'string' && moduleName.trim().length)) {
      throw new Error('Invalid module name.');
    }

    this.moduleName = moduleName;

    this.dependents = null;
  }

  fetchDependents() {
    if (this.dependents !== null) {
      return Promise.resolve(this.dependents);
    }

    return ModuleStats.createPackageRequest(this.moduleName, 'dependents').then(
      result => {
        this.dependents = result;
        return result;
      }
    );
  }

  fetchDepedentsWithDownloads() {
    const statsPromises = {};

    const until = Date.now();
    const durationOptions = {
      until,
      since: until - WEEK_IN_MILLISECONDS
    };

    return this.fetchDependents().then(result => {
      result.forEach(packageName => {
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

      return Promise.all(Object.values(statsPromises)).then(() => {
        return statsPromises;
      });
    });
  }

  fetchDepedentsWithMetric(metric) {
    switch (metric) {
      case 'downloads':
        return this.fetchDepedentsWithDownloads();
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
}

ModuleStats.createPackageRequest = createPackageRequest;

ModuleStats.packageNamesByMagnitude = metricResult =>
  _.chain(metricResult)
    .toPairs()
    .orderBy(([, magnitude]) => magnitude, 'desc')
    .map(([packageName]) => packageName)
    .value();

module.exports = ModuleStats;
