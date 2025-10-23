import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import type * as constructs from 'constructs'
import { getAllowedOrigins } from 'utils/cors'

interface S3StackProps extends cdk.StackProps {
  deploymentEnvironment: string
}

/**
 *
 */
export class S3Stack extends cdk.Stack {
  private scope: constructs.Construct
  public bucket: cdk.aws_s3.IBucket

  private accessPoint: cdk.aws_s3.CfnAccessPoint
  private lambdaFunction: cdk.aws_lambda_nodejs.NodejsFunction

  private deploymentEnvironment: string

  /**
   * @param scope - cdk stack
   * @param id - stack id
   * @param props - stack props
   */
  constructor(scope: constructs.Construct, id: string, props: S3StackProps) {
    super(scope, id, props)

    this.scope = this
    this.deploymentEnvironment = props.deploymentEnvironment

    this.bucket = this.createBucket()
    this.accessPoint = this.createAccessPoint()
    this.lambdaFunction = this.createLambda()
    this.createObjectLambdaAccessPoint()
    this.storeParameters()
  }

  /**
   * Bucket to store info from the api
   * @returns bucket name
   */
  private createBucket(): cdk.aws_s3.IBucket {
    // bucket
    const bucket = new cdk.aws_s3.Bucket(this.scope, 'S3Bucket', {
      bucketName: `pii-bucket-${this.deploymentEnvironment}`,
      cors: [
        {
          allowedMethods: [
            cdk.aws_s3.HttpMethods.GET,
            cdk.aws_s3.HttpMethods.PUT
          ],
          allowedOrigins: getAllowedOrigins(this.deploymentEnvironment),
          allowedHeaders: ['*']
        }
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    return bucket
  }

  /**
   * Create S3 Access Point
   */
  private createAccessPoint(): cdk.aws_s3.CfnAccessPoint {
    const accessPoint = new cdk.aws_s3.CfnAccessPoint(
      this.scope,
      'S3AccessPoint',
      {
        bucket: this.bucket.bucketName,
        name: `pii-access-point-${this.deploymentEnvironment}`
      }
    )
    return accessPoint
  }

  /**
   * Create Lambda Function
   */
  private createLambda(): cdk.aws_lambda_nodejs.NodejsFunction {
    const functionName = 'redact-pii__redact-lambda'
    const description = '[redact pii] redact pii from files in s3 bucket'
    const memorySize = 128
    const duration = 25

    const functionProps: cdk.aws_lambda_nodejs.NodejsFunctionProps = {
      functionName,
      entry: path.join(
        __dirname,
        '..',
        '..',
        '..',
        'app',
        'src',
        'lambdas',
        'redact',
        'lambda_handler.ts'
      ),
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      description,
      environment: {
        ENVIRONMENT: this.deploymentEnvironment,
        BUCKET_NAME: this.bucket.bucketName
      },
      memorySize,
      timeout: cdk.Duration.seconds(duration),
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [
            this.bucket.bucketArn,
            `${this.bucket.bucketArn}/*`,
            `arn:aws:s3:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:accesspoint/${this.accessPoint.name}`,
            `arn:aws:s3:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:accesspoint/${this.accessPoint.name}/object/*`
          ]
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: ['s3-object-lambda:WriteGetObjectResponse'],
          resources: ['*']
        }),
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:PutParameter'
          ],
          resources: [
            `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter/pii/*`
          ]
        })
      ],
      projectRoot: path.join(__dirname, '..', '..', '..', '..')
    }

    const func = new cdk.aws_lambda_nodejs.NodejsFunction(
      this.scope,
      functionName,
      functionProps
    )

    // Grant the Lambda function read access to the bucket
    this.bucket.grantRead(func)

    return func
  }

  /**
   * Create S3 Object Lambda Access Point
   */
  private createObjectLambdaAccessPoint() {
    new cdk.aws_s3objectlambda.CfnAccessPoint(
      this.scope,
      'S3ObjectLambdaAccessPoint',
      {
        name: `pii-object-lambda-ap-${this.deploymentEnvironment}`,
        objectLambdaConfiguration: {
          supportingAccessPoint: this.accessPoint.attrArn,
          transformationConfigurations: [
            {
              actions: ['GetObject'],
              contentTransformation: {
                AwsLambda: {
                  FunctionArn: this.lambdaFunction.functionArn
                }
              }
            }
          ]
        }
      }
    )
  }

  /**
   * Store parameters
   */
  private storeParameters() {
    new cdk.aws_ssm.StringParameter(this.scope, 'SSMBucketArn', {
      parameterName: '/pii/s3/bucket-arn',
      stringValue: this.bucket.bucketArn
    })

    new cdk.aws_ssm.StringParameter(this.scope, 'SSMBucketName', {
      parameterName: '/pii/s3/bucket-name',
      stringValue: this.bucket.bucketName
    })
  }
}
