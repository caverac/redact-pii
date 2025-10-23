import { z } from 'zod'

export const CredentialSchema = z.object({
  clientId: z.string(),
  apiKey: z.string()
})

export const CredentialsFileSchema = z.object({
  lastUpdated: z.string(),
  credentials: z.array(CredentialSchema)
})

export type CredentialsFile = z.infer<typeof CredentialsFileSchema>
export type Credential = z.infer<typeof CredentialSchema>
