#!/usr/bin/node

const Logger = require('./lib/Logger')
const DNSServer = require('./lib/DNSServer')

function main () {
  // ENV and defaults

  // Logger
  var logger = new Logger()

  // Boot Message
  logger.log('dns-server (Tom Cully)', '----')
  logger.log('v1.0.0', '----')
  logger.log('', '----')
  logger.log('Logging Level %s', '----', Logger.logLevelToString(logger.logLevel))

  // Main Downloader
  var svr = new DNSServer({
    logger: logger,
    env: process.env.ENV || 'prod',
    port: parseInt(process.env.PORT) || 53
  })

  var handle = () => {
    logger.debug('SIGTERM/SIGINT Received - Stopping')
    svr.stop()
    logger.info('Stopped')
    process.exit()
  }

  process.on('SIGTERM', handle)
  process.on('SIGINT', handle)

  // Downloader Start
  svr.start()
}

main()
