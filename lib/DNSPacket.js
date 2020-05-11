const { BinarySerializer, BinaryDeserializer } = require('network-serializer')

class DNSPacket {
	constructor() {
		this.flags = {
			response: false,
			authoriative: false,
			truncated: false,
			recursionDesired: false,
			recursionAvailable: false,
			opCode: DNSPacket.Opcode.Unassigned,				// This is 'safest' as a default, you should set it
			responseCode: DNSPacket.ResponseCode.ServFail		// This is 'safest' as a default, you should set it
		}
		this.question = []
		this.answer = []
		this.authority = []
		this.additional = []
	}

	static fromBuffer(buffer) {
		var des = new BinaryDeserializer({ buffer: buffer, bigEndian: true })
		var out = new DNSPacket()
		out.deserialize(des)
		return out
	}

	toBuffer() {
		var ser = new BinarySerializer({ bigEndian: true })
		this.serialize(ser)
		return ser.releaseBuffer()
	}

	deserialize(des) {
		this.id = des.readUInt16()
		this.flags = DNSPacket._parseFlags(des.readUInt16())
		var questionCount = des.readUInt16()
		var answerCount = des.readUInt16()
		var authorityCount = des.readUInt16()
		var additionalCount = des.readUInt16()
		this.question = DNSPacket._readQuestionRRs(des, questionCount)
		this.answer = DNSPacket._readAnswerRRs(des, answerCount)
		this.authority = DNSPacket._readAnswerRRs(des, authorityCount)
		this.additional = DNSPacket._readAnswerRRs(des, additionalCount)
	}

	serialize(ser) {
		ser.writeUInt16(this.id)
		ser.writeUInt16(DNSPacket._unParseFlags(this.flags))
		ser.writeUInt16(this.question.length)
		ser.writeUInt16(this.answer.length)
		ser.writeUInt16(this.authority.length)
		ser.writeUInt16(this.additional.length)
		DNSPacket._writeQuestionRRs(ser, this.question)
		DNSPacket._writeAnswerRRs(ser, this.answer)
		DNSPacket._writeAnswerRRs(ser, this.authority)
		DNSPacket._writeAnswerRRs(ser, this.additional)
	}

	// Flags

	static _parseFlags(flags) {
		return {
			response:  			(flags & 0b0000000000000001) != 0,
			authoriative:		(flags & 0b0000000000010000) != 0,
 			truncated: 			(flags & 0b0000000000100000) != 0,
			recursionDesired: 	(flags & 0b0000000001000000) != 0,
			recursionAvailable: (flags & 0b0000000010000000) != 0,

			opCode: 			(flags >> 1) & 0b111, 
			responseCode: 		(flags >> 12) & 0b1111,
		}
	}

	static _unParseFlags(flags) {
		var out = 0
		if(flags.response) 			 out |= 0b0000000000000001
		if(flags.authoriative) 		 out |= 0b0000000000010000
		if(flags.truncated) 		 out |= 0b0000000000100000
		if(flags.recursionDesired) 	 out |= 0b0000000001000000
		if(flags.recursionAvailable) out |= 0b0000000010000000
		out |= (flags.opCode & 0x111) << 1
		out |= (flags.responseCode & 0x1111) << 12
		return out
	}

	// Read

	static _readQuestionRRs(des, count) {
		var out = []
		for(var i =0; i<count; i++) out.push(DNSPacket._readQuestionRR(des))
		return out
	}

	static _readQuestionRR(des) {
		var out = {}
		out.qname = DNSPacket._readDomain(des)
		out.qtype = des.readUInt16()
		out.qclass = des.readUInt16()
		return out
	}

	static _readAnswerRRs(des, count) {
		var out = []
		for(var i =0; i<count; i++) out.push(DNSPacket._readAnswerRR(des))
		return out
	}

	static _readAnswerRR(des) {
		var out = {}
		out.qname = DNSPacket._readDomain(des)
		out.qtype = des.readUInt16()
		out.qclass = des.readUInt16()
		out.ttl = des.readUInt32()
		var rdlength = des.readUInt16()
		out.rddata = des.readBytes(rdlength)

		var rrdes = new BinaryDeserializer(out.rddata)

		switch(out.qtype) {
			case DNSPacket.QType.A:
				out.rddata = DNSPacket._readARR(rrdes)
				break
			case DNSPacket.QType.NS:
				out.rddata = DNSPacket._readNSRR(rrdes)
				break
			case DNSPacket.QType.CNAME:
				out.rddata = DNSPacket._readCNAMERR(rrdes)
				break
			case DNSPacket.QType.SOA:
				out.rddata = DNSPacket._readSOARR(rrdes)
				break
			case DNSPacket.QType.PTR:
				out.rddata = DNSPacket._readPTRRR(rrdes)
				break
			case DNSPacket.QType.MX:
				out.rddata = DNSPacket._readMXRR(rrdes)
				break
			case DNSPacket.QType.TXT:
				out.rddata = DNSPacket._readTXTRR(rrdes)
				break
			case DNSPacket.QType.SRV:
				out.rddata = DNSPacket._readSRVRR(rrdes)
				break
			case DNSPacket.QType.AAAA:
				out.rddata = DNSPacket._readAAAARR(rrdes)
				break
		}

		return out
	}

