/* global jasmine */

jasmine.anyUUID = jasmine.stringMatching(/[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}/)
jasmine.anyHash256 = jasmine.stringMatching(/[0-9a-f]{32}/)
jasmine.anyHash512 = jasmine.stringMatching(/[0-9a-f]{64}/)
jasmine.anyHash256Prefix = (prefix) => { return jasmine.stringMatching(new RegExp(prefix+'[0-9a-f]{32}')) }