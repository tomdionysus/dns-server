/* eslint-env jasmine */

const DNSPacket = require('../lib/DNSPacket')
const { BinaryDeserializer } = require('network-serializer')

describe('DNSPacket', () => {
  var x1
  
  beforeEach(()=>{
    x1 = new DNSPacket()
  })

  it('should allow New', () => {
    var x2 = new DNSPacket()

    expect(x1).not.toBe(x2)
  })

  describe('toBuffer', ()=>{
    it('should return correct buffer',()=>{
      x1.flags = {
        response: true,
        authoriative: false,
        truncated: true,
        recursionDesired: false,
        recursionAvailable: true,
        opCode: 10,
        responseCode: 5
      }
      x1.question = [
        { qname: 'domain.', qtype: DNSPacket.QType.ANY, qclass: DNSPacket.QClass.IN }
      ]

      expect([...x1.toBuffer()]).toEqual([ 0, 0, 210, 133, 0, 1, 0, 0, 0, 0, 0, 0, 6, 100, 111, 109, 97, 105, 110, 0, 0, 255, 0, 1 ])
    })
  })

  describe('fromBuffer', ()=>{
    it('should parse buffer into correct object',()=>{

      var b = Buffer.from([ 0, 0, 210, 133, 0, 1, 0, 0, 0, 0, 0, 0, 6, 100, 111, 109, 97, 105, 110, 0, 0, 255, 0, 1 ])
      var c = DNSPacket.fromBuffer(b)

      expect(c.flags).toEqual({
        response: true,
        authoriative: false,
        truncated: true,
        recursionDesired: false,
        recursionAvailable: true,
        opCode: 10,
        responseCode: 5
      })
      expect(c.question).toEqual([
        { qname: 'domain.', qtype: DNSPacket.QType.ANY, qclass: DNSPacket.QClass.IN }
      ])
      expect(c.answer).toEqual([])
      expect(c.authority).toEqual([])
    })
  })

  describe('deserialize', ()=>{
    it('should read from des, call submethods and set properties',()=>{
      spyOn(x1,'_deserializeFlags')
      spyOn(x1,'_readResourceRecords').and.returnValue('_readResourceRecords')
      
      var x = 0, des = { readUInt16: ()=>{ return x++ } }
      spyOn(des,'readUInt16').and.callThrough()

      x1.deserialize(des)

      expect(des.readUInt16).toHaveBeenCalledTimes(6)
      expect(des.readUInt16).toHaveBeenCalledWith()

      expect(x1._deserializeFlags).toHaveBeenCalledWith(1)

      expect(x1._readResourceRecords).toHaveBeenCalledTimes(4)
      expect(x1._readResourceRecords).toHaveBeenCalledWith(des,2,true)
      expect(x1._readResourceRecords).toHaveBeenCalledWith(des,3,false)
      expect(x1._readResourceRecords).toHaveBeenCalledWith(des,4,false)
      expect(x1._readResourceRecords).toHaveBeenCalledWith(des,5,false)

      expect(x1.id).toEqual(0)
    })
  })

  describe('serialize', ()=>{
    it('should write to ser, call submethods and set properties',()=>{
      spyOn(x1,'_serializeFlags').and.returnValue('_serializeFlags')
      spyOn(x1,'_writeResourceRecords').and.returnValue('_writeResourceRecords')

      var ser = { writeUInt16: ()=>{ } }
      spyOn(ser,'writeUInt16').and.callThrough()

      x1.id='ID'
      x1.question = [ 0 ] 
      x1.answer = [ 0, 1 ] 
      x1.authority = [ 0, 1, 2 ] 
      x1.additional = [ 0, 1, 2, 3 ] 

      x1.serialize(ser)

      expect(ser.writeUInt16).toHaveBeenCalledTimes(6)
      expect(ser.writeUInt16).toHaveBeenCalledWith('ID')
      expect(ser.writeUInt16).toHaveBeenCalledWith('_serializeFlags')
      expect(ser.writeUInt16).toHaveBeenCalledWith(1)
      expect(ser.writeUInt16).toHaveBeenCalledWith(2)
      expect(ser.writeUInt16).toHaveBeenCalledWith(3)
      expect(ser.writeUInt16).toHaveBeenCalledWith(4)

      expect(x1._writeResourceRecords).toHaveBeenCalledWith(ser, x1.question, true)
      expect(x1._writeResourceRecords).toHaveBeenCalledWith(ser, x1.answer, false)
      expect(x1._writeResourceRecords).toHaveBeenCalledWith(ser, x1.authority, false)
      expect(x1._writeResourceRecords).toHaveBeenCalledWith(ser, x1.additional, false)
    })
  })

  describe('_serializeFlags', ()=>{
    it('should pack flags properly, 1',()=>{
      x1.flags = {
        response: true,
        authoriative: false,
        truncated: true,
        recursionDesired: false,
        recursionAvailable: true,
        opCode: 10,
        responseCode: 5
      }

      expect(x1._serializeFlags()).toEqual(53893)
    })

    it('should pack flags properly, 2',()=>{
      x1.flags = {
        response: false,
        authoriative: true,
        truncated: false,
        recursionDesired: true,
        recursionAvailable: false,
        opCode: 5,
        responseCode: 10
      }

      expect(x1._serializeFlags()).toEqual(11530)
    })
  })

  describe('_deserializeFlags', ()=>{
    it('should unpack flags properly, 1',()=>{
      x1._deserializeFlags(53893)

      expect(x1.flags).toEqual({
        response: true,
        authoriative: false,
        truncated: true,
        recursionDesired: false,
        recursionAvailable: true,
        opCode: 10,
        responseCode: 5
      })
    })

    it('should unpack flags properly, 2',()=>{
      x1._deserializeFlags(11530)

      expect(x1.flags).toEqual({
        response: false,
        authoriative: true,
        truncated: false,
        recursionDesired: true,
        recursionAvailable: false,
        opCode: 5,
        responseCode: 10
      })
    })
  })

  describe('_readResourceRecord', ()=>{
    var x, des, ret

    beforeEach(()=>{
      spyOn(x1,'_readDomain').and.returnValue('domain')
      
      x = 0
      des = { 
        readUInt32: ()=>{ return x++ },
        readUInt16: ()=>{ return ret },
        readBytes: ()=>{ return x++ },
      }
      spyOn(des,'readUInt32').and.callThrough()
      spyOn(des,'readUInt16').and.callThrough()
      spyOn(des,'readBytes').and.callThrough()
    })
    
    it('should call readUInt32, readUInt16, readBytes',()=>{
      ret = 0xFFFF

      var obj = x1._readResourceRecord(des, false)

      // Question section
      expect(x1._readDomain).toHaveBeenCalledWith(des)
      expect(des.readUInt16).toHaveBeenCalledTimes(3)
      expect(des.readUInt16).toHaveBeenCalledWith()

      // Answer Section
      expect(des.readUInt32).toHaveBeenCalledTimes(1)
      expect(des.readBytes).toHaveBeenCalledWith(65535)

      expect(obj).toEqual({ qname: 'domain', qtype: 65535, qclass: 65535, ttl: 0, rddata: 1 })
    })

    it('should call _readARR for DNSPacket.QType.A',()=>{
      ret = DNSPacket.QType.A
      spyOn(x1,'_readARR').and.returnValue('RDATA1')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readARR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA1' })
    })

    it('should call _readNSRR for DNSPacket.QType.NS',()=>{
      ret = DNSPacket.QType.NS
      spyOn(x1,'_readNSRR').and.returnValue('RDATA2')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readNSRR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA2' })
    })

    it('should call _readCNAMERR for DNSPacket.QType.CNAME',()=>{
      ret = DNSPacket.QType.CNAME
      spyOn(x1,'_readCNAMERR').and.returnValue('RDATA3')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readCNAMERR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA3' })
    })

    it('should call _readSOARR for DNSPacket.QType.SOA',()=>{
      ret = DNSPacket.QType.SOA
      spyOn(x1,'_readSOARR').and.returnValue('RDATA4')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readSOARR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA4' })
    })

    it('should call _readPTRRR for DNSPacket.QType.PTR',()=>{
      ret = DNSPacket.QType.PTR
      spyOn(x1,'_readPTRRR').and.returnValue('RDATA5')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readPTRRR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA5' })
    })

    it('should call _readMXRR for DNSPacket.QType.MX',()=>{
      ret = DNSPacket.QType.MX
      spyOn(x1,'_readMXRR').and.returnValue('RDATA6')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readMXRR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA6' })
    })

    it('should call _readTXTRR for DNSPacket.QType.TXT',()=>{
      ret = DNSPacket.QType.TXT
      spyOn(x1,'_readTXTRR').and.returnValue('RDATA7')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readTXTRR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA7' })
    })

    it('should call _readSRVRR for DNSPacket.QType.SRV',()=>{
      ret = DNSPacket.QType.SRV
      spyOn(x1,'_readSRVRR').and.returnValue('RDATA8')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readSRVRR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA8' })
    })

    it('should call _readAAAARR for DNSPacket.QType.AAAA',()=>{
      ret = DNSPacket.QType.AAAA
      spyOn(x1,'_readAAAARR').and.returnValue('RDATA9')
      var obj = x1._readResourceRecord(des, false)
      expect(x1._readAAAARR).toHaveBeenCalledWith(jasmine.any(BinaryDeserializer))
      expect(obj).toEqual({ qname: 'domain', qtype: ret, qclass: ret, ttl: 0, rddata: 'RDATA9' })
    })

  })

  describe('_readARR', ()=>{
    it('should call _readIPv4 and return object',()=>{
      spyOn(x1,'_readIPv4').and.returnValue('IPADDR')
      var des = "DESERIALIZER"

      expect(x1._readARR(des)).toEqual({ address: 'IPADDR' })
      expect(x1._readIPv4).toHaveBeenCalledWith(des)
    })
  })

  describe('_readNSRR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('DOMAIN')
      var des = "DESERIALIZER"

      expect(x1._readNSRR(des)).toEqual({ name: 'DOMAIN' })
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readCNAMERR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('DOMAIN')
      des = "DESERIALIZER"

      expect(x1._readCNAMERR(des)).toEqual({ name: 'DOMAIN' })
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readSOARR', ()=>{
    it('should call _readDomain and ser.readUInt32 and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('DOMAIN')
      
      var x = 0, des = { readUInt32: ()=>{ return x++ } }
      spyOn(des,'readUInt32').and.callThrough()

      expect(x1._readSOARR(des)).toEqual({ 
        name: 'DOMAIN',
        admin: 'DOMAIN',
        serial: 0,
        refresh: 1,
        retry: 2,
        expiration: 3,
        ttl: 4,
      })
      expect(x1._readDomain).toHaveBeenCalledTimes(2)
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readPTRRR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('DOMAIN')
      var des = "DESERIALIZER"

      expect(x1._readPTRRR(des)).toEqual({ name: 'DOMAIN' })
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readMXRR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('DOMAIN')
      var des = { readUInt16: ()=>{} }
      spyOn(des,'readUInt16').and.returnValue(10)

      expect(x1._readMXRR(des)).toEqual({ preference: 10, exchange: 'DOMAIN' })
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readTXTRR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('TXT')

      expect(x1._readTXTRR(des)).toEqual({ text: 'TXT' })
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readSRVRR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readDomain').and.returnValue('DOMAIN')
      var des = { readUInt16: ()=>{} }
      spyOn(des,'readUInt16').and.returnValue(10)

      expect(x1._readSRVRR(des)).toEqual({ priority: 10, weight: 10, port:10, target: 'DOMAIN' })
      expect(des.readUInt16).toHaveBeenCalledTimes(3)
      expect(x1._readDomain).toHaveBeenCalledWith(des)
    })
  })

  describe('_readAAAARR', ()=>{
    it('should call _readDomain and return object',()=>{
      spyOn(x1,'_readIPv6').and.returnValue('IPV6')

      expect(x1._readAAAARR(des)).toEqual({ address: 'IPV6' })
      expect(x1._readIPv6).toHaveBeenCalledWith(des)
    })
  })
})
