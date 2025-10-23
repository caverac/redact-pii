import { EnvironmentVariables } from 'util/environ'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  SSMClient,
  PutParameterCommand,
  GetParameterCommand
} from '@aws-sdk/client-ssm'

import {
  CredentialSchema,
  type Credential,
  type CredentialsFile
} from 'types/credentials'

const ssmClient = new SSMClient({})
const s3Client = new S3Client({})

/**
 * Store credential in SSM Parameter Store and retrieve full credential if redacted
 *
 * This function handles credential persistence to AWS Systems Manager Parameter Store.
 * If the provided credential has a redacted API key (starting with '****'), it fetches
 * the full credential from SSM. Otherwise, it stores the new credential in SSM.
 *
 * @param credential - The credential object to store or validate
 * @param credential.clientId - Unique identifier for the client
 * @param credential.apiKey - API key (may be redacted with '****' prefix)
 * @returns Promise resolving to the full (unredacted) credential object
 * @throws Error if SSM operations fail or stored credential cannot be parsed
 *
 * @example
 * // Store new credential
 * const fullCred = await storeCredential({
 *   clientId: 'client-123',
 *   apiKey: 'sk_live_abc123xyz'
 * })
 *
 * @example
 * // Retrieve full credential from redacted version
 * const fullCred = await storeCredential({
 *   clientId: 'client-123',
 *   apiKey: '****xyz'
 * })
 */
const storeCredential = async (credential: Credential): Promise<Credential> => {
  const { apiKey } = credential

  const isRedacted = apiKey.startsWith('****')
  if (isRedacted) {
    const storedParameter = await ssmClient.send(
      new GetParameterCommand({
        Name: `/pii/${credential.clientId}/credentials`
      })
    )
    return CredentialSchema.parse(JSON.parse(storedParameter.Parameter!.Value!))
  }

  // write to ssm
  await ssmClient.send(
    new PutParameterCommand({
      Name: `/pii/${credential.clientId}/credentials`,
      Value: JSON.stringify(credential),
      Type: 'String',
      Overwrite: true
    })
  )

  return credential
}

/**
 * Redact sensitive API key information from a credential object
 *
 * Masks the API key by replacing all characters except the last 4 with asterisks.
 * This is useful for displaying credentials in logs or user interfaces while
 * maintaining security.
 *
 * @param credential - The credential object containing the API key to redact
 * @param credential.apiKey - The full API key to be redacted
 * @returns A new credential object with the redacted API key (format: '****XXXX')
 *
 * @example
 * const redacted = redactCredential({
 *   clientId: 'client-123',
 *   apiKey: 'sk_live_abc123xyz'
 * })
 * // Returns: { clientId: 'client-123', apiKey: '****3xyz' }
 */
const redactCredential = (credential: Credential): Credential => {
  return {
    ...credential,
    apiKey: '****' + credential.apiKey.slice(-4)
  }
}

/**
 * Rewrite S3 object file with redacted credentials while storing full credentials in SSM
 *
 * This function processes a credentials file object by:
 * 1. Storing/retrieving full credentials from SSM Parameter Store for each credential
 * 2. Detecting if any credentials were redacted in the input
 * 3. If redaction occurred, writing the redacted versions back to the S3 object
 * 4. Updating the lastUpdated timestamp when the file is modified
 * 5. Returning the full (unredacted) credentials file for application use
 *
 * This ensures that sensitive credential data is never persisted in S3 files,
 * while the application can still access the full credentials through SSM.
 *
 * @param credentialsFile - Credentials file object containing an array of credentials and metadata
 * @param credentialsFile.credentials - Array of credential objects (may contain redacted API keys)
 * @param credentialsFile.lastUpdated - ISO timestamp of last file update
 * @param key - S3 object key (file path) where the credentials file is stored
 * @returns Promise resolving to the credentials file with full (unredacted) credentials
 * @throws Error if S3 or SSM operations fail
 *
 * @example
 * const fullCredentialsFile = await rewriteS3ObjectFile(
 *   {
 *     credentials: [
 *       { clientId: 'client-1', apiKey: '****xyz' },
 *       { clientId: 'client-2', apiKey: 'sk_live_newkey123' }
 *     ],
 *     lastUpdated: '2025-10-23T12:00:00Z'
 *   },
 *   'credentials/prod.json'
 * )
 * // Returns full credentials file, updates S3 with redacted versions if needed
 */
export const rewriteS3ObjectFile = async (
  credentialsFile: CredentialsFile,
  key: string
): Promise<CredentialsFile> => {
  const updatedCredentialsFile: CredentialsFile = { ...credentialsFile }

  // fetch credentials
  updatedCredentialsFile.credentials = await Promise.all(
    credentialsFile.credentials.map((cred) => storeCredential(cred))
  )

  // check if file needs to be redacted
  if (
    credentialsFile.credentials.some((cred) => !cred.apiKey.startsWith('****'))
  ) {
    const credentials = credentialsFile.credentials.map(redactCredential)
    const lastUpdated = new Date().toISOString()

    const putObjectCommand = new PutObjectCommand({
      Bucket: EnvironmentVariables.BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(
        {
          lastUpdated,
          credentials
        } as CredentialsFile,
        null,
        2
      )
    })

    await s3Client.send(putObjectCommand)

    updatedCredentialsFile.lastUpdated = lastUpdated
  }

  return updatedCredentialsFile
}
