const crypto = require('crypto')
const url = require('url')

const mysqllib = require('mysql')
const async = require('async')

const Logger = require('./Logger')
const ScopedLogger = require('./ScopedLogger')

class MySQL {
  constructor (options) {
    options = options || {}
    this.options = options
    this.logger = new ScopedLogger('MySQL', options.logger || new Logger())
    this.mysql = options.mysql || mysqllib
    this.kvstore = options.kvstore

    if(this.options.uri) this._parseDBURI(this.options.uri)
  }

  static _query (conn, query, params, callback) {
    conn.logger.debug('Query `' + query + '` (' + JSON.stringify(params) + ')')
    conn.pool.query(query, params, (err, results, fields) => {
      if (err) {
        conn.logger.error(err + ' ON `' + query + '` (' + JSON.stringify(params) + ')')
        return callback(err)
      }
      callback(err, results, fields)
    })
  }

  _parseDBURI(uri) {
    try {
      var dbUrl = new url.URL(uri)
      this.options.host = dbUrl.host
      this.options.user = dbUrl.username
      this.options.database = dbUrl.pathname.substr(1)
      this.options.password = dbUrl.password
    } catch (err) {
      this.logger.error('Cannot parse options.url (should be mysql://user:password@host:port/database)')
    }
  }

  connect () {
    this.pool = this.mysql.createPool({
      host: this.options.host,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database
    })

    this.pool.getConnection((err, conn) => {
      if (!err) {
        this.logger.info('Connected')
        conn.release()
      } else {
        this.logger.error('Cannot Connect Database', err)
      }
    })
  }

  cachequery (query, params, expiry, callback) { this._cachequery(this, query, params, expiry, callback) }
  query (query, params, callback) { MySQL._query(this, query, params, callback) }

  _cachequery (conn, query, params, expiry, callback) {
    // If caching is disabled, revert to query
    if (!this.kvstore) { return MySQL._query(conn, query, params, callback) }

    conn.logger.debug('Cache Query `%s` (%s)', query, JSON.stringify(params))

    var key = crypto.createHash('md5').update(JSON.stringify({ sql: query, params: params })).digest().toString('hex')

    this.kvstore.get(key, (err, data) => {
      if (err) {
        conn.logger.warn('Loading DB Cache %s Failed: ', key, err)
        MySQL._query(conn, query, params, callback)
      } else {
        // Cache Hit
        if (data != null) {
          conn.logger.debug('DB Cache HIT %s', key)
          data = JSON.parse(data)
          callback(null, data.results, data.fields)
          return
        }

        conn.logger.debug('DB Cache MISS %s', key)
        MySQL._query(conn, query, params, (err, results, fields) => {
          if (err) { callback(err); return }
          var data = JSON.stringify({ results: results, fields: fields })
          if (data.length > 1024 * 1023) {
            conn.logger.warn('DB Cache Value >1Mb, cannot set %s', key)
            callback(err, results, fields)
            return
          }
          this.kvstore.set(key, data, expiry, (err) => {
            if (err) { conn.logger.warn('Saving DB Cache %s Failed: ', key, err) }
            callback(null, results, fields)
          })
        })
      }
    })
  }

  end (callback) {
    this.pool.end((err) => {
      if (!err) {
        this.logger.debug('Pool Connection Ended')
      } else {
        this.logger.error('Error while ending Pool Connection', err)
      }
      callback(err)
    })
  }

  begin (callback) {
    this.pool.getConnection((err, connection) => {
      if (err) { callback(err); return }
      connection.beginTransaction((err) => {
        if (err) { callback(err); return }
        var trans = new Transaction({
          engine: this,
          connection: connection
        })
        callback(null, trans)
      })
    })
  }

  // Wrap an async.series in a transaction, with chain truncation and rollback on error.
  //  asyncTransaction([fn1, fn2, fn3...],finalCallback)
  //  fn1 = function(transaction, callback)
  asyncTransaction (fns, callback) {
    var transaction = null
    var tfns = []
    // Add Begin transaction
    tfns.push((callback) => {
      this.begin((err, trans) => {
        if (err) { return callback(err) }
        transaction = trans
        callback()
      })
    })
    // Add User Functions
    for (var i = 0; i < fns.length; i++) {
      var fn = { f: fns[i] }
      tfns.push(function (cb) { return this.f(transaction, cb) }.bind(fn))
    }
    // Add Commit at end
    tfns.push((callback) => { transaction.commit(callback) })
    // Final Callback
    var fin = (err, results) => { callback(err, results) }
    // Do Async
    async.series(tfns, (err, results) => {
      // Dump begin result
      results.shift()
      // Dump commit result if any
      if (results.length > fns.length) results.pop()
      // On Error rollback
      if (err) {
        // Edge case where begin failed
        if (!transaction) { return fin(err, results) }
        // Do Rollback
        return transaction.rollback(() => { fin(err, results) })
      }
      // Call final
      fin(err, results)
    })
  }

  // Order by helper
  static getSQLOrderSortBy (context, allowed, direction) {
    var sql = ''
    if (context.sort_by && allowed.indexOf(context.sort_by) !== -1) {
      sql += ' ORDER BY ' + context.sort_by
      if (context.sort_dir === 'desc') {
        sql += ' DESC'
      }
      sql += ',id'
    } else {
      sql += ' ORDER BY ' + allowed[0]
      if (direction === 'desc') {
        sql += ' DESC'
      }
      sql += ',id'
    }
    return sql
  }

  // Order by helper
  static getSQLPagination (context) {
    var sql = ''
    context.page = context.page || 0
    context.page_size = context.page_size || 20
    sql += 'LIMIT ' + (context.page_size * context.page) + ',' + context.page_size
    return sql
  }
}

class Transaction {
  constructor (options) {
    this.transactionId = crypto.randomBytes(8).toString('hex')
    this.engine = options.engine
    this.pool = options.connection
    this.logger = new ScopedLogger('Transaction ' + this.transactionId, this.engine.logger)
    this.logger.debug('BEGIN')
  }

  cachequery (query, params, expiry, callback) { this.engine._cachequery(this, query, params, expiry, callback) }
  query (query, params, callback) { MySQL._query(this, query, params, callback) }

  commit (callback) {
    this.pool.commit((err) => {
      if (err) {
        this.logger.error('COMMIT Error ', err)
      } else {
        this.logger.debug('COMMIT')
      }
      callback(err)
    })
    this.pool.release()
  }

  rollback (callback) {
    this.pool.rollback((err) => {
      if (err) {
        this.logger.error('ROLLBACK Error ', err)
      } else {
        this.logger.debug('ROLLBACK')
      }
      callback(err)
    })
    this.pool.release()
  }
}

MySQL.Transaction = Transaction
module.exports = MySQL