	static _readARR(des) {
		return {
			address: DNSPacket._readIPv4(des)
		}
	}

	static _readNSRR(des) {
		return {
			name: DNSPacket._readDomain(des)
		}
	}

	static _readCNAMERR(des) {
		return {
			name: DNSPacket._readDomain(des)
		}
	}

	static _readSOARR(des) {
		return {
			name: DNSPacket._readDomain(des),
			admin: DNSPacket._readDomain(des),
			serial: des.readUInt32(),
			refresh: des.readUInt32(),
			retry: des.readUInt32(),
			expiration: des.readUInt32(),
			ttl: des.readUInt32()
		}
	}

	static _readPTRRR(des) {
		return {
			name: DNSPacket._readDomain(des)
		}
	}

	static _readMXRR(des) {
		return {
			preference: des.readUInt16(),
			exchange: DNSPacket._readDomain(des)
		}
	}

	static _readTXTRR(des) {
		return {
			text: DNSPacket._readDomain(des)
		}
	}

	static _readSRVRR(des) {
		return {
			priority: des.readUInt16(),
			weight: des.readUInt16(),
			port: des.readUInt16(),
			target: DNSPacket._readDomain(des)
		}
	}

	static _readAAAARR(des) {
		return {
			address: DNSPacket._readIPv4(des)
		}
	}

	// Write

	static _writeQuestionRRs(ser, questions) {
		for(var i in questions) DNSPacket._writeQuestionRR(ser, questions[i])
	}

	static _writeAnswerRRs(ser, answers) {
		for(var i in answers) DNSPacket._writeAnswerRR(ser, answers[i])
	}

	static _writeQuestionRR(ser, question) {
		DNSPacket._writeDomain(ser, question.qname)
		ser.writeUInt16(question.qtype)
		ser.writeUInt16(question.qclass)
	}

	static _writeAnswerRR(ser, answer) {
		DNSPacket._writeDomain(ser, answer.qname)
		ser.writeUInt16(answer.qtype)
		ser.writeUInt16(answer.qclass)
		ser.writeUInt32(answer.ttl)

		var rddata = answer.rddata

		var rrser = new BinarySerializer()

		switch(question.qtype) {
			case DNSPacket.QType.A:
				DNSPacket._writeARR(rrser, rddata)
				break
			case DNSPacket.QType.NS:
				DNSPacket._writeNSR(rrser, rddata)
				break
			case DNSPacket.QType.CNAME:
				DNSPacket._writeCNAMER(rrser, rddata)
				break
			case DNSPacket.QType.SOA:
				DNSPacket._writeSOAR(rrser, rddata)
				break
			case DNSPacket.QType.PTR:
				DNSPacket._writePTRR(rrser, rddata)
				break
			case DNSPacket.QType.MX:
				DNSPacket._writeMXR(rrser, rddata)
				break
			case DNSPacket.QType.TXT:
				DNSPacket._writeTXTR(rrser, rddata)
				break
			case DNSPacket.QType.SRV:
				DNSPacket._writeSRVR(rrser, rddata)
				break
			case DNSPacket.QType.AAAA:
				DNSPacket._writeAAAAR(rrser, rddata)
				break
		}

		var rrdata = rrser.releaseBuffer()
		ser.writeUInt16(rrdata.length)
		ser.writeBytes(rrdata)
	}

	static _writeARR(ser, rr) {
		DNSPacket._writeIPv4(ser, rr.address)
	}

	static _writeNSR(ser, rr) {
		DNSPacket._writeDomain(ser, rr.name)
	}

	static _writeCNAMER(ser, rr) {
		DNSPacket._writeDomain(ser, rr.name)
	}

	static _writeSOAR(ser, rr) {
		DNSPacket._writeDomain(ser, rr.name)
		DNSPacket._writeDomain(ser, rr.admin)
		ser.writeUInt32(rr.serial)
		ser.writeUInt32(rr.refresh)
		ser.writeUInt32(rr.retry)
		ser.writeUInt32(rr.expiration)
		ser.writeUInt32(rr.ttl)
	}

	static _writePTRR(ser, rr) {
		DNSPacket._writeDomain(ser, rr.name)
	}

