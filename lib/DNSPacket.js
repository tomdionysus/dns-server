const { BinarySerializer, BinaryDeserializer } = require('network-serializer')
const { Address4, Address6 } = require('ip-address')

class DNSPacket {
  constructor () {
    this.flags = {
      response: false,
      authoriative: false,
      truncated: false,
      recursionDesired: false,
      recursionAvailable: false,
      // These are 'safest' as a default, you should set them.
      opCode: DNSPacket.OpCode.Unassigned,
      responseCode: DNSPacket.ResponseCode.ServFail
    }
    this.question = []
    this.answer = []
    this.authority = []
    this.additional = []
  }

  static fromBuffer (buffer) {
    var des = new BinaryDeserializer({ buffer: buffer, bigEndian: true })
    var out = new DNSPacket()
    out.deserialize(des)
    return out
  }

  toBuffer () {
    var ser = new BinarySerializer({ bigEndian: true })
    this.serialize(ser)
    return ser.releaseBuffer()
  }

  deserialize (des) {
    this.id = des.readUInt16()
    this._deserializeFlags(des.readUInt16())
    var questionCount = des.readUInt16()
    var answerCount = des.readUInt16()
    var authorityCount = des.readUInt16()
    var additionalCount = des.readUInt16()
    this.question = this._readQuestionRRs(des, questionCount)
    this.answer = this._readAnswerRRs(des, answerCount)
    this.authority = this._readAnswerRRs(des, authorityCount)
    this.additional = this._readAnswerRRs(des, additionalCount)
  }

  serialize (ser) {
    this.domainOffsets = {}
    ser.writeUInt16(this.id)
    ser.writeUInt16(this._serializeFlags())
    ser.writeUInt16(this.question.length)
    ser.writeUInt16(this.answer.length)
    ser.writeUInt16(this.authority.length)
    ser.writeUInt16(this.additional.length)
    this._writeQuestionRRs(ser, this.question)
    this._writeAnswerRRs(ser, this.answer)
    this._writeAnswerRRs(ser, this.authority)
    this._writeAnswerRRs(ser, this.additional)
  }

  // Flags

  _deserializeFlags (flags) {
    this.flags = {
      response: (flags & 0b1000000000000000) !== 0,
      authoriative: (flags & 0b0000010000000000) !== 0,
      truncated: (flags & 0b0000001000000000) !== 0,
      recursionDesired: (flags & 0b0000000100000000) !== 0,
      recursionAvailable: (flags & 0b0000000010000000) !== 0,
      opCode: (flags >>> 11) & 0b1111,
      responseCode: (flags & 0b1111)
    }
  }

  _serializeFlags () {
    var out = 0
    if (this.flags.response) out |= 0b1000000000000000
    if (this.flags.authoriative) out |= 0b0000010000000000
    if (this.flags.truncated) out |= 0b0000001000000000
    if (this.flags.recursionDesired) out |= 0b0000000100000000
    if (this.flags.recursionAvailable) out |= 0b0000000010000000
    out |= ((this.flags.opCode & 0b1111) << 11)
    out |= (this.flags.responseCode & 0b1111)
    return out
  }

  // Read

  _readQuestionRRs (des, count) {
    var out = []
    for (var i = 0; i < count; i++) out.push(this._readQuestionRR(des))
    return out
  }

  _readQuestionRR (des) {
    var out = {}
    out.qname = this._readDomain(des)
    out.qtype = des.readUInt16()
    out.qclass = des.readUInt16()
    return out
  }

  _readAnswerRRs (des, count) {
    var out = []
    for (var i = 0; i < count; i++) out.push(this._readAnswerRR(des))
    return out
  }

