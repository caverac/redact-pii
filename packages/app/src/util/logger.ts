import winston from 'winston'

/**
 * Winston logger instance for console output
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`
          }
          return msg
        })
      )
    })
  ]
})

export { logger }