	static _writeMXR(ser, rr) {
		ser.writeUInt16(rr.preference)
		DNSPacket._writeDomain(ser, rr.exchange)
	}


	static _writeTXTR(ser, rr) {
		DNSPacket._writeDomain(ser, rr.exchange)
	}

	static _writeSRVR(ser, rr) {
		ser.writeUInt16(rr.priority)
		ser.writeUInt16(rr.weight)
		ser.writeUInt16(rr.port)
		DNSPacket._writeDomain(ser, rr.target)
	}

	static _writeAAAAR(ser, rr) {
		DNSPacket._writeIPv6(ser, rr.address)
	}

	// Util

	static _readDomain(des) {
		var out = ""
		while (true) {
			var l = des.readUInt8()
			if(l==0) break
			out = out + des.read(l)+'.' 
		}
		return out
	}

	static _writeDomain(ser, domain = '') {
		if(domain.length==0) {
			ser.writeUInt8(0)
			return
		}
		if(domain[domain.length-1]!='.') domain += '.'
		var out = domain.split('.')
		for(var i in out) {
			ser.writeUInt8(out[i].length)
			ser.write(out[i])
		}
	}

	static _readIPv4(des) {
		return [des.readBytes(4)].join('.')
	}

	static _writeIPv4(ser, address) {
		var out = domain.split('.')
		for(var i in out) {
			ser.writeUInt8(parseInt(out[i]))
		}
	}

	static _readIPv6(des) {
		return [des.readBytes(16)].match(/.{1,4}/g).join(':').replace(/(^|:)0{1,4}/g,'')
	}

	static _writeIPv6(ser, address) {
		var out = domain.split(':')
		for(var i in out) {
			ser.writeUInt8(parseInt(out[i],16))
		}
	}
}

DNSPacket.Opcode = {
	0: 'Query',
	1: 'IQuery',
	2: 'Status',
	3: 'Unassigned',
	4: 'Notify',
	5: 'Update',
	6: 'DNS',
	Query: 0,
	IQuery: 1,
	Status: 2,
	Unassigned: 3,
	Notify: 4,
	Update: 5,
	DNS: 6
}

DNSPacket.ResponseCode = {
	0:  'NoError',		// No Error
	1:  'FormErr',		// Format Error
	2:  'ServFail',		// Server Failure
	3:  'NXDomain',		// Non-Existent Domain
	4:  'NotImp'	,		// Not Implemented
	5:  'Refused',		// Query Refused
	6:  'YXDomain',		// Name Exists when it should not
	7:  'YXRRSet',		// RR Set Exists when it should not
	8:  'NXRRSet',		// RR Set that should exist does not
	9:  'NotAuth',		// Server Not Authoritative for zone
	10: 'NotZone',		// Name not contained in zone
	11: 'DSOTYPENI',	// DSO-TYPE Not Implemented
	16: 'BADVERS',		// Bad OPT Version
	16: 'BADSIG',		// TSIG Signature Failure
	17: 'BADKEY',		// Key not recognized	
	18: 'BADTIME',		// Signature out of time window
	19: 'BADMODE',		// Bad TKEY Mode
	20: 'BADNAME',		// Duplicate key name
	21: 'BADALG',		// Algorithm not supported	
	22: 'BADTRUNC',		// Bad Truncation
	23: 'BADCOOKIE',	// Bad/missing Server Cookie
	NoError:   0,
	FormErr:   1,
	ServFail:  2,
	NXDomain:  3,
	NotImp:    4,
	Refused:   5,
	YXDomain:  6,
	YXRRSet:   7,
	NXRRSet:   8,
	NotAuth:   9,
	NotZone:   10,
	DSOTYPENI: 11,
	BADVERS:   16,
	BADSIG:    16,
	BADKEY:    17,
	BADTIME:   18,
	BADMODE:   19,
	BADNAME:   20,
	BADALG:    21,
	BADTRUNC:  22,
	BADCOOKIE: 23
}

DNSPacket.QType = {
	0x0001: 'A',
	0x0002: 'NS',
	0x0005: 'CNAME',
	0x0006: 'SOA',
	0x000C: 'PTR',
	0x000F: 'MX',
	0x0010: 'TXT',
	0x0021: 'SRV',
	0x001C: 'AAAA',
	0x00FF: 'ANY',
	A: 0x0001,
	NS: 0x0002,
	CNAME: 0x0005,
	SOA: 0x0006,
	PTR: 0x000C,
	MX: 0x000F,
	TXT: 0x0010,
	SRV: 0x0021,
	AAAA: 0x001C,
	ANY: 0x00FF
}

DNSPacket.QClass = {
	IN: 1,
	CS: 2,
	CH: 3,
	HS: 4,
	1: 'IN',
	2: 'CS',
	3: 'CH',
	4: 'HS'
}

module.exports = DNSPacket