import { EnvironmentVariables } from 'util/environ'
import { logger } from 'util/logger'

import {
  S3Client,
  WriteGetObjectResponseCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'

import { rewriteS3ObjectFile } from 'rewriteCredential'
import { CredentialsFileSchema, type CredentialsFile } from 'types/credentials'
import { S3ObjectLambdaEventSchema, type S3ObjectLambdaEvent } from 'types/s3'

const s3Client = new S3Client({})

type S3ObjectKeyInfo = {
  key: string
  bucket: string
}

/**
 * Parse the URL to extract the S3 object key and bucket name
 * @param url - URL from userRequest
 * @returns S3ObjectKeyInfo
 */
const parseS3ObjectKeyInfo = (url: string): S3ObjectKeyInfo => {
  const urlObj = new URL(url)
  const key = urlObj.pathname.substring(1)
  const bucket = EnvironmentVariables.BUCKET_NAME

  if (!key) {
    throw new Error(`Unable to parse object key from URL: ${url}`)
  }

  return { key, bucket }
}
/**
 * Fetch content from S3 using the userRequest information
 * @param url - Signed URL from userRequest
 * @returns file content as string
 */
const fetchFromS3 = async (url: string): Promise<CredentialsFile> => {
  const { key, bucket } = parseS3ObjectKeyInfo(url)

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  })

  const response = await s3Client.send(command)

  if (!response.Body) {
    throw new Error('No body in S3 response')
  }

  // Convert stream to string
  const bodyContents = await response.Body.transformToString()
  return CredentialsFileSchema.parse(JSON.parse(bodyContents))
}

/**
 * Send transformed content back to S3 Object Lambda using AWS SDK
 * @param requestRoute - S3 request route
 * @param requestToken - S3 request token
 * @param transformedContent - redacted content
 */
const writeResponse = async (
  requestRoute: string,
  requestToken: string,
  transformedContent: string
): Promise<void> => {
  const command = new WriteGetObjectResponseCommand({
    RequestRoute: requestRoute,
    RequestToken: requestToken,
    Body: transformedContent,
    ContentType: 'application/json'
  })

  await s3Client.send(command)
}

/**
 * S3 Object Lambda handler
 * @param event - S3ObjectLambdaEvent
 */
const handler = async (event: S3ObjectLambdaEvent): Promise<void> => {
  const parsedEvent = S3ObjectLambdaEventSchema.parse(event)
  const { outputRoute, outputToken } = parsedEvent.getObjectContext

  try {
    // Fetch original content from S3 using the userRequest URL
    const originalContent = await fetchFromS3(parsedEvent.userRequest.url)

    // Rewrite credentials to redact sensitive info
    const { key } = parseS3ObjectKeyInfo(parsedEvent.userRequest.url)
    const updatedCredentialsFile = await rewriteS3ObjectFile(
      originalContent,
      key
    )

    // Send redacted content back to S3 Object Lambda
    await writeResponse(
      outputRoute,
      outputToken,
      JSON.stringify(updatedCredentialsFile)
    )

    logger.info('Successfully processed and redacted S3 object')
  } catch (error) {
    logger.error('Error processing object:', error)
    throw error
  }
}

export { handler }
