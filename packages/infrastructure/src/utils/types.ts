import type * as cdk from 'aws-cdk-lib'
import type * as constructs from 'constructs'

export interface ApiLambdaIntegrationProps {
  environment: Record<string, string>
  scope: constructs.Construct
  region: string
  account: string
}

export interface ApiResourceProps extends ApiLambdaIntegrationProps {
  api: cdk.aws_apigateway.RestApi
}