  _readAnswerRR (des) {
    var out = {}
    out.qname = this._readDomain(des)
    out.qtype = des.readUInt16()
    out.qclass = des.readUInt16()
    out.ttl = des.readUInt32()
    var rdlength = des.readUInt16()
    out.rddata = des.readBytes(rdlength)

    var rrdes = new BinaryDeserializer({ buffer: out.rddata, parent: des, bigEndian: true })

    switch (out.qtype) {
      case DNSPacket.QType.A: out.rddata = this._readARR(rrdes); break
      case DNSPacket.QType.NS: out.rddata = this._readNSRR(rrdes); break
      case DNSPacket.QType.CNAME: out.rddata = this._readCNAMERR(rrdes); break
      case DNSPacket.QType.SOA: out.rddata = this._readSOARR(rrdes); break
      case DNSPacket.QType.PTR: out.rddata = this._readPTRRR(rrdes); break
      case DNSPacket.QType.MX: out.rddata = this._readMXRR(rrdes); break
      case DNSPacket.QType.TXT: out.rddata = this._readTXTRR(rrdes); break
      case DNSPacket.QType.SRV: out.rddata = this._readSRVRR(rrdes); break
      case DNSPacket.QType.AAAA: out.rddata = this._readAAAARR(rrdes); break
    }

    return out
  }

  _readARR (des) {
    return {
      address: this._readIPv4(des)
    }
  }

  _readNSRR (des) {
    return {
      name: this._readDomain(des)
    }
  }

  _readCNAMERR (des) {
    return {
      name: this._readDomain(des)
    }
  }

  _readSOARR (des) {
    return {
      name: this._readDomain(des),
      admin: this._readDomain(des),
      serial: des.readUInt32(),
      refresh: des.readUInt32(),
      retry: des.readUInt32(),
      expiration: des.readUInt32(),
      ttl: des.readUInt32()
    }
  }

  _readPTRRR (des) {
    return {
      name: this._readDomain(des)
    }
  }

  _readMXRR (des) {
    return {
      preference: des.readUInt16(),
      exchange: this._readDomain(des)
    }
  }

  _readTXTRR (des) {
    return {
      text: this._readDomain(des)
    }
  }

  _readSRVRR (des) {
    return {
      priority: des.readUInt16(),
      weight: des.readUInt16(),
      port: des.readUInt16(),
      target: this._readDomain(des)
    }
  }

  _readAAAARR (des) {
    return {
      address: this._readIPv4(des)
    }
  }

  // Write

  _writeQuestionRRs (ser, questions) {
    for (var i in questions) this._writeQuestionRR(ser, questions[i])
  }

  _writeAnswerRRs (ser, answers) {
    for (var i in answers) this._writeAnswerRR(ser, answers[i])
  }

  _writeQuestionRR (ser, question) {
    this._writeDomain(ser, question.qname)
    ser.writeUInt16(question.qtype)
    ser.writeUInt16(question.qclass)
  }

  _writeAnswerRR (ser, answer) {
    this._writeDomain(ser, answer.qname)
    ser.writeUInt16(answer.qtype)
    ser.writeUInt16(answer.qclass)
    ser.writeUInt32(answer.ttl)

    var rddata = answer.rddata

    var rrser = new BinarySerializer({ parent: ser, bigEndian: true })

    switch (answer.qtype) {
      case DNSPacket.QType.A: this._writeARR(rrser, rddata); break
      case DNSPacket.QType.NS: this._writeNSR(rrser, rddata); break
      case DNSPacket.QType.CNAME: this._writeCNAMER(rrser, rddata); break
      case DNSPacket.QType.SOA: this._writeSOAR(rrser, rddata); break
      case DNSPacket.QType.PTR: this._writePTRR(rrser, rddata); break
      case DNSPacket.QType.MX: this._writeMXR(rrser, rddata); break
      case DNSPacket.QType.TXT: this._writeTXTR(rrser, rddata); break
      case DNSPacket.QType.SRV: this._writeSRVR(rrser, rddata); break
      case DNSPacket.QType.AAAA: this._writeAAAAR(rrser, rddata); break
    }

    var rrdata = rrser.releaseBuffer()
    ser.writeUInt16(rrdata.length)
    ser.writeBytes(rrdata)
  }

  _writeARR (ser, rr) {
    this._writeIPv4(ser, rr.address)
  }

  _writeNSR (ser, rr) {
    this._writeDomain(ser, rr.name)
  }

  _writeCNAMER (ser, rr) {
    this._writeDomain(ser, rr.name)
  }

  _writeSOAR (ser, rr) {
    this._writeDomain(ser, rr.name)
    this._writeDomain(ser, rr.admin)
    ser.writeUInt32(rr.serial)
    ser.writeUInt32(rr.refresh)
    ser.writeUInt32(rr.retry)
    ser.writeUInt32(rr.expiration)
    ser.writeUInt32(rr.ttl)
  }

