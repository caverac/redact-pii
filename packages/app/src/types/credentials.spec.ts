import { CredentialSchema, CredentialsFileSchema } from './credentials'

describe('CredentialSchema', () => {
  it('should validate a correct credential', () => {
    const validCredential = {
      clientId: 'client-123',
      apiKey: 'sk_live_abc123xyz'
    }

    expect(CredentialSchema.parse(validCredential)).toEqual(validCredential)
  })

  it('should throw an error for invalid credential', () => {
    const invalidCredential = {
      clientId: 'client-123'
      // Missing apiKey
    }

    expect(() => CredentialSchema.parse(invalidCredential)).toThrow()
  })
})

describe('CredentialsFileSchema', () => {
  it('should validate a correct credentials file', () => {
    const validCredentialsFile = {
      lastUpdated: '2024-01-01T00:00:00Z',
      credentials: [
        {
          clientId: 'client-123',
          apiKey: 'sk_live_abc123xyz'
        },
        {
          clientId: 'client-456',
          apiKey: 'sk_live_def456uvw'
        }
      ]
    }

    expect(CredentialsFileSchema.parse(validCredentialsFile)).toEqual(
      validCredentialsFile
    )
  })
})
