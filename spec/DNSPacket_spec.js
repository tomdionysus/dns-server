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

  describe('deserialize', ()=>{
    it('should read from des, call submethods and set properties',()=>{
      spyOn(x1,'_deserializeFlags')
      spyOn(x1,'_readQuestionRRs').and.returnValue('_readQuestionRRs')
      spyOn(x1,'_readAnswerRRs').and.returnValue('_readAnswerRRs')
      
      var x = 0, des = { readUInt16: ()=>{ return x++ } }
      spyOn(des,'readUInt16').and.callThrough()

      x1.deserialize(des)

      expect(des.readUInt16).toHaveBeenCalledTimes(6)
      expect(des.readUInt16).toHaveBeenCalledWith()

      expect(x1._deserializeFlags).toHaveBeenCalledWith(1)
      expect(x1._readQuestionRRs).toHaveBeenCalledWith(des,2)

      expect(x1._readAnswerRRs).toHaveBeenCalledTimes(3)
      expect(x1._readAnswerRRs).toHaveBeenCalledWith(des,3)
      expect(x1._readAnswerRRs).toHaveBeenCalledWith(des,4)
      expect(x1._readAnswerRRs).toHaveBeenCalledWith(des,5)

      expect(x1.id).toEqual(0)
    })
  })

  describe('serialize', ()=>{
    it('should write to ser, call submethods and set properties',()=>{
      spyOn(x1,'_serializeFlags').and.returnValue('_serializeFlags')
      spyOn(x1,'_writeQuestionRRs').and.returnValue('_writeQuestionRRs')
      spyOn(x1,'_writeAnswerRRs').and.returnValue('_writeAnswerRRs')

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

      expect(x1._writeQuestionRRs).toHaveBeenCalledWith(ser,x1.question)
      expect(x1._writeAnswerRRs).toHaveBeenCalledWith(ser,x1.answer)
      expect(x1._writeAnswerRRs).toHaveBeenCalledWith(ser,x1.authority)
      expect(x1._writeAnswerRRs).toHaveBeenCalledWith(ser,x1.additional)
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
