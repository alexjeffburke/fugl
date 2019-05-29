const ShoulderProject = require('shoulder/lib/Project');

function processCustomisations(source, target) {
  ['install', 'postinstall', 'test'].forEach(configKey => {
    if (typeof source[configKey] === 'string') {
      target[configKey] = source[configKey];
    }
  });
}

class Project {
  constructor(optionsOrString) {
    let options;
    if (typeof optionsOrString === 'string') {
      options = { name: optionsOrString.trim() };
    } else if (optionsOrString) {
      options = optionsOrString;
    } else {
      options = {};
    }

    this.shoulderProject = new ShoulderProject(options);

    const config = {};
    processCustomisations(options, config);
    this.config = Object.keys(config).length > 0 ? config : null;
  }

  get name() {
    return this.shoulderProject.name;
  }

  get repoUrl() {
    return this.shoulderProject.repoUrl;
  }

  toDependent() {
    const dependent = Object.assign({}, this.shoulderProject);
    delete dependent.kind;
    delete dependent.npmName;
    delete dependent.repoUrl;
    dependent.name = this.shoulderProject.repoUrl;
    return dependent;
  }

  verify(requirement) {
    return this.shoulderProject.verify(requirement);
  }
}

module.exports = Project;
module.exports.processCustomisations = processCustomisations;
