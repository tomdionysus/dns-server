/* eslint-env jasmine */

const DNSServer = require('../lib/DNSServer')

describe('DNSServer', () => {
  var x1

  beforeEach(()=>{
    x1 = new DNSServer()
  })

  it('should allow New', () => {
    var x2 = new DNSServer()

    expect(x1).not.toBe(x2)
  })

  describe('start', ()=>{
    it('should call _socket.bind and set _running true',()=>{
      spyOn(x1._socket,'bind')
      spyOn(x1.logger,'info')

      x1.start()

      expect(x1._running).toEqual(true)
      expect(x1._socket.bind).toHaveBeenCalledWith(53)
      expect(x1.logger.info).toHaveBeenCalledWith('Started on UDP Port 53')
    })

    it('should return if _running true',()=>{
      spyOn(x1._socket,'bind')
      spyOn(x1.logger,'info')

      x1._running = true
      x1.start()

      expect(x1._running).toEqual(true)
      expect(x1._socket.bind).not.toHaveBeenCalled()
      expect(x1.logger.info).not.toHaveBeenCalled()
    })
  })

  describe('stop', ()=>{
    it('should call _socket.close and set _running false',()=>{
      spyOn(x1._socket,'close')
      spyOn(x1.logger,'info')

      x1._running = true
      x1.stop()

      expect(x1._running).toEqual(false)
      expect(x1._socket.close).toHaveBeenCalledWith()
      expect(x1.logger.info).toHaveBeenCalledWith('Stopped')
    })

    it('should return if _running false',()=>{
      spyOn(x1._socket,'close')
      spyOn(x1.logger,'info')

      x1._running = false
      x1.stop()

      expect(x1._running).toEqual(false)
      expect(x1._socket.close).not.toHaveBeenCalled()
      expect(x1.logger.info).not.toHaveBeenCalled()
    })
  })
})
