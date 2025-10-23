describe('environ', () => {
  // Save original env
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('environSchema', () => {
    it('should accept valid development environment', async () => {
      // Set up environment variables
      process.env.ENVIRONMENT = 'development'
      process.env.BUCKET_NAME = 'test-bucket'

      // Import after setting env vars
      const { environSchema } = await import('./environ')

      const result = environSchema.parse(process.env)

      expect(result.ENVIRONMENT).toBe('development')
      expect(result.BUCKET_NAME).toBe('test-bucket')
    })
  })
})
