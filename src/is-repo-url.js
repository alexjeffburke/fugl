const isGitUrl = require('is-git-url');
const urlModule = require('url');

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

module.exports = isRepoUrl;
