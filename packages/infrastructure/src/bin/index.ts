#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { S3Stack } from 'lib/s3.stack'
import { z } from 'zod'

const envSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'production', 'local'])
})
const env = envSchema.parse(process.env)
if (env.ENVIRONMENT === 'local') {
  throw new Error('Cannot deploy to local environment')
}

const app = new cdk.App()

// s3
new S3Stack(app, 'RedactPIIS3Stack', {
  deploymentEnvironment: env.ENVIRONMENT
})
