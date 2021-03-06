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

    this.domainOffsets = {}
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
    this.domainOffsets = {}
    this.id = des.readUInt16()
    this._deserializeFlags(des.readUInt16())
    var questionCount = des.readUInt16()
    var answerCount = des.readUInt16()
    var authorityCount = des.readUInt16()
    var additionalCount = des.readUInt16()
    this.question = this._readResourceRecords(des, questionCount, true)
    this.answer = this._readResourceRecords(des, answerCount, false)
    this.authority = this._readResourceRecords(des, authorityCount, false)
    this.additional = this._readResourceRecords(des, additionalCount, false)
  }

  serialize (ser) {
    this.domainOffsets = {}
    ser.writeUInt16(this.id)
    ser.writeUInt16(this._serializeFlags())
    ser.writeUInt16(this.question.length)
    ser.writeUInt16(this.answer.length)
    ser.writeUInt16(this.authority.length)
    ser.writeUInt16(this.additional.length)
    this._writeResourceRecords(ser, this.question, true)
    this._writeResourceRecords(ser, this.answer, false)
    this._writeResourceRecords(ser, this.authority, false)
    this._writeResourceRecords(ser, this.additional, false)
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

  _readResourceRecords (des, count, isQuestion) {
    var out = []
    for (var i = 0; i < count; i++) out.push(this._readResourceRecord(des, isQuestion))
    return out
  }

  _readResourceRecord (des, isQuestion) {
    var out = {}
    out.qname = this._readDomain(des)
    out.qtype = des.readUInt16()
    out.qclass = des.readUInt16()

    if (isQuestion) return out

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
      address: this._readIPv6(des)
    }
  }

  // Write

  _writeResourceRecords (ser, data, isQuestion) {
    for (var i in data) this._writeResourceRecord(ser, data[i], isQuestion)
  }

  _writeResourceRecord (ser, data, isQuestion) {
    this._writeDomain(ser, data.qname)
    ser.writeUInt16(data.qtype)
    ser.writeUInt16(data.qclass)

    if (isQuestion) return

    ser.writeUInt32(data.ttl)

    var pos = ser.offset
    ser.writeUInt16(0) // Placeholder - overwritten after RR

    switch (data.qtype) {
      case DNSPacket.QType.A: this._writeARR(ser, data.rddata); break
      case DNSPacket.QType.NS: this._writeNSR(ser, data.rddata); break
      case DNSPacket.QType.CNAME: this._writeCNAMER(ser, data.rddata); break
      case DNSPacket.QType.SOA: this._writeSOAR(ser, data.rddata); break
      case DNSPacket.QType.PTR: this._writePTRR(ser, data.rddata); break
      case DNSPacket.QType.MX: this._writeMXR(ser, data.rddata); break
      case DNSPacket.QType.TXT: this._writeTXTR(ser, data.rddata); break
      case DNSPacket.QType.SRV: this._writeSRVR(ser, data.rddata); break
      case DNSPacket.QType.AAAA: this._writeAAAAR(ser, data.rddata); break
    }

    var rpos = ser.offset
    ser.seek(pos) // Write length before RR
    ser.writeUInt16(rpos - pos - 2)
    ser.seek(rpos) // Seek to end of RR
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

  _writeDomain (ser, domain, finalise = true) {
    if (domain.length === 0) return ser.writeUInt8(0)

    if (finalise && domain.charAt(domain.length - 1) !== '.') domain += '.'

    // // This is the 'fallback' non-compressed writer, because the compressed
    // // code sometimes has issues...
    // var out = domain.split('.')
    // for (var i in out) {
    //   ser.writeUInt8(out[i].length)
    //   ser.write(out[i])
    // }
    // return

    var out = domain.split('.')
    for (var i in out) {
      // Back References (RFC1035 4.1.4)
      var dompart = out.slice(i).join('.'); var abso = ser.getAbsoluteOffset()
      if (dompart in this.domainOffsets) {
        // Already exists in message
        ser.writeUInt16(this.domainOffsets[dompart] | 0xC000)
        break
      } else {
        // New, write and cache
        ser.writeUInt8(out[i].length)
        if (dompart.length > 0) {
          this.domainOffsets[dompart] = abso
          ser.write(out[i])
        }
      }
    }
  }

  _readIPv4 (des) {
    return Address4.fromInteger(des.readUInt32()).correctForm()
  }

  _writeIPv4 (ser, address) {
    address = new Address4(address)
    ser.writeBytes(Buffer.from(address.toArray()))
  }

  _readIPv6 (des) {
    return Address6.fromByteArray([...des.readBytes(16)]).correctForm()
  }

  _writeIPv6 (ser, address) {
    address = new Address6(address)
    ser.writeBytes(Buffer.from(address.toByteArray()))
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
