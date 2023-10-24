import { describe, expect, test, vi } from 'vitest';
import * as core from '@actions/core';
import { run } from '../src/main';

describe('inputs', () => {
  const coreSetFailed = vi.spyOn(core, 'setFailed');

  test('servers input required', async () => {
    vi.stubEnv('INPUT_SERVERS', '');

    await run();

    expect(coreSetFailed).toHaveBeenCalledWith('Input required and not supplied: servers');
  });

  test.each([
    ['single-word', 'single-word'],
    [
      `foo.bar 123
       single-word-2nd-line`,
      'single-word-2nd-line',
    ],
  ])('validate servers input contains domains and server IDs', async (input, failure) => {
    vi.stubEnv('INPUT_SERVERS', input);

    await run();

    expect(coreSetFailed).toHaveBeenCalledWith(
      `Invalid \`servers\` input. Each line must contain a domain name and a Forge server ID, separated by one space. Found '${failure}'.`,
    );
  });

  test.each([
    ['foo.bar d12', 'foo.bar d12'],
    [
      `foo.bar 123
       example.com 1200_`,
      'example.com 1200_',
    ],
  ])('validate servers input server IDs are integers', async (input, failure) => {
    vi.stubEnv('INPUT_SERVERS', input);

    await run();

    expect(coreSetFailed).toHaveBeenCalledWith(
      `Invalid \`servers\` input. Each server ID must be an integer. Found '${failure}'.`,
    );
  });

  test('forge-token input required');

  test('validate existing-certificate and existing-certificate-key inputs required together');

  test('validate existing-certificate/existing-certificate-key and clone-certificate inputs are mutually exclusive');

  test('validate clone-certificate input is an integer');
});
