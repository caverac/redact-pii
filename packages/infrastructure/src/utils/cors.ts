/**
 * Return allowed origins based on deployment environment
 * @param deploymentEnvironment - deployment environment
 * @returns allowed origins
 */
export const getAllowedOrigins = (deploymentEnvironment: string) => {
  const origins = ['http://localhost:3014']
  if (deploymentEnvironment === 'development') {
    origins.push(
      'https://development.models.adam-soluciones.com',
      'https://www.development.models.adam-soluciones.com'
    )
  }
  if (deploymentEnvironment === 'production') {
    origins.push(
      'https://models.adam-soluciones.com',
      'https://www.models.adam-soluciones.com'
    )
  }
  return origins
}
