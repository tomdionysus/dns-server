/* eslint-env jasmine */

const DNSPacket = require('../lib/DNSPacket')

describe('DNSPacket', () => {
  var x1
  
  beforeEach(()=>{
    x1 = new DNSPacket()
  })

  it('should allow New', () => {
    var x2 = new DNSPacket()

    expect(x1).not.toBe(x2)
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
})
