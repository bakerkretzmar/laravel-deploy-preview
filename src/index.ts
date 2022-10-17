import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-definitions/schema.js';
import { InputServer } from './types.js';
import { Forge } from './forge.js';
import { run } from './action.js';

const servers: InputServer[] = core.getMultilineInput('servers', { required: true }).map((line) => {
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

const payload = github.context.payload as PullRequestEvent;

// TODO make a type for all this input
await run(payload.pull_request.head.ref, payload.repository.full_name, servers, afterDeploy);
