![](/banner.png)

<h1 align="center">laravel-deploy-preview</h1>

<p align="center">
    <strong>A GitHub Action to create on-demand preview environments for Laravel apps.</strong>
</p>

<p align="center">
    <!-- TODO test status -->
    <a href="https://github.com/bakerkretzmar/laravel-deploy-preview/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-darkcyan.svg" alt="MIT License"></a>
</p>

## About

`bakerkretzmar/laravel-deploy-preview` is a GitHub Action to automatically deploy new Laravel app instances to Laravel Forge (current) or Vapor (planned). It's perfect for creating PR preview environments that are isolated, publicly accessible (or privately, depending on your server's settings), and closely resemble your production environment, to preview and test your changes.

When you open a PR and this action runs for the first time, it will:

- Create a new site on Forge with a unique subdomain and install your Laravel app into it.
- Create a new database for the site and configure your app to use it.
- Create and install an SSL certificate and comment on your PR with a link to the site.
- Set up a scheduled job in Forge to run your site's scheduler.
- Enable [Quick Deploy](https://forge.laravel.com/docs/1.0/sites/deployments.html#quick-deploy) on the site so that it updates automatically when you push new code.

## Requirements

Before adding this action to your workflows, make sure you have:

- A Laravel Forge [app server](https://forge.laravel.com/docs/1.0/servers/types.html#app-servers).
- A [wildcard subdomain DNS record](https://en.wikipedia.org/wiki/Wildcard_DNS_record) pointing to your Forge server.
- A Forge [API token](https://forge.laravel.com/docs/1.0/accounts/api.html#create-api-token).

## :warning: Security

**This action will have direct access to your Laravel Forge account and should only be used in trusted contexts.** Users who have permission to push to a repository using this action will be able to execute arbitrary code on any connected Forge servers.

To help ensure that this action runs securely and in isolation:

- Create a new Forge API token for this action to use, and don't use that token anywhere else, so that it's easy to rotate or revoke if necessary.
- Use a dedicated Forge server for deploy previews. This action can be destructive, so nothing critical (e.g. production data) should be hosted on the same server it uses.

Please enjoy responsibly!

## Usage

Add your Forge API token as an [Actions Secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) in your GitHub repository. Then, use `bakerkretzmar/laravel-deploy-preview` inside any workflow.

For the action to be able to clean up preview sites and other resources after a PR is merged, it has to be triggered on the pull request "closed" event. By default, GitHub's `pull_request` event does _not_ trigger a workflow run when its activity type is `closed`, so you may need to place this action in its own workflow file that specifies that event type:

```yaml
# deploy-preview.yml
on:
  pull_request:
    types: [opened, closed]
jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: bakerkretzmar/laravel-deploy-preview@v2
        with:
          forge-token: ${{ secrets.FORGE_TOKEN }}
          servers: |
            qa-1.acme.dev 60041
```

### Inputs

#### `forge-token` (required)

The `forge-token` input parameter accepts your Forge API token, which the action uses to communicate with Laravel Forge to create sites and other resources. **Store this value in an encrypted secret; do not paste it directly into your workflow file.**

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
```

#### `servers` (required)

The `servers` input parameter accepts a list of Forge servers to deploy to.

Each server must include both a domain name and a server ID, separated by a space. The domain name should be the wildcard subdomain pointing at that server (without the wildcard part). For example, if your wildcard subdomain is `*.qa-1.acme.dev` and your Forge server ID is `60041`, set this input parameter to `qa-1.acme.dev 60041`.

If this input parameter contains multiple lines, each line will be treated as a different Forge server. We plan to support deploying to whichever server has the fewest sites already running on it, but the action currently only deploys to one server; if you list multiple servers, it will use the first one.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
      qa-2.acme.dev 60043
```

#### `after-deploy`

The `after-deploy` input parameter allows you to append additional commands to be run after the Forge deploy script.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    after-deploy: npm ci && npm run build
```

#### `environment`

The `environment` input parameter allows you to add and update environment variables in the preview site.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    environment: |
      APP_ENV=preview
      TELESCOPE_ENABLED=false
```

#### `aliases`

The `aliases` input allows you to add domain aliases for the preview site. It supports some custom formatting to make it easier to generate domain names dynamically:

- Aliases starting with a period will be treated as alternate root domains and will have the default subdomain prepended to them (e.g. on a branch called `my-feature`, providing `.acme-preview.dev` in this parameter will add a Forge alias of `my-feature.acme-preview.dev`).
- Aliases ending with a period will be treated as alternate subdomains and will have the default root domain appended to them (e.g. with a root domain of `acme-preview.dev`, providing `my-feature.` in this parameter will also add a Forge alias of `my-feature.acme-preview.dev`). This is particularly useful if you want to generate additional URLs based on GitHub Actions metadata from your workflow file, like a PR number.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    aliases: |
      .acme-qa.dev
      pr-${{ github.event.number }}.
      hardcoded-specific-url.acme-qa.dev
```

The example above, for PR #20 on a branch called `feature`, would create a Forge site with the domain `feature.qa-1.acme.dev` and aliases `feature.acme-qa.dev`, `pr-20.qa-1.acme.dev`, and `hardcoded-specific-url.acme-qa.dev`.

#### `isolated` & `username`

The `isolated` and `username` inputs allow you to enable Forge site isolation and optionally set the isolated user's name. If `username` is omitted the site/branch name will be used.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    isolated: true
```

#### `php-version`

The `php-version` input allows you to set the PHP version of the preview site. The version provided must already be installed on the server.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    php-version: 8.4
```

#### `existing-certificate` & `existing-certificate-key`

The `existing-certificate` and `existing-certificate-key` input parameters allow you to supply a custom SSL certificate for the preview site instead of obtaining one from Let’s Encrypt.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    existing-certificate: ${{ secrets.SSL_CERTIFICATE }}
    existing-certificate-key: ${{ secrets.SSL_PRIVATE_KEY }}
```

#### `clone-certificate`

The `clone-certificate` input parameter allows you to clone an existing Forge SSL certificate for the preview site instead of obtaining one from Let’s Encrypt. The parameter value should be the ID of an existing SSL certificate in Forge.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    clone-certificate: 90051
```

#### `deployment-webhooks`

The `deployment-webhooks` input parameter allows you to add webhook URLs that Forge will notify of all deployments.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    deployment-webhooks: |
      https://webhooks.example.com/1
      https://webhooks.example.com/2
```

#### `deployment-failure-email`

The `deployment-failure-email` input parameter allows you to define a custom email address that Forge will notify of all deployment failures.

Example:

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    deployment-failure-email: failure@example.com
```

### Databases

This action creates a new database for each preview site and deletes the database when the preview site is deleted. If your Forge server has one of the default supported database engines installed (MySQL, MariaDB, or PostgreSQL), that database engine will be used and no additional configuration is necessary.

To use SQLite, set your preview sites’ `DB_CONNECTION` environment variable to `sqlite` using [the `environment` input](#environment):

```yaml
- uses: bakerkretzmar/laravel-deploy-preview@v2
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      qa-1.acme.dev 60041
    environment: |
      DB_CONNECTION=sqlite
```

## Development

This action is loosely based on GitHub's [hello-world-javascript-action](https://github.com/actions/hello-world-javascript-action) and [typescript-action](https://github.com/actions/typescript-action) templates. It's written in TypeScript and compiled with [`ncc`](https://github.com/vercel/ncc) into a single JavaScript file.

Run `npm run build` to compile a new version of the action for distribution.

To run the action locally, create a `.env` file and add your Forge API token to it, then edit `src/debug.ts` to manually set the input values you want to use, and finally run `npm run debug`.

When releasing a new version of the action, update the major version tag to point to the same commit as the latest patch release. This is what allows users to use `bakerkretzmar/laravel-deploy-preview@v2` in their workflows instead of `bakerkretzmar/laravel-deploy-preview@v2.0.2`. For example, after tagging and releasing `v2.0.2`, delete the `v2` tag locally, create it again pointing to the same commit as `v2.0.2`, and force push your tags with `git push -f --tags`.
