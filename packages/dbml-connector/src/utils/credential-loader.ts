import { readFile } from 'fs/promises';
import { BigQueryCredentials } from '../connectors/types';

export async function loadCredentialFromFile (filename: string): Promise<string> {
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

export function parseBigQueryCredential (credentialString: string): BigQueryCredentials {
  try {
    const credentialJson = JSON.parse(credentialString);

    const {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
      datasets,
    } = credentialJson;

    // valid datasets: ['dataset_1', 'dataset_2']
    const parsedDatasets = !Array.isArray(datasets)
      ? []
      : datasets.filter((dataset) => typeof dataset === 'string');

    const parsedCredentials: BigQueryCredentials = {
      datasets: parsedDatasets,
    };

    // Validate and add projectId if provided
    if (projectId !== undefined) {
      if (typeof projectId !== 'string' || !projectId || !projectId.trim()) {
        throw new Error('project_id must be a non-empty string when provided');
      }
      parsedCredentials.projectId = projectId;
    }

    // Validate and add credentials if provided
    // Note: If one credential field is provided, both must be provided
    if (clientEmail !== undefined || privateKey !== undefined) {
      if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.trim()) {
        throw new Error('client_email must be a non-empty string when credentials are provided');
      }

      if (!privateKey || typeof privateKey !== 'string' || !privateKey.trim()) {
        throw new Error('private_key must be a non-empty string when credentials are provided');
      }

      parsedCredentials.credentials = {
        clientEmail,
        privateKey,
      };
    }

    return parsedCredentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Credentials must be in JSON format');
    }

    throw error;
  }
}
