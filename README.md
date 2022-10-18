# Laravel Deploy Preview Action

## Prerequisites

- Forge server
- Wildcard subdomain pointing at Forge server

## Installation & Usage

```yml
- uses: tighten/laravel-deploy-preview@v1
  with:
    forge-token: ${{ secrets.FORGE_TOKEN }}
    servers: |
      example.com 123
```

## Development

Create a `.env` and add your own Forge token.

Use `npm run debug` to run locally.
