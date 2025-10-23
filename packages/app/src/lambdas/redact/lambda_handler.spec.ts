import { Readable } from 'stream'

import {
  GetObjectCommand,
  S3Client,
  WriteGetObjectResponseCommand
} from '@aws-sdk/client-s3'
import { sdkStreamMixin } from '@smithy/util-stream'
import { mockClient } from 'aws-sdk-client-mock'

import { handler } from './lambda_handler'
import * as rewriteCredential from '../../rewriteCredential'
import type { CredentialsFile } from '../../types/credentials'
import type { S3ObjectLambdaEvent } from '../../types/s3'

// Mock the clients
const s3Mock = mockClient(S3Client)

// Mock environment variables
jest.mock('../../util/environ', () => ({
  EnvironmentVariables: {
    BUCKET_NAME: 'test-bucket'
  }
}))

// Mock logger
jest.mock('../../util/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}))

// Mock rewriteS3ObjectFile
jest.mock('../../rewriteCredential', () => ({
  rewriteS3ObjectFile: jest.fn()
}))

describe('lambda_handler', () => {
  const mockEvent: S3ObjectLambdaEvent = {
    xAmzRequestId: 'test-request-id',
    getObjectContext: {
      inputS3Url: 'https://test-bucket.s3.amazonaws.com/test-key.json',
      outputRoute: 'test-output-route',
      outputToken: 'test-output-token'
    },
    configuration: {
      accessPointArn: 'arn:aws:s3:us-east-1:123456789012:accesspoint/test-ap',
      supportingAccessPointArn:
        'arn:aws:s3:us-east-1:123456789012:accesspoint/test-support-ap',
      payload: ''
    },
    userRequest: {
      url: 'https://test-bucket.s3.amazonaws.com/test-key.json',
      headers: {
        'user-agent': 'test-agent'
      }
    },
    userIdentity: {
      type: 'AssumedRole',
      principalId: 'test-principal',
      arn: 'arn:aws:sts::123456789012:assumed-role/test-role/test-session',
      accountId: '123456789012',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE'
    },
    protocolVersion: '1.0'
  }

  const mockCredentialsFile: CredentialsFile = {
    credentials: [
      { clientId: 'client-1', apiKey: 'sk_live_abc123xyz' },
      { clientId: 'client-2', apiKey: 'sk_test_def456uvw' }
    ],
    lastUpdated: '2025-10-23T12:00:00Z'
  }

  const mockRedactedCredentialsFile: CredentialsFile = {
    credentials: [
      { clientId: 'client-1', apiKey: '****3xyz' },
      { clientId: 'client-2', apiKey: '****6uvw' }
    ],
    lastUpdated: '2025-10-23T12:00:00Z'
  }

  beforeEach(() => {
    s3Mock.reset()
    jest.clearAllMocks()
  })

  describe('successful processing', () => {
    it('should fetch from S3, rewrite credentials, and send response', async () => {
      // Mock S3 GetObject response
      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(mockCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      // Mock rewriteS3ObjectFile
      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockResolvedValue(mockRedactedCredentialsFile)

      // Mock WriteGetObjectResponse
      s3Mock.on(WriteGetObjectResponseCommand).resolves({})

      await handler(mockEvent)

      // Verify GetObjectCommand was called with correct parameters
      const getObjectCalls = s3Mock.commandCalls(GetObjectCommand)
      expect(getObjectCalls).toHaveLength(1)
      expect(getObjectCalls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'test-key.json'
      })

      // Verify rewriteS3ObjectFile was called
      expect(mockRewriteS3ObjectFile).toHaveBeenCalledWith(
        mockCredentialsFile,
        'test-key.json'
      )

      // Verify WriteGetObjectResponse was called
      const writeResponseCalls = s3Mock.commandCalls(
        WriteGetObjectResponseCommand
      )
      expect(writeResponseCalls).toHaveLength(1)
      expect(writeResponseCalls[0].args[0].input).toMatchObject({
        RequestRoute: 'test-output-route',
        RequestToken: 'test-output-token',
        Body: JSON.stringify(mockRedactedCredentialsFile),
        ContentType: 'application/json'
      })
    })

    it('should extract key from URL pathname correctly', async () => {
      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(mockCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockResolvedValue(mockRedactedCredentialsFile)
      s3Mock.on(WriteGetObjectResponseCommand).resolves({})

      const eventWithNestedKey: S3ObjectLambdaEvent = {
        ...mockEvent,
        userRequest: {
          ...mockEvent.userRequest,
          url: 'https://test-bucket.s3.amazonaws.com/credentials/prod/app-credentials.json'
        }
      }

      await handler(eventWithNestedKey)

      // Verify GetObject was called with nested key
      const getObjectCalls = s3Mock.commandCalls(GetObjectCommand)
      expect(getObjectCalls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'credentials/prod/app-credentials.json'
      })

      // Verify rewriteS3ObjectFile was called with correct key
      expect(mockRewriteS3ObjectFile).toHaveBeenCalledWith(
        mockCredentialsFile,
        'credentials/prod/app-credentials.json'
      )
    })
  })

  describe('error handling', () => {
    it('should throw error when S3 GetObject fails', async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error('S3 GetObject failed'))

      await expect(handler(mockEvent)).rejects.toThrow('S3 GetObject failed')
    })

    it('should throw error when S3 response has no body', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: undefined
      })

      await expect(handler(mockEvent)).rejects.toThrow('No body in S3 response')
    })

    it('should throw error when URL has no key', async () => {
      const eventWithEmptyKey: S3ObjectLambdaEvent = {
        ...mockEvent,
        userRequest: {
          ...mockEvent.userRequest,
          url: 'https://test-bucket.s3.amazonaws.com/'
        }
      }

      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(mockCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      await expect(handler(eventWithEmptyKey)).rejects.toThrow(
        'Unable to parse object key from URL'
      )
    })

    it('should throw error when credentials file is invalid JSON', async () => {
      const mockStream = sdkStreamMixin(Readable.from(['invalid json']))
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      await expect(handler(mockEvent)).rejects.toThrow()
    })

    it('should throw error when credentials file fails schema validation', async () => {
      const invalidCredentialsFile = {
        credentials: [
          { clientId: 'client-1' } // missing apiKey
        ],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(invalidCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      await expect(handler(mockEvent)).rejects.toThrow()
    })

    it('should throw error when rewriteS3ObjectFile fails', async () => {
      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(mockCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockRejectedValue(new Error('Rewrite failed'))

      await expect(handler(mockEvent)).rejects.toThrow('Rewrite failed')
    })

    it('should throw error when WriteGetObjectResponse fails', async () => {
      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(mockCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockResolvedValue(mockRedactedCredentialsFile)

      s3Mock
        .on(WriteGetObjectResponseCommand)
        .rejects(new Error('Write response failed'))

      await expect(handler(mockEvent)).rejects.toThrow('Write response failed')
    })

    it('should throw error when event schema validation fails', async () => {
      const invalidEvent = {
        ...mockEvent,
        getObjectContext: undefined // Missing required field
      } as unknown as S3ObjectLambdaEvent

      await expect(handler(invalidEvent)).rejects.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle empty credentials array', async () => {
      const emptyCredentialsFile: CredentialsFile = {
        credentials: [],
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(emptyCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockResolvedValue(emptyCredentialsFile)
      s3Mock.on(WriteGetObjectResponseCommand).resolves({})

      await handler(mockEvent)

      expect(mockRewriteS3ObjectFile).toHaveBeenCalledWith(
        emptyCredentialsFile,
        'test-key.json'
      )
    })

    it('should handle credentials file with multiple credentials', async () => {
      const largeCredentialsFile: CredentialsFile = {
        credentials: Array.from({ length: 100 }, (_, i) => ({
          clientId: `client-${i}`,
          apiKey: `sk_live_${i}_abc123xyz`
        })),
        lastUpdated: '2025-10-23T12:00:00Z'
      }

      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(largeCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockResolvedValue({
        ...largeCredentialsFile,
        credentials: largeCredentialsFile.credentials.map((cred) => ({
          ...cred,
          apiKey: `****${cred.apiKey.slice(-4)}`
        }))
      })
      s3Mock.on(WriteGetObjectResponseCommand).resolves({})

      await handler(mockEvent)

      expect(mockRewriteS3ObjectFile).toHaveBeenCalledWith(
        largeCredentialsFile,
        'test-key.json'
      )
    })

    it('should handle URL with special characters in key', async () => {
      const mockStream = sdkStreamMixin(
        Readable.from([JSON.stringify(mockCredentialsFile)])
      )
      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream
      })

      const mockRewriteS3ObjectFile = jest.spyOn(
        rewriteCredential,
        'rewriteS3ObjectFile'
      )
      mockRewriteS3ObjectFile.mockResolvedValue(mockRedactedCredentialsFile)
      s3Mock.on(WriteGetObjectResponseCommand).resolves({})

      const eventWithSpecialChars: S3ObjectLambdaEvent = {
        ...mockEvent,
        userRequest: {
          ...mockEvent.userRequest,
          url: 'https://test-bucket.s3.amazonaws.com/credentials/my%20file.json'
        }
      }

      await handler(eventWithSpecialChars)

      const getObjectCalls = s3Mock.commandCalls(GetObjectCommand)
      expect(getObjectCalls[0].args[0].input.Key).toBe(
        'credentials/my%20file.json'
      )
    })
  })
})
