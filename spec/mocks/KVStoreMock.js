class KVStoreMock {
  constructor (options) {
    options = options || {}
    this.options = options
    this.returnError = options.returnError ? options.returnError : null
    this.returnErrorSet = options.returnErrorSet || this.returnError
    this.returnErrorGet = options.returnErrorGet || this.returnError
    this.returnErrorDel = options.returnErrorDel || this.returnError
    this.returnErrorIncr = options.returnErrorIncr || this.returnError
    this.returnErrorDecr = options.returnErrorDecr || this.returnError
    this.returnData = options.returnData ? options.returnData : null

    spyOn(this, 'set').and.callThrough()
    spyOn(this, 'get').and.callThrough()
    spyOn(this, 'del').and.callThrough()
    spyOn(this, 'incr').and.callThrough()
    spyOn(this, 'decr').and.callThrough()
  }

  set (key, data, expiry, cb) {
    cb(this.returnErrorSet)
  }

  get (key, cb) {
    if (this.returnErrorGet) { return cb(this.returnErrorGet) }
    cb(null, this.returnData)
  }

  del (key, cb) {
    cb(this.returnErrorDel)
  }

  incr (key, amount, cb) {
    cb(this.returnErrorIncr)
  }

  decr (key, amount, cb) {
    cb(this.returnErrorDecr)
  }
}

module.exports = KVStoreMock
