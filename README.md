# dns-server

[![Build Status](https://travis-ci.org/tomdionysus/dns-server.svg?branch=master)](https://travis-ci.org/tomdionysus/dns-server)
[![Coverage Status](https://coveralls.io/repos/github/tomdionysus/dns-server/badge.svg?branch=master)](https://coveralls.io/github/tomdionysus/dns-server?branch=master)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A Demo DNS Server project in NodeJS, to demonstrate [network-serializer](https://github.com/tomdionysus/network-serializer).

**Note** This is a technology demo project, DO NOT use it as a DNS server.

## Installation

```bash
npm install
```

In addition, you will need an accessible MySQL/MariaDB database, initialised from the schema in [db_setup.sql](sql/db_setup.sql):

```bash
export DATABASE_NAME="dnsserver"
mysql -u root --execute="CREATE DATABASE $DATABASE_NAME;"
mysql -u root $DATABASE_NAME < sql/db_setup.sql
```

## Running

The server will needs a `DB_URI` in the following format, and will bind to UDP Port 53 by default. MacOS and various other OSes bind `0.0.0.0` UDP Port 53, so it's best to run it on a different one.

```bash
DB_URI=mysql://root@localhost/$DATABASE_NAME LOG_LEVEL=DEBUG PORT=54 node index.js
```

## Demo

```bash
dig @localhost -p 54 example.com +noedns
```