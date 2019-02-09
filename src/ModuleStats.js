const _ = require('lodash');
const Registry = require('npm-stats')();

const WEEK_IN_MILLISECONDS = 604800000; // 7 * 24 * 60 * 60 * 1000

function createPackageRequest(moduleName, methodName, options) {
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

    if (options) {
      args.unshift(options);
    }

    Registry.module(moduleName)[methodName](...args);
  });
}

class ModuleStats {
  constructor(moduleName) {
    this.moduleName = moduleName;

    this.dependents = null;
  }

  fetchDependents() {
    if (this.dependents !== null) {
      return Promise.resolve(this.dependents);
    }

    return createPackageRequest(this.moduleName, 'dependents').then(result => {
      this.dependents = result;
      return result;
    });
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
        statsPromises[packageName] = createPackageRequest(
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

ModuleStats.packageNamesByMagnitude = metricResult =>
  _.chain(metricResult)
    .toPairs()
    .orderBy(([, magnitude]) => magnitude, 'desc')
    .map(([packageName]) => packageName)
    .value();

module.exports = ModuleStats;
