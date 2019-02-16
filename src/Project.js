const isGitUrl = require('is-git-url');
const urlModule = require('url');

const ModuleStats = require('./ModuleStats');

const GIT_REPO_SUFFIX = '.git';

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
    return dependent;
  }
}

Project.isRepoUrl = isRepoUrl;

module.exports = Project;
