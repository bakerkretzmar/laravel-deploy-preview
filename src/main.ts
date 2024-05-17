import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { Forge, ForgeError } from './forge.js';
import { createPreview, destroyPreview } from './action.js';

export async function run() {
  try {
    const servers = core.getMultilineInput('servers', { required: true }).map((line) => {
      const [domain, id] = line.split(' ');
      if (!domain || !id) {
        throw new Error(
          `Invalid \`servers\` input. Each line must contain a domain name and a Forge server ID, separated by one space. Found '${line}'.`,
        );
      }
      if (/\D/.test(id)) {
        throw new Error(`Invalid \`servers\` input. Each server ID must be an integer. Found '${line}'.`);
      }
      return {
        id: Number(id),
        domain,
      };
    });

    const forgeToken = core.getInput('forge-token', { required: true });
    const githubToken = core.getInput('github-token', { required: true });

    const afterDeploy = core.getInput('after-deploy', { required: false });

    const environment = core.getMultilineInput('environment', { required: false }).reduce((all, line) => {
      const [key, value] = line.split('=');
      return { ...all, [key]: value };
    }, {});

    const existingCertificate = core.getInput('existing-certificate', { required: false });
    const existingCertificateKey = core.getInput('existing-certificate-key', { required: false });
    const cloneCertificate = core.getInput('clone-certificate', { required: false });
    const noCertificate = core.getBooleanInput('no-certificate', { required: false });

    let certificate:
      | { type: 'clone'; certificate: number }
      | { type: 'existing'; certificate: string; key: string }
      | undefined
      | false = undefined;

    if (noCertificate) {
      certificate = false;
    } else {
      if (!!existingCertificate !== !!existingCertificateKey) {
        throw new Error(
          `Invalid certificate inputs: ${
            !existingCertificate
              ? '`existing-certificate-key` provided but `existing-certificate` missing.'
              : !existingCertificateKey
                ? '`existing-certificate` provided but `existing-certificate-key` missing'
                : ''
          }`,
        );
      }

      if (cloneCertificate) {
        if (existingCertificate || existingCertificateKey) {
          throw new Error(
            "Invalid certificate inputs: cannot use 'existing' and 'clone' inputs together. Remove `existing-certificate` and `existing-certificate-key`, or remove `clone-certificate`.",
          );
        }

        if (/\D/.test(cloneCertificate)) {
          throw new Error(
            `Invalid \`clone-certificate\` input. Certificate ID must be an integer. Found '${cloneCertificate}'.`,
          );
        }
      }

      certificate = cloneCertificate
        ? {
            type: 'clone',
            certificate: Number(cloneCertificate),
          }
        : existingCertificate
          ? {
              type: 'existing',
              certificate: existingCertificate,
              key: existingCertificateKey,
            }
          : undefined;
    }

    const pr = github.context.payload as PullRequestEvent;

    Forge.token(forgeToken);
    Forge.debug(core.isDebug());

    if (pr.action === 'opened' || pr.action === 'reopened') {
      const preview = await createPreview({
        branch: pr.pull_request.head.ref,
        repository: pr.repository.full_name,
        servers,
        afterDeploy,
        environment,
        certificate,
      });

      if (preview) {
        core.setOutput('site-url', preview.url);
        core.setOutput('site-id', preview.id);

        const octokit = github.getOctokit(githubToken);
        octokit.rest.issues.createComment({
          owner: pr.repository.owner.login,
          repo: pr.repository.name,
          issue_number: pr.number,
          body: preview.url,
        });
      }
    } else if (pr.action === 'closed') {
      const preview = await destroyPreview({
        branch: pr.pull_request.head.ref,
        servers,
        environment,
      });

      if (preview) {
        core.setOutput('site-id', preview.id);
      }
    }
  } catch (error) {
    if (error instanceof ForgeError) {
      core.info(JSON.stringify(error.data, null, 2));
      if (error.detail) {
        core.info(error.detail);
      }
    }
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
