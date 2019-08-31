# Contributing to DBML

:see_no_evil: :tada: First off, welcome and thanks for taking time to contribute ! :tada: :see_no_evil:

The following is a set of guidelines for contributing to DBML and its packages, which are hosted in the [Holistics Organization](https://github.com/holistics) on GitHub. Feel free to propose changes to this document by opening an issue or creating a pull request.

## Not sure where to start ?

- [PEG.js](https://pegjs.org/): DBML uses PEG.js library to parse different database languages and structure them as plain Javascript object.
- Check out the `parse` folder in `@dbml/core` source code to learn more about how to structure and import different grammars from multiple PEG.js files.
- When you ready to jump to the source code, look for issues tagged with [help wanted](https://github.com/holistics/dbml/labels/help%20wanted) label to get list of current issues you can make a contribution to or create a new issue for suggesting enhancement.
- Check out DBML [website](https://www.dbml-lang.org/home/) for more documentation on DBML syntax.

## Developing

### Setup

DBML is structured as monorepo project. We uses [Lerna](https://github.com/lerna/lerna) to organize and manage multiple packages.

**Install Lerna first:**

    $ npm install -g lerna
    
    # or if you're using yarn
    $ yarn global add lerna

**Clone and build DBML**:

    $ git clone <https://github.com/holistics/dbml.git>
    $ cd dbml
    $ lerna bootstrap
    $ lerna run build

### Running tests

**Run tests for all packages:**

    $ lerna run test

**Run tests for specific package:**

    $ lerna run test --scope <pkg-name>

Example of running test for @dbml/cli:

    $ lerna run test --scope @dbml/cli
    
    info cli using local version of lerna
    lerna notice cli v3.16.4
    lerna info filter [ '@dbml/cli' ]
    lerna info Executing command in 1 package: "yarn run test"
    lerna info run Ran npm script 'test' in '@dbml/cli' in 82.1s:
    yarn run v1.17.3
    $ jest
    Done in 81.28s.
    lerna success run Ran npm script 'test' in 1 package in 82.1s:
    lerna success - @dbml/cli

## Pull Requests Process

- Follow all instructions in the [template](https://github.com/holistics/dbml/blob/master/.github/PULL_REQUEST_TEMPLATE.md)
- Label your pull request with appropriate labels. Check out [Issue and Pull Request Labels](#issue-and-pull-request-labels) section.
- You may merge your Pull Request in once you have the sign-off of two other developer, or if you do not have permission to do that, you may request the core team members to merge it for you.

**Note:** CHANGELOG will be generated based on the type of your Pull Request labels

## Issue and Pull Request Labels

**Type of Issues**

| Label name    | Description           |
| ------------- |-----------------------|
| bug |	Report bugs |
| enhancement |	Feature requests |
| duplicate |	Duplicate with other issues before |
| help wanted |	Need help from the community in resolving these issues |
| invalid |	Invalid issues |
| pkg: \<pkg-name\> |	Issues related to specific packages |
| question | Request further information |

**Pull Request Labels**

| Label name    | Description           | Used for generating CHANGELOG |
| --------------|-----------------------|:---------:|
| PR: Breaking Change :boom: |	Pull Requests propose breaking changes that might break backward compatibility of previous version |	Yes |
| PR: Bug Fix :bug:	| Pull Requests implement bug fixes	| Yes |
| PR: Docs :memo:	| Pull Requests modify or change documentation of packages	| Yes |
| PR: New Feature :rocket:	| Pull Requests implement new features	| Yes |
| PR: Performance :running_woman:	| Pull Requests improve execution time of code	| Yes |
| PR: Refactor :poop:	| Pull Requests improve, change current code structure or get rid of code smells	| No |
| pkg: \<pkg-name\>	| Pull Requests related to specific packages	| No |
