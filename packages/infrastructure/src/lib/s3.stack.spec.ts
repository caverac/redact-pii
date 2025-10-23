import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { S3Stack } from './s3.stack'

describe('s3.stack', () => {
  const testApp = new App({
    outdir: 'cdk.out'
  })

  const testS3Stack = new S3Stack(testApp, 'TestS3Stack', {
    deploymentEnvironment: 'development'
  })
  const testS3StackTemplate = Template.fromStack(testS3Stack)

  it('should have a s3 resources', () => {
    testS3StackTemplate.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'pii-bucket-development'
    })

    testS3StackTemplate.hasResourceProperties('AWS::S3::AccessPoint', {
      Name: 'pii-access-point-development'
    })
  })

  it('should have a lambda function', () => {
    testS3StackTemplate.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'redact-pii__redact-lambda'
    })
  })
})
