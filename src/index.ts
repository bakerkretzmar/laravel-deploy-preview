import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-definitions/schema.js';
import { Forge } from './forge.js';
import { createPreview, destroyPreview } from './action.js';

const servers = core.getMultilineInput('servers', { required: true }).map((line) => {
  core.debug(`Parsing server input line: ${line}`);
  try {
    const [domain, id] = line.split(' ');
    if (!domain || !id) {
      throw new Error(
        `Each line must contain a domain name and a Forge server ID separated by one space. Found '${line}'.`,
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

const environment = core.getMultilineInput('environment', { required: false }).reduce((all, line) => {
  const [key, value] = line.split('=');
  return { ...all, [key]: value };
}, {});

const pr = github.context.payload as PullRequestEvent;

if (pr.action === 'opened' || pr.action === "reopened") {
  // TODO seems like there's a bug in these type definitions, narrowing it to PullRequestOpenedEvent causes an error
  const pr = github.context.payload as PullRequestEvent;
  const preview = await createPreview({
    name: pr.pull_request.head.ref,
    repository: pr.repository.full_name,
    servers,
    afterDeploy,
    environment,
    info: core.info,
    debug: core.debug,
  });

  const octokit = github.getOctokit(core.getInput('github-token', { required: true }));
  octokit.rest.issues.createComment({
    owner: pr.repository.owner.login,
    repo: pr.repository.name,
    issue_number: pr.number,
    body: preview.url,
  });
} else if (pr.action === 'closed') {
  await destroyPreview({
    name: pr.pull_request.head.ref,
    servers,
    info: core.info,
    debug: core.debug,
  });
}
