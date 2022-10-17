import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-definitions/schema.js';
import { Forge } from './forge.js';
import { run } from './action.js';

const servers = core.getMultilineInput('servers', { required: true }).map((line) => {
  core.debug(`Parsing server input line: ${line}`);
  try {
    const [domain, id] = line.split(' ');
    if (!domain || !id) {
      throw new Error(
        `Each line must contain a domain name and a Forge server ID separated by one space. Found '${line}'.`
      );
    }
    if (/\D/.test(id)) {
      throw new Error(`Each server ID must be an integer. Found '${line}'.`);
    }
    return { id: Number(id), domain };
  } catch (error) {
    core.error(`Invalid \`servers\` input. ${error.message}`);
  }
});

Forge.setToken(core.getInput('forge-token', { required: true }));

const afterDeploy = core.getInput('after-deploy', { required: false });

const pr = github.context.payload as PullRequestEvent;

const octokit = github.getOctokit(core.getInput('github-token', { required: true }));

const preview = await run({
  name: pr.pull_request.head.ref,
  repository: pr.repository.full_name,
  servers,
  afterDeploy,
  info: core.info,
  debug: core.debug,
});

octokit.rest.issues.createComment({
  owner: pr.repository.owner.login,
  repo: pr.repository.name,
  issue_number: pr.number,
  body: preview.url,
});
