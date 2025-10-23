import { z } from 'zod'

export const environSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'production']),
  BUCKET_NAME: z.string().min(1)
})

export const EnvironmentVariables = environSchema.parse(process.env)
