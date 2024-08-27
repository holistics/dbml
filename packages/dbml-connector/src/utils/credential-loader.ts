import { readFile } from 'fs/promises';
import { BigQueryCredentials } from '../connectors/types';

export async function loadCredentialFromFile(filename: string): Promise<string> {
  try {
    const data = await readFile(filename, { encoding: 'utf8' });
    return data;
  } catch (error) {
    if ((error as TypeError).name === 'TypeError' || (error as Error).name === 'Error') {
      throw new Error(`Load credential error: ${(error as Error).message}`);
    }

    throw error;
  }
}

export function parseBigQueryCredential(credentialString: string): BigQueryCredentials {
  try {
    const credentialJson = JSON.parse(credentialString);

    const {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
      datasets,
    } = credentialJson;

    if (typeof projectId !== 'string' || !projectId || !projectId.trim()) {
      throw new Error('project_id must be a non-empty string');
    }

    if (typeof clientEmail !== 'string' || !clientEmail || !clientEmail.trim()) {
      throw new Error('client_email must be a non-empty string');
    }

    if (typeof privateKey !== 'string' || !privateKey || !privateKey.trim()) {
      throw new Error('private_key must be a non-empty string');
    }

    if (typeof clientEmail !== 'string' || !clientEmail || !clientEmail.trim()) {
      throw new Error('client_email must be a non-empty string');
    }

    // valid datasets: ['dataset_1', 'dataset_2']
    const parsedDatasets = !Array.isArray(datasets)
      ? []
      : datasets.filter((dataset) => typeof dataset === 'string');

    return {
      projectId,
      credentials: {
        clientEmail,
        privateKey,
      },
      datasets: parsedDatasets,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Credentials must be in JSON format');
    }

    throw error;
  }
}