  _writePTRR (ser, rr) {
    this._writeDomain(ser, rr.name)
  }

  _writeMXR (ser, rr) {
    ser.writeUInt16(rr.preference)
    this._writeDomain(ser, rr.exchange)
  }

  _writeTXTR (ser, rr) {
    this._writeDomain(ser, rr.text, false)
  }

  _writeSRVR (ser, rr) {
    ser.writeUInt16(rr.priority)
    ser.writeUInt16(rr.weight)
    ser.writeUInt16(rr.port)
    this._writeDomain(ser, rr.target)
  }

  _writeAAAAR (ser, rr) {
    this._writeIPv6(ser, rr.address)
  }

  // Util

  _readDomain (des) {
    var out = ''
    while (true) {
      var l = des.readUInt8()
      if (l === 0) break
      out = out + des.read(l) + '.'
    }
    return out
  }

  _writeDomain (ser, domain = '', finalise = true) {
    if (domain.length === 0) return ser.writeUInt8(0)

    if (finalise && domain.charAt(domain.length - 1) !== '.') domain += '.'

    var out = domain.split('.')
    for (var i in out) {
      ser.writeUInt8(out[i].length)
      ser.write(out[i])
    }

    // var out = domain.split('.')
    // for (var i in out) {
    //   // Back References (RFC1035 4.1.4)
    //   var dompart = out.slice(i).join('.'); var abso = ser.getAbsoluteOffset()
    //   if (this.domainOffsets[dompart]) {
    //     // Already exists in message
    //     ser.writeUInt16(this.domainOffsets[dompart] | 0xC000)
    //     break
    //   } else {
    //     // New, write and cache
    //     ser.writeUInt8(out[i].length)
    //     if (dompart.length > 0) {
    //       this.domainOffsets[dompart] = abso
    //       ser.write(out[i])
    //     }
    //   }
    // }
  }

  _readIPv4 (des) {
    return Address4.fromInteger(des.readUInt32()).toString()
  }

  _writeIPv4 (ser, address) {
    address = new Address4(address)
    ser.writeBytes(Buffer.from(address.toArray()))
  }

  _readIPv6 (des) {
    return Address6.fromByteArray([...des.readBytes(16)]).toString()
  }

  _writeIPv6 (ser, address) {
    address = new Address6(address)
    ser.writeBytes(Buffer.from(address.toByteArray()))
  }

  _swap16 (val) {
    return ((val & 0xFF) << 8) | ((val & 0xFF00) >> 8)
  }
}

DNSPacket.OpCode = {
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
  0: 'NoError',
  // No Error
  1: 'FormErr',
  // Format Error
  2: 'ServFail',
  // Server Failure
  3: 'NXDomain',
  // Non-Existent Domain
  4: 'NotImp',
  // Not Implemented
  5: 'Refused',
  // Query Refused
  6: 'YXDomain',
  // Name Exists when it should not
  7: 'YXRRSet',
  // RR Set Exists when it should not
  8: 'NXRRSet',
  // RR Set that should exist does not
  9: 'NotAuth',
  // Server Not Authoritative for zone
  10: 'NotZone',
  // Name not contained in zone
  11: 'DSOTYPENI',
  // DSO-TYPE Not Implemented
  16: 'BADVERS',
  // Bad OPT Version
  17: 'BADKEY',
  // Key not recognized
  18: 'BADTIME',
  // Signature out of time window
  19: 'BADMODE',
  // Bad TKEY Mode
  20: 'BADNAME',
  // Duplicate key name
  21: 'BADALG',
  // Algorithm not supported
  22: 'BADTRUNC',
  // Bad Truncation
  23: 'BADCOOKIE',
  // Bad/missing Server Cookie
  NoError: 0,
  FormErr: 1,
  ServFail: 2,
  NXDomain: 3,
  NotImp: 4,
  Refused: 5,
  YXDomain: 6,
  YXRRSet: 7,
  NXRRSet: 8,
  NotAuth: 9,
  NotZone: 10,
  DSOTYPENI: 11,
  BADVERS: 16,
  BADKEY: 17,
  BADTIME: 18,
  BADMODE: 19,
  BADNAME: 20,
  BADALG: 21,
  BADTRUNC: 22,
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
