import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  SSMClient,
  PutParameterCommand,
  GetParameterCommand
} from '@aws-sdk/client-ssm'
import { mockClient } from 'aws-sdk-client-mock'
import type { CredentialsFile } from 'types/credentials'
import { rewriteS3ObjectFile } from './rewriteCredential'

// Mock the clients
const s3Mock = mockClient(S3Client)
const ssmMock = mockClient(SSMClient)

// Mock environment variables
jest.mock('./util/environ', () => ({
  EnvironmentVariables: {
    BUCKET_NAME: 'test-bucket'
  }
}))

describe('rewriteCredential', () => {
  beforeEach(() => {
    s3Mock.reset()
    ssmMock.reset()
    jest.clearAllMocks()
  })

  describe('rewriteS3ObjectFile', () => {
    it('should store new credentials in SSM and redact them in S3', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [
          { clientId: 'client-1', apiKey: 'sk_live_abc123xyz' },
          { clientId: 'client-2', apiKey: 'sk_test_def456uvw' }
        ],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      // Should store credentials in SSM
      expect(ssmMock.calls()).toHaveLength(2)
      expect(ssmMock.call(0).args[0].input).toMatchObject({
        Name: '/pii/client-1/credentials',
        Value: JSON.stringify({
          clientId: 'client-1',
          apiKey: 'sk_live_abc123xyz'
        }),
        Type: 'String',
        Overwrite: true
      })
      expect(ssmMock.call(1).args[0].input).toMatchObject({
        Name: '/pii/client-2/credentials',
        Value: JSON.stringify({
          clientId: 'client-2',
          apiKey: 'sk_test_def456uvw'
        }),
        Type: 'String',
        Overwrite: true
      })

      // Should write redacted version to S3
      expect(s3Mock.calls()).toHaveLength(1)
      const s3Call = s3Mock.call(0).args[0].input
      expect(s3Call).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.json'
      })

      const bodyContent = JSON.parse(
        (s3Call as { Body: string }).Body
      ) as CredentialsFile
      expect(bodyContent.credentials).toEqual([
        { clientId: 'client-1', apiKey: '****3xyz' },
        { clientId: 'client-2', apiKey: '****6uvw' }
      ])
      expect(bodyContent.lastUpdated).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )

      // Should return full credentials
      expect(result.credentials).toEqual([
        { clientId: 'client-1', apiKey: 'sk_live_abc123xyz' },
        { clientId: 'client-2', apiKey: 'sk_test_def456uvw' }
      ])
      expect(result.lastUpdated).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
    })

    it('should retrieve full credentials from SSM when already redacted', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [
          { clientId: 'client-1', apiKey: '****3xyz' },
          { clientId: 'client-2', apiKey: '****6uvw' }
        ],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Value: JSON.stringify({
            clientId: 'client-1',
            apiKey: 'sk_live_abc123xyz'
          })
        }
      })

      ssmMock
        .on(GetParameterCommand, {
          Name: '/pii/client-2/credentials'
        })
        .resolves({
          Parameter: {
            Value: JSON.stringify({
              clientId: 'client-2',
              apiKey: 'sk_test_def456uvw'
            })
          }
        })

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      // Should fetch from SSM
      expect(ssmMock.calls()).toHaveLength(2)
      expect(ssmMock.call(0).args[0].input).toMatchObject({
        Name: '/pii/client-1/credentials'
      })
      expect(ssmMock.call(1).args[0].input).toMatchObject({
        Name: '/pii/client-2/credentials'
      })

      // Should NOT write to S3 (already redacted)
      expect(s3Mock.calls()).toHaveLength(0)

      // Should return full credentials
      expect(result.credentials).toEqual([
        { clientId: 'client-1', apiKey: 'sk_live_abc123xyz' },
        { clientId: 'client-2', apiKey: 'sk_test_def456uvw' }
      ])
      expect(result.lastUpdated).toBe('2025-10-23T12:00:00Z')
    })

    it('should handle mixed redacted and unredacted credentials', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [
          { clientId: 'client-1', apiKey: '****3xyz' },
          { clientId: 'client-2', apiKey: 'sk_test_def456uvw' }
        ],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      // Mock SSM get for redacted credential
      ssmMock
        .on(GetParameterCommand, {
          Name: '/pii/client-1/credentials'
        })
        .resolves({
          Parameter: {
            Value: JSON.stringify({
              clientId: 'client-1',
              apiKey: 'sk_live_abc123xyz'
            })
          }
        })

      // Mock SSM put for new credential
      ssmMock.on(PutParameterCommand).resolves({})

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      // Should get from SSM for redacted and put to SSM for new
      expect(ssmMock.calls()).toHaveLength(2)

      // Should write redacted version to S3 (because at least one was unredacted)
      expect(s3Mock.calls()).toHaveLength(1)
      const bodyContent = JSON.parse(
        (s3Mock.call(0).args[0].input as { Body: string }).Body
      ) as CredentialsFile
      expect(bodyContent.credentials).toEqual([
        { clientId: 'client-1', apiKey: '****3xyz' },
        { clientId: 'client-2', apiKey: '****6uvw' }
      ])

      // Should return full credentials
      expect(result.credentials).toEqual([
        { clientId: 'client-1', apiKey: 'sk_live_abc123xyz' },
        { clientId: 'client-2', apiKey: 'sk_test_def456uvw' }
      ])
    })

    it('should handle single credential', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      expect(ssmMock.calls()).toHaveLength(1)
      expect(s3Mock.calls()).toHaveLength(1)

      expect(result.credentials).toEqual([
        { clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }
      ])
    })

    it('should handle empty credentials array', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      // Should not call SSM or S3
      expect(ssmMock.calls()).toHaveLength(0)
      expect(s3Mock.calls()).toHaveLength(0)

      expect(result).toEqual({
        credentials: [],
        lastUpdated: '2025-10-23T12:00:00Z'
      })
    })

    it('should preserve other credential properties', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      expect(result.credentials[0]).toEqual({
        clientId: 'client-1',
        apiKey: 'sk_live_abc123xyz'
      })
    })

    it('should update lastUpdated timestamp when redacting', async () => {
      const originalTimestamp = '2025-10-23T12:00:00Z'
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: originalTimestamp
      }

      ssmMock.on(PutParameterCommand).resolves({})

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      expect(result.lastUpdated).not.toBe(originalTimestamp)
      expect(result.lastUpdated).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
    })

    it('should preserve lastUpdated when all credentials already redacted', async () => {
      const originalTimestamp = '2025-10-23T12:00:00Z'
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: '****3xyz' }],
        lastUpdated: originalTimestamp
      }

      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Value: JSON.stringify({
            clientId: 'client-1',
            apiKey: 'sk_live_abc123xyz'
          })
        }
      })

      const result = await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      expect(result.lastUpdated).toBe(originalTimestamp)
    })

    it('should properly format redacted API keys with last 4 characters', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [
          { clientId: 'client-1', apiKey: 'a' },
          { clientId: 'client-2', apiKey: 'ab' },
          { clientId: 'client-3', apiKey: 'abc' },
          { clientId: 'client-4', apiKey: 'abcd' },
          { clientId: 'client-5', apiKey: 'abcde' }
        ],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      const bodyContent = JSON.parse(
        (s3Mock.call(0).args[0].input as { Body: string }).Body
      ) as CredentialsFile
      expect(bodyContent.credentials).toEqual([
        { clientId: 'client-1', apiKey: '****a' },
        { clientId: 'client-2', apiKey: '****ab' },
        { clientId: 'client-3', apiKey: '****abc' },
        { clientId: 'client-4', apiKey: '****abcd' },
        { clientId: 'client-5', apiKey: '****bcde' }
      ])
    })

    it('should handle S3 put errors', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 error'))

      await expect(
        rewriteS3ObjectFile(credentialsFile, 'test-key.json')
      ).rejects.toThrow('S3 error')
    })

    it('should handle SSM put errors', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).rejects(new Error('SSM error'))

      await expect(
        rewriteS3ObjectFile(credentialsFile, 'test-key.json')
      ).rejects.toThrow('SSM error')
    })

    it('should handle SSM get errors for redacted credentials', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: '****3xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(GetParameterCommand).rejects(new Error('Parameter not found'))

      await expect(
        rewriteS3ObjectFile(credentialsFile, 'test-key.json')
      ).rejects.toThrow('Parameter not found')
    })

    it('should use correct S3 bucket from environment', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      expect((s3Mock.call(0).args[0].input as { Bucket: string }).Bucket).toBe(
        'test-bucket'
      )
    })

    it('should use correct S3 key', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      await rewriteS3ObjectFile(
        credentialsFile,
        'path/to/credentials/file.json'
      )

      expect((s3Mock.call(0).args[0].input as { Key: string }).Key).toBe(
        'path/to/credentials/file.json'
      )
    })

    it('should format S3 body as pretty-printed JSON', async () => {
      const credentialsFile: CredentialsFile = {
        credentials: [{ clientId: 'client-1', apiKey: 'sk_live_abc123xyz' }],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      ssmMock.on(PutParameterCommand).resolves({})

      await rewriteS3ObjectFile(credentialsFile, 'test-key.json')

      const body = (s3Mock.call(0).args[0].input as { Body: string }).Body
      expect(body).toContain('\n')
      expect(body).toContain('  ')
      expect(JSON.parse(body)).toBeDefined()
    })
  })
})
