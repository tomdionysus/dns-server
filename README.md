# dns-server

A Demo DNS Server project in NodeJS, to demonstrate [network-serializer](https://github.com/tomdionysus/network-serializer).

**Note** This is a technology demo project, DO NOT use it as a DNS server.

The server listens on port 53 (configurable) and answers all DNS queries with one stock 'demo' answer.

## Installation

```bash
npm install
```

## Running

The server will bind to UDP Port 53 by default. MacOS and various other OSes bind `0.0.0.0` UDP Port 53, so it's best to run it on a different one.

```bash
PORT=54 node index.js
```

## Demo (using `dig`)

```bash
dig @localhost -p 54 hello.com +noedns
```