# Laravel Deploy Preview Action

TODO
- support vapor
    - make both api keys (forge/vapor) optional but always make sure _one_ of them is present, infer the platform from which one it is
- test lots of invalid input
- add support for multiple servers with different domains
- add support for multiple servers with _one_ domain (i think this would be really hard?)
- add support for as many Forge services/settings as possible, e.g.:
    - queues
    - other kinds of databases
    - fully custom deploy scripts
    - isolation
    - php versions?
- tear down sites when PR is closed
    - delete database
    - delete site
    - delete job
    - queues??
- more deploy script customization (provide template, default, etc?)
- security
    - HUGE warning about automatically running code from rando PRs
    - add note about this being destructive -- don't put other important stuff on the same servers
    - add note about using a new forge api key specifically for this action so it can be revoked/rotated easily

## Prerequisites

- Forge server
- Wildcard subdomain pointing at Forge server

## Installation & Usage

```yml
- uses: tighten/laravel-deploy-preview@v1
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
```

## Development

Create a `.env` and add your own Forge token.

Use `npm run debug` to run locally.
