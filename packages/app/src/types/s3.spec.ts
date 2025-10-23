import { S3ObjectLambdaEventSchema, type S3ObjectLambdaEvent } from './s3'

describe('S3ObjectLambdaEventSchema', () => {
  const validEventData = {
    xAmzRequestId: 'request-123',
    getObjectContext: {
      inputS3Url: 'https://s3.amazonaws.com/bucket/key',
      outputRoute: 'route-123',
      outputToken: 'token-123'
    },
    configuration: {
      accessPointArn:
        'arn:aws:s3-object-lambda:us-east-1:123456789012:accesspoint/my-access-point',
      supportingAccessPointArn:
        'arn:aws:s3:us-east-1:123456789012:accesspoint/my-supporting-access-point',
      payload: 'payload-data'
    },
    userRequest: {
      url: 'https://example.com/object',
      headers: {
        ['Content-Type']: 'application/json',
        ['Authorization']: 'Bearer token'
      }
    },
    userIdentity: {
      type: 'IAMUser',
      principalId: 'AIDACKCEVSQ6C2EXAMPLE',
      arn: 'arn:aws:iam::123456789012:user/ExampleUser',
      accountId: '123456789012',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE'
    },
    protocolVersion: '1.0'
  }

  it('should validate a valid S3ObjectLambdaEvent', () => {
    expect(() => S3ObjectLambdaEventSchema.parse(validEventData)).not.toThrow()
  })

  it('should return correct type for valid data', () => {
    const result = S3ObjectLambdaEventSchema.parse(validEventData)
    expect(result).toEqual(validEventData)
  })

  it('should throw when one element is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { xAmzRequestId, ...invalidData } = validEventData
    expect(() => S3ObjectLambdaEventSchema.parse(invalidData)).toThrow()
  })

  it('should throw when xAmzRequestId is not a string', () => {
    const invalidData = { ...validEventData, xAmzRequestId: 123 }
    expect(() => S3ObjectLambdaEventSchema.parse(invalidData)).toThrow()
  })

  it('should throw when getObjectContext.inputS3Url is missing', () => {
    const invalidData = {
      ...validEventData,
      getObjectContext: {
        ...validEventData.getObjectContext,
        inputS3Url: undefined
      }
    }
    expect(() => S3ObjectLambdaEventSchema.parse(invalidData)).toThrow()
  })

  it('should throw when userRequest.headers is not a record', () => {
    const invalidData = {
      ...validEventData,
      userRequest: {
        ...validEventData.userRequest,
        headers: 'invalid'
      }
    }
    expect(() => S3ObjectLambdaEventSchema.parse(invalidData)).toThrow()
  })
})

describe('S3ObjectLambdaEvent type', () => {
  it('should infer correct type from schema', () => {
    const event: S3ObjectLambdaEvent = {
      xAmzRequestId: 'test',
      getObjectContext: {
        inputS3Url: 'url',
        outputRoute: 'route',
        outputToken: 'token'
      },
      configuration: {
        accessPointArn: 'arn',
        supportingAccessPointArn: 'arn',
        payload: 'payload'
      },
      userRequest: {
        url: 'url',
        headers: {}
      },
      userIdentity: {
        type: 'type',
        principalId: 'id',
        arn: 'arn',
        accountId: 'account',
        accessKeyId: 'key'
      },
      protocolVersion: '1.0'
    }
    expect(event).toBeDefined()
  })
})
