import { z } from 'zod'

export const S3ObjectLambdaEventSchema = z.object({
  xAmzRequestId: z.string(),
  getObjectContext: z.object({
    inputS3Url: z.string(),
    outputRoute: z.string(),
    outputToken: z.string()
  }),
  configuration: z.object({
    accessPointArn: z.string(),
    supportingAccessPointArn: z.string(),
    payload: z.string()
  }),
  userRequest: z.object({
    url: z.string(),
    headers: z.record(z.string(), z.string())
  }),
  userIdentity: z.object({
    type: z.string(),
    principalId: z.string(),
    arn: z.string(),
    accountId: z.string(),
    accessKeyId: z.string()
  }),
  protocolVersion: z.string()
})

export type S3ObjectLambdaEvent = z.infer<typeof S3ObjectLambdaEventSchema>
