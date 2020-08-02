# Fugl

[![NPM version](https://img.shields.io/npm/v/fugl.svg)](https://www.npmjs.com/package/fugl)
[![Build Status](https://github.com/alexjeffburke/fugl/workflows/tests/badge.svg)](https://github.com/alexjeffburke/fugl)
[![Coverage Status](https://img.shields.io/coveralls/alexjeffburke/fugl/master.svg)](https://coveralls.io/r/alexjeffburke/fugl?branch=master)

A tool for verifying that changes to a package do not affect projects dependent upon it.

## Introduction

Most projects fortunate enough to see wider use end up with a tension between changes that
move things forward and consumers that depend on features and behaviours of existing versions.

Fugl intends to provide a way to address that question by providing automation around gaining
confidence that forward progress does not come at the expense of compatibility.

[Relevant discussion at npm](https://github.com/npm/npm/issues/6510).

## Use

### Interactively with npx

To check a project currently being worked on the Fugl binary can be invoked via `npx`.
The current directory is scanned for package.json and tested against the listed projects:

```
npx fugl --projects https://github.com/alexjeffburke/jest-unexpected
```

You can also specify the npm name of projects and Fugl will try to discover the repository:

```
npx fugl --projects assert-the-unexpected
```

### Installed as a CLI

The module can also also installed globally or as a project dependency and provides a fugl binary.

```
npm install -g fugl
```

```
fugl --package <packageName>@<packageVersion> --projects https://github.com/someone/somepackage
```

By default, Fugl will output the success or failure of the tests it performs to the console. You
can also specify other reporters, and they correspond to the names of mocha reporters. Perhaps of
most interest is the HTML reporter, which will write a self contained breakage report that can be
viewed within the browser:

```
fugl --package unexpected --projects https://github.com/alexjeffburke/jest-unexpected --reporter html

// ...

open breakage/index.html
```

## Configuration

Fugl supports configuration being supplied to it as a JSON file. This becomes particularly
convenient when checking a series of dependents and this list be checked into version control.

Configuration files are loaded by supplying a `--config` parameter to the `fugl` binary:

```
fugl --config .fugl.json
```

An example basic JSON configuration file for testing certain module repositories
would look something like the following:

```json
{
  "projects": [
    "https://github.com/someorg/somepackage.git",
    "https://github.com/someorg/otherpackage.git"
  ]
}
```

Each project can also be specified by an object, and this can contain properties
that enable the same options available on the [command line](#command-line-interface).
An example configuration to test a particular npm package would look as below:

```json
{
  "projects": [
    {
      "name": "shoulder",
      "test": "npm run coverage",
      "pretest": true
    }
  ]
}
```

### Hooks

When executing tests against a package, a number of hooks are supported to customise and/or extend
the commands being executed against each package.

```json
{
  "projects": [
    {
      "name": "shoulder",
      "test": "npm run coverage",
      "afterinstall": "echo 'directly after package installation'",
      "aftertest": "echo 'directly after executing the tests'"
    }
  ]
}
```

## Command line interface

The Fugl CLI is desgined to be helpful and, in the absence of a package to use when
testing, the current working directory is checked for a package.json file and if found
is used as the code to test.

### Chaining via stdin

Projects to be tested also be supplied via stdin. In practice, this means that other
tools producing space separated package name/repository arguments can be directly
piped in using UNIX shell facilities:

```
echo 'unexpected-sinon' | xargs | fugl check --package unexpected
```

## Automatic dependent fetching

The support for chaining allows Fugl to be used in conjunction with sister tool
[`shoulder`](https://hello) to deduce a set of dependents for a package automatically
and have these tested for compatibitility.

### Downloads

Testing the most downloaded packages that depend on your module can be achieved with:

```
shoulder --metric downloads unexpected | fugl --package unexpected
```

### Stars

Testing the most starred packages that depend on your module - by using the repository
information in their package.json files and issuing queries to GitHub to retrieve the
number of stars each has - can be achieved with:

for any supplied projects and then issue queries to
GitHub to retrieve the number of stars each project has. Using this is as simple as:

```
shoulder --metric stars unexpected | fugl --package unexpected
```

### Dependency information via Liraries.IO

One limitation of the npm dependents data is that it only includes information about those packages
listed as direct depedents. In order to fetch `devDependencies`, package dependency information can
be requested from [Libraries.IO](https://libraries.io).

Signing up for this tool will provide you with an API key which can be used with Fugl as follows:

```
shoulder --librariesio <api_key> unexpected | fugl --package unexpected
```

## Architecture

Internally Fugl is implemented as a [mocha](https://mochajs.org/)-esque test runner. As checks are
executed events are emitted which are passed into [reporters](https://mochajs.org/#reporters) that
generate output information. A default reporter is included which outputs to the console.

In the case of the HTML reporter, we use JSDOM as the output document and serialise a report on exit.

## Credits

This tool started began as a fork of [dont-break](https://github.com/bahmutov/dont-break.git) but
the drift of use-cases required a substantial rework and thus Fugl was born. Since then the entire
codebase has been rewritten.

### Compatibility with dont-break

Some effort was made to continue to support users of `dont-break`. The fugl binary accept a config
parameter which can be used to load a dont-break JSON config file:

```
fugl --config .dont-break.json
```

As development has continued, previous configurations my require changes as functionality is replaced:

- config files containing an array of projects at the top level

```
// .dont-break.json
["project1", "project2"]

// must be rewritten as:
{
  "projects": ["project1", "project2"]
}
```

- config files containing topDownloads or topStarred

```
// for topDownloads
shoulder --metric downloads .

// for topStarred
shoulder --metric stars .
```
