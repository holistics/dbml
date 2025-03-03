# DBML Docs

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

### Installation

```bash
yarn
```

### Local Development

```bash
yarn dev
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Commit

Before commit your code, please run this command to make the code prettier.

```bash
yarn format
```

### Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Preview local build

Please ensure you run the build command before running the following command

```bash
yarn serve
```

### Deployment

This page is deployed to Github Pages.

To deploy this site, please manually trigger ***Deploy DBML docs to Github Pages*** action.

For more details, please read [Manually running a workflow](https://docs.github.com/en/actions/using-workflows/manually-running-a-workflow).

### Document searching function

We are currently using [docusaurus-lunr-search](https://www.npmjs.com/package/docusaurus-lunr-search) package.

This package only works on production environment, so if you want to test this feature, please serve the application on your local machine. Refer to the ***Preview local build*** section.
