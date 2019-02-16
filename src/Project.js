const isGitUrl = require('is-git-url');
const urlModule = require('url');
const validateNpmPackageName = require('validate-npm-package-name');

const ModuleStats = require('./ModuleStats');

const GIT_REPO_SUFFIX = '.git';

function isPackageName(name) {
  const result = validateNpmPackageName(name);
  return result.validForNewPackages || result.validForOldPackages;
}

function isRepoUrl(url) {
  const parsedUrl = urlModule.parse(url);
  if (!(parsedUrl.protocol && parsedUrl.host && parsedUrl.pathname)) {
    return false;
  }

  // account for URLs missing the repo suffix
  if (url.indexOf(GIT_REPO_SUFFIX) !== GIT_REPO_SUFFIX.length - 4) {
    url += GIT_REPO_SUFFIX;
  }

  return isGitUrl(url);
}

function parsePackageRepo(packageInfo) {
  if (packageInfo.repository) {
    let repository = packageInfo.repository;
    if (typeof repository !== 'string') {
      repository = repository.url;
    }
    if (isRepoUrl(repository)) {
      return repository;
    } else {
      throw new Error('project repository is invalid');
    }
  } else {
    throw new Error('project repository is missing');
  }
}

class Project {
  constructor(optionsOrString) {
    if (typeof optionsOrString === 'string') {
      optionsOrString = { name: optionsOrString.trim() };
    } else if (!optionsOrString) {
      optionsOrString = {};
    }

    const { name, ...otherOptions } = optionsOrString;

    this.name = null;
    this.kind = null;
    this.repoUrl = null;

    if (!name) {
      throw new Error('project supplied without name');
    } else if (isRepoUrl(name)) {
      this.kind = 'git';
      this.repoUrl = name;
    } else if (isPackageName(name)) {
      this.kind = 'npm';
    } else {
      throw new Error(`project ${name} is not a repository`);
    }

    this.name = name;

    Object.assign(this, otherOptions);
  }

  toDependent() {
    const dependent = Object.assign({}, this);
    delete dependent.kind;
    delete dependent.repoUrl;
    dependent.name = this.repoUrl;
    return dependent;
  }

  queryNpmForPackageAndUpdate(name, _moduleStats) {
    const moduleStats = _moduleStats || new ModuleStats(name);

    return moduleStats
      .fetchInfo()
      .catch(() => {
        throw new Error(`unable to access package ${name}`);
      })
      .then(packageInfo => {
        this.repoUrl = parsePackageRepo(packageInfo);
      });
  }

  verify() {
    switch (this.kind) {
      case 'git':
        return Promise.resolve();
      case 'npm':
        return this.queryNpmForPackageAndUpdate(this.name);
      default:
        throw new Error('Invalid kind');
    }
  }
}

Project.isRepoUrl = isRepoUrl;

module.exports = Project;
