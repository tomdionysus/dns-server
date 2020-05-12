/* eslint-env jasmine */

const DNSServer = require('../lib/DNSServer')

describe('DNSServer', () => {
  it('should allow New', () => {
    var x1 = new DNSServer()
    var x2 = new DNSServer()

    expect(x1).not.toBe(x2)
  })
})
