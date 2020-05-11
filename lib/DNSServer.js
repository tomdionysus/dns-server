const dgram = require('dgram')

const Logger = require('./Logger')
const ScopedLogger = require('./ScopedLogger')
const DNSPacket = require('./DNSPacket')

class DNSServer {
	constructor(options = {}) {
		this.logger = new ScopedLogger('DNSServer', options.logger || new Logger())
		this.port = options.port || 53
		this._socket = dgram.createSocket('udp4')
		this._socket.on('message', this._onMessage.bind(this))
	}

	start() {
		if(this._running) return
		this._running = true
		this._socket.bind(this.port)
		this.logger.debug('Started on UDP Port '+this.port)
	}

	stop() {
		if(!this._running) return
		this._socket.close()
		this._running = false
	}

	_onMessage(msg, rinfo) {
		this.logger.debug('UDP Message: Length: '+msg.length+' ', rinfo)

		var pkt = DNSPacket.fromBuffer(msg)

		var res = new DNSPacket()
		res.id = pkt.id
		res.flags.response = true
		res.flags.opCode = DNSPacket.OpCode.Query
		res.flags.responseCode = DNSPacket.ResponseCode.NoError

		res.question.push(pkt.question[0])
		res.answer.push({
			qname: pkt.question[0].qname,
			qtype: DNSPacket.QType.A,
			qclass: DNSPacket.QClass.IN,
			ttl: 300,
			rddata: {
				address: '11.12.13.14'
			}
		})

		var buf = res.toBuffer()

		this._socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
	}
}

module.exports = DNSServer