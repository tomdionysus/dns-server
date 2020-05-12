const dgram = require('dgram')

const Logger = require('./Logger')
const ScopedLogger = require('./ScopedLogger')
const DNSPacket = require('./DNSPacket')

class DNSServer {
  constructor (options = {}) {
    this.logger = new ScopedLogger('DNSServer', options.logger || new Logger())
    this.port = options.port || 53
    this.mysql = options.mysql
    this._socket = dgram.createSocket('udp4')
    this._socket.on('message', this._onMessage.bind(this))
  }

  start () {
    if (this._running) return
    this._running = true
    this._socket.bind(this.port)
    this.logger.debug('Started on UDP Port ' + this.port)
  }

  stop () {
    if (!this._running) return
    this._socket.close()
    this._running = false
  }

  _onMessage (msg, rinfo) {
    // Parse the request packet
    var pkt = DNSPacket.fromBuffer(msg)
    this.logger.debug('UDP Message: Length: ' + msg.length + ' ', rinfo)

    // If this is a query and has at least one question
    if (pkt.flags.response === false && pkt.question.length > 0) {
      // Only answer the first question
      var question = pkt.question[0]

      this._getRRs(question.qname, DNSPacket.QType[question.qtype], (err, rrs) => {
        // If DB Error, SvrFail
        if (err) return this.sendServerError(pkt, rinfo)

        // Generate the response packet
        var res = new DNSPacket()
        res.id = pkt.id
        res.flags.response = true
        res.flags.opCode = DNSPacket.OpCode.Query
        res.flags.responseCode = DNSPacket.ResponseCode.NoError

        // Copy in Question
        if (pkt.question.length > 0) res.question.push(pkt.question[0])

        // If no records, return NXDomain
        if (rrs.length === 0) res.flags.responseCode = DNSPacket.ResponseCode.NXDomain
        // Copy in Answers
        for (var i in rrs) res.answer.push(rrs[i])

        // Send Response
        var buf = res.toBuffer()
        this._socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
      })
    } else {
      // Send FormErr
      this.sendFormatError(pkt, rinfo)
    }
  }

  sendFormatError (pkt, rinfo) {
    var res = new DNSPacket()
    res.id = pkt.id
    res.flags.response = true
    res.flags.opCode = DNSPacket.OpCode.Query
    res.flags.responseCode = DNSPacket.ResponseCode.FormErr
    if (pkt.question.length > 0) res.question.push(pkt.question[0])
    var buf = res.toBuffer()
    this._socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
  }

  sendServerError (pkt, rinfo) {
    var res = new DNSPacket()
    res.id = pkt.id
    res.flags.response = true
    res.flags.opCode = DNSPacket.OpCode.Query
    res.flags.responseCode = DNSPacket.ResponseCode.ServFail
    if (pkt.question.length > 0) res.question.push(pkt.question[0])
    var buf = res.toBuffer()
    this._socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
  }

  _getRRs (queryname, rrtype, callback) {
    var sql = 'SELECT * FROM resourcerecord WHERE name = ?'; var param = [queryname]
    if (rrtype && rrtype !== 'ANY' && rrtype !== '*') { sql += ' AND rrtype = ?'; param.push(rrtype) }
    this.mysql.query(sql, param, (err, res) => {
      if (err) return callback(err)
      var out = []
      for (var i in res) {
        var row = res[i]
        var rr = this._getRRData(row)
        if (rr) out.push(rr)
      }
      callback(null, out)
    })
  }

  _getRRData (row) {
    try {
      var out = {
        qname: row.name,
        qtype: DNSPacket.QType[row.rrtype],
        qclass: DNSPacket.QClass.IN,
        ttl: row.ttl
      }
      switch (row.rrtype) {
        case 'A': return this._getRRDataA(row, out)
        case 'MX': return this._getRRDataMX(row, out)
        case 'NS': return this._getRRDataNS(row, out)
        case 'SOA': return this._getRRDataSOA(row, out)
        case 'CNAME': return this._getRRDataCNAME(row, out)
        case 'PTR': return this._getRRDataPTR(row, out)
        case 'TXT': return this._getRRDataTXT(row, out)
        case 'SRV': return this._getRRDataSRV(row, out)
        case 'AAAA': return this._getRRDataAAAA(row, out)
      }
    } catch (e) {
      this.logger.error('Database Parse Error: Resource Record ' + row.id + ' is malformed.')
    }
    return null
  }

  _getRRDataA (row, out) {
    out.rddata = { address: row.rdata }
    return out
  }

  _getRRDataMX (row, out) {
    var [preference, exchange] = row.rdata.split(' ')
    out.rddata = {
      preference: parseInt(preference),
      exchange: exchange
    }
    return out
  }

  _getRRDataNS (row, out) {
    out.rddata = {
      name: row.rdata
    }
    return out
  }

  _getRRDataCNAME (row, out) {
    out.rddata = {
      name: row.rdata
    }
    return out
  }

  _getRRDataSOA (row, out) {
    var [name, admin, serial, refresh, retry, expiration, ttl] = row.rdata.split(' ')
    out.rddata = {
      name: name,
      admin: admin,
      serial: parseInt(serial),
      refresh: parseInt(refresh),
      retry: parseInt(retry),
      expiration: parseInt(expiration),
      ttl: parseInt(ttl)
    }
    return out
  }

  _getRRDataTXT (row, out) {
    out.rddata = {
      text: row.rdata
    }
    return out
  }

  _getRRDataSRV (row, out) {
    var [priority, weight, port, target] = row.rdata.split(' ')
    out.rddata = {
      priority: parseInt(priority),
      weight: parseInt(weight),
      port: parseInt(port),
      target: target
    }
    return out
  }

  _getRRDataAAAA (row, out) {
    out.rddata = { address: row.rdata }
    return out
  }
}

module.exports = DNSServer
