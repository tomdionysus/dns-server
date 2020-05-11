# dns-server

A Demo DNS Server project in NodeJS, to demonstrate [network-serializer](https://github.com/tomdionysus/network-serializer).

**Note** This is a technology demo project, DO NOT use it as a DNS server.

The server listens on port 53 (configurable) and answers all DNS queries with one stock 'demo' answer.

## Installation

```bash
npm install
```

## Running

```bash
PORT=54 node index.js
```