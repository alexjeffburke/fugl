# Fugl

A tool for verifying that changes to a package do not affect projects dependent upon it.

## Introduction

Most projects fortunate enough to see wider use end up with a tension between changes that
move things forward and consumers that depend on features and behaviours of existing versions.

Fugl intends to provide a way to address that question by providing automation around gaining
confidence that forward progress does not come at the expense of compatibility.

[Relevant discussion at npm](https://github.com/npm/npm/issues/6510).

## Install

```
npm install -g fugl
```

## Use

```
dont-break --package dont-break-foo --dep dont-break-bar
```

## Example

2 projects.

1. First project `foo` only exports single variable `module.exports = 'foo';`
2. Second project `foo-user` depends on `foo`.

`foo-user` only works if it gets string `foo` from the module it depends on, like this:

```js
var str = require('foo');
console.assert(str === 'foo', 'value of foo should be "foo", but is ' + str);
```

`foo` has only a single release 0.1.0 that works for `foo-user` project.

The author of `foo` changes code to be `module.exports = 'bar';` and releases it as 0.2.0.
`foo-user` wants to use the latest `foo` so it updates its dependency, not expecting anything
bad - foo's minor version number has been upgraded. In semantic versioning it means no breaking API
changes.

`foo-user` is now broken!

Instead, before publishing new version to NPM, project `foo` can create a file in its
project folder `.dont-break.json` with names of dependent projects to test

```bash
echo '["foo-user"]' > .dont-break.json
```

You can check if the current code breaks listed dependent project by running

```bash
dont-break
```

This will install each dependent project from `.dont-break.json` file into `/tmp/dont-break...` folder,
will run the dependent's unit tests using `npm test` to make sure they work initially, then
will copy the current project into the temp folder, overwriting the previous working version.
Then it will run the tests again, throwing an exception if they stopped working.

In the example case, it will report something like this

```bash
$ dont-break
dependents [ 'foo-user' ]
testing foo-user
  installing foo-user
installed into /tmp/foo@0.0.0-against-foo-user
  npm test
tests work in /tmp/foo@0.0.0-against-foo-user/lib/node_modules/foo-user
copied /Users/gleb/git/foo/* to /tmp/foo@0.0.0-against-foo-user/lib/node_modules/foo-user/node_modules/foo
  npm test
npm test returned 1
test errors:
AssertionError: value of foo should be "foo", but is bar
npm ERR! Test failed.  See above for more details.
npm ERR! not ok code 0
tests did not work in /tmp/foo@0.0.0-against-foo-user/lib/node_modules/foo-user
code 1
FAIL: Current version break dependents
```

The message clearly tells you that the dependent projects as they are right now cannot
upgrade to the version you are about to release.

## Dependencies

You can specify GitHub repos as dependencies, because they most likely will
have tests. For example in `.dont-break.json`

```js
// you can use JavaScript comments in this file .dont-break.json
['https://github.com/bahmutov/dont-break-bar'];
```

Picking projects to test manually is a judgement call.
Dont-break can fetch top N most downloaded
or most starred dependent modules and save the list.

- run `dont-break --top-downloads <N>` to find top N most downloaded dependent modules,
  save to `.dont-break.json` and check.
- run `dont-break --top-starred <N>` to find top N most starred dependent modules,
  save to `.dont-break.json` and check.

The above commands overwrite `.dont-break.json` file.

## Configuration options

### Global vs. project-level configuration

You can specify different configuration options on global level or on project level. Following configs are equivalent.
Project level:

```
[
  {
    "name": "project-a",
    "test": "grunt test"
  },
  {
    "name": "https://github.com/bahmutov/dont-break-bar",
    "test": "grunt test"
  },
  {
    "name": "project-c",
    "test": "npm test:special"
  }
]
```

Global level:

```
{
  "test": "grunt test",
  "projects": [
    "project-a",
    "https://github.com/bahmutov/dont-break-bar",
    {
      "name": "project-c",
      "test": "npm test:special"
    }
  ]
}
```

Global level will simplify dont-break config if dependent projects share the same options. Also, options can be
overriden on project level as in case of "project-c" here.

### Execution flow overview

Dont-break performs folowing steps for each dependent project:

- Clone the dependent project repo into temporary dir using `git clone`, if dependent project is a Github repo url
- Install the dependent project in temporary dir using the [specified command](#install-command)
- Run [post-install](#post-install-command) command if [pre-test](#pre-testing-with-previous-package-version) is not disabled
- [Pre-test](#pre-testing-with-previous-package-version) the dependent project if this is not disabled
- [Install current module](#current-module-installation-method) into the dependent project
- Run [post-install](#post-install-command) command
- [Test](#test-command) the dependent project

Sections below describe how you can customize these steps.

### Name

Serves to identify the dependent module by either a NPM module name (possibly with scope and version range) or Github URL.

```
[
  {
    "name": "foo-module-name"
  }, {
    "name": "@my-scope/bar-module-name@^1.0.1-pre.1"
  }, {
    "name": "https://github.com/bahmutov/dont-break-bar"
  }
]
```

The above config is equivalent to its shorter version:

```
[
  "foo-module-name", "@my-scope/bar-module-name@^1.0.1-pre.1", "https://github.com/bahmutov/dont-break-bar"
]
```

### Test command

You can specify a custom test command per dependent module. For example, to run `grunt test` for `foo-module-name`,
but default command for module `bar-name`, list in `.dont-break.json` the following:

```
[
  {
    "name": "foo-module-name",
    "test": "grunt test"
  },
  "bar-name"
]
```

### Install command

You can specify a custom install command per dependent module. By default it's `npm install`. For example, this will use
`yarn add` for `foo-module-name`, but keep default `npm install` for module `bar-name`:

```
[
  {
    "name": "foo-module-name",
    "install": "yarn add"
  },
  "bar-name"
]
```

The name of dependent module will be added to given command, e.g. for above it will run `yarn add foo-module-name`.

### Post-install command

Before testing the dependent package dont-break installs its dev dependencies via `npm install` command run from the
dependency directory. If you need something more you can specify it via "postinstall" config parameter like this:

```
[
  {
    "name": "packageA",
    "postinstall": "npm run update"
  }, {
    "name": "packageB"
  }
]
```

If specified this command will run first before pretesting the old version of lib (if pretest isn't disabled), then
after installing current version of lib to dependent package. You can use \$CURRENT_MODULE_DIR variable here which
will be replaced with a path to current module:

```
[
  {
    "name": "packageA",
    "postinstall": "$CURRENT_MODULE_DIR/install-all-deps.sh",
  }
]
```

### Pre-testing with previous package version

By default dont-break first tests dependent module with its published version of current module, to make sure that it
was working before the update. If this sounds excessive to you you can disable it with {"pretest": false} option:

```
[
  {
    "name": "foo-module-name",
    "test": "grunt test",
    "pretest": false
  }
]
```

Here "foo-module-name" module will be tested only once, and "bar-name" twise: first with its published version of
current module, and then with the updated version.

The "pretest" property can also accept custom script to run for pretesting:

```
[
  {
    "name": "foo-module-name",
    "test": "grunt test",
    "pretest": "grunt test && ./ci/after-pretesting-by-dont-break"
  }
]
```

By default it equals to "test" command.

### Current module installation method

To test dependent package dont-break installs current module inside the dependent package directory. By default it uses
`npm install $CURRENT_MODULE_DIR`. You can enter your command there, e.g. `yarn add $CURRENT_MODULE_DIR`. There are
also pre-configured options [npm-link](https://docs.npmjs.com/cli/link) and
[yarn-link](https://yarnpkg.com/lang/en/docs/cli/link/). They can be helpful in some cases, e.g. if you need to use
`npm install` or `yarn` in postinstall command. To use `npm link` method specify {"currentModuleInstall": "npm-link"}:

```
{
  "currentModuleInstall": "npm-link",
  "projects": ["packageA", "packageB"]
}
```

### Env vars exported to called scripts

Following env vars are available for use in scripts called by executed steps:

- `$CURRENT_MODULE_DIR` - directory of current module
- `$CURRENT_MODULE_NAME` - name of current module as stated in its package.json

### Installation timeout

You can specify a longer installation time out, in seconds, using CLI option

```
dont-break --timeout 30
```

## Related

_dont-break_ is the opposite of [next-update](https://github.com/bahmutov/next-update)
that one can use to safely upgrade dependencies.

## Setting up second CI for dont-break

I prefer to use a separate CI service specifically to test the current code
against the dependent projects using `dont-break`. For example, the project
[boggle](https://www.npmjs.com/package/boggle) is setup this way. The unit tests
are run on [TravisCI](https://travis-ci.org/bahmutov/boggle) using
pretty standard [.travis.yml](https://github.com/bahmutov/boggle/blob/master/.travis.yml) file

```yml
language: node_js
node_js:
  - '0.12'
  - '4'
branches:
  only:
    - master
before_script:
  - npm install -g grunt-cli
```

Then I setup a separate build service on [CircleCi](https://circleci.com/gh/bahmutov/boggle)
just to run the `npm run dont-break` command from the `package.json`

```json
"scripts": {
    "dont-break": "dont-break --timeout 30"
}
```

We are assuming a global installation of `dont-break`, and the project lists
the projects to check in the
[.dont-break](https://github.com/bahmutov/boggle/blob/master/.dont-break) file.
At the present there is only a single dependent project
[boggle-connect](https://www.npmjs.com/package/boggle-connect).

To run `dont-break` on CircleCI, I created the
[circle.yml](https://github.com/bahmutov/boggle/blob/master/circle.yml) file.
It should be clear what it does - installs `dont-break`, and runs the npm script command.

```yml
machine:
  node:
    version: '0.12'
dependencies:
  post:
    - npm install -g dont-break
test:
  override:
    - npm run dont-break
```

To make the status visible, I included the CircleCI badges in the README file.

```md
[![Dont-break][circle-ci-image] ][circle-ci-url]
[circle-ci-image]: https://circleci.com/gh/bahmutov/boggle.svg?style=svg
[circle-ci-url]: https://circleci.com/gh/bahmutov/boggle
```

which produces the following:

Breaking dependencies? [![Dont-break][circle-ci-image] ][circle-ci-url] using
[dont-break](https://github.com/bahmutov/dont-break)

[circle-ci-image]: https://circleci.com/gh/bahmutov/boggle.svg?style=svg
[circle-ci-url]: https://circleci.com/gh/bahmutov/boggle

## Development and testing

This project is tested end to end using two small projects:
[boggle](https://www.npmjs.com/package/boggle) and its dependent
[boggle-connect](https://www.npmjs.com/package/boggle-connect).

To see open github issues, use command `npm run issues`

To see verbose log message, run with `DEBUG=dont-break ...` environment
variable.

### Small print

Author: Gleb Bahmutov &copy; 2014

- [@bahmutov](https://twitter.com/bahmutov)
- [glebbahmutov.com](http://glebbahmutov.com)
- [blog](http://glebbahmutov.com/blog)

License: MIT - do anything with the code, but don't blame me if it does not work.

Spread the word: tweet, star on github, etc.

Support: if you find any problems with this module, email / tweet /
[open issue](https://github.com/bahmutov/dont-break/issues?state=open) on Github

Implemented using [npm-registry](https://github.com/3rd-Eden/npmjs),
[lazy-ass](https://github.com/bahmutov/lazy-ass) and [npm-utils](https://github.com/bahmutov/npm-utils).
