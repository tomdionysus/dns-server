const DNSPacket = require("../lib/DNSPacket")

describe('DNSPacket', () => {
	it('should allow New', () => {
		var x1 = new DNSPacket()
		var x2 = new DNSPacket()

		expect(x1).not.toBe(x2)
	})
})