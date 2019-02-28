const isGitUrl = require('is-git-url');
const normalizeGitUrl = require('normalize-git-url');
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
  const name = packageInfo.name;

  if (packageInfo.repository) {
    let repository = packageInfo.repository;
    if (typeof repository !== 'string') {
      repository = normalizeGitUrl(repository.url).url;
    }
    if (isRepoUrl(repository)) {
      return repository;
    } else {
      throw new Error(`project ${name} repository is invalid`);
    }
  } else {
    throw new Error(`project ${name} repository is missing`);
  }
}

class Project {
  constructor(optionsOrString) {
    if (typeof optionsOrString === 'string') {
      optionsOrString = { name: optionsOrString.trim() };
    } else if (!optionsOrString) {
      optionsOrString = {};
    }

    const { name } = optionsOrString;

    // now grab any remaining options excluding the name
    const otherOptions = Object.assign({}, optionsOrString);
    delete otherOptions.name;

    this.kind = null;
    this.npmName = null;
    this.repoUrl = null;

    if (!name) {
      throw new Error('project supplied without name');
    } else if (isRepoUrl(name)) {
      this.kind = 'git';
      this.repoUrl = name;
    } else if (isPackageName(name)) {
      this.kind = 'npm';
      this.npmName = name;
    } else {
      throw new Error(`project ${name} is not a repository`);
    }

    Object.assign(this, otherOptions);
  }

  get name() {
    switch (this.kind) {
      case 'git':
        return this.repoUrl;
      case 'npm':
        return this.npmName;
      default:
        return null;
    }
  }

  toDependent() {
    const dependent = Object.assign({}, this);
    delete dependent.kind;
    delete dependent.npmName;
    delete dependent.repoUrl;
    dependent.name = this.repoUrl;
    return dependent;
  }

  queryGitHubForPackageAndUpdate(name, _moduleStats) {
    const moduleStats = _moduleStats || new ModuleStats(name);

    return moduleStats
      .fetchPackageJsonFromGitHub(name)
      .then(npmName => {
        this.npmName = npmName;

        return this;
      })
      .catch(() => {
        throw new Error(`unable to access repository ${name}`);
      });
  }

  queryNpmForPackageAndUpdate(name, _moduleStats) {
    const moduleStats = _moduleStats || new ModuleStats(name);

    return moduleStats
      .fetchInfo()
      .then(packageInfo => {
        this.repoUrl = parsePackageRepo(packageInfo);

        return this;
      })
      .catch(() => {
        throw new Error(`unable to access package ${name}`);
      });
  }

  verify(requirement) {
    if (requirement && this[requirement] !== null) {
      return Promise.resolve(this);
    }

    switch (this.kind) {
      case 'git':
        return this.queryGitHubForPackageAndUpdate(this.repoUrl);
      case 'npm':
        return this.queryNpmForPackageAndUpdate(this.npmName);
      default:
        throw new Error('Invalid kind');
    }
  }
}

Project.isRepoUrl = isRepoUrl;

module.exports = Project;
