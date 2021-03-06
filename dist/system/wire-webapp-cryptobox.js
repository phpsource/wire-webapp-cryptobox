/*
 * Wire
 * Copyright (C) 2016 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

System.register(["dexie", "bazinga64", "wire-webapp-proteus", "postal"], function(exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var __extends = (this && this.__extends) || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
    var dexie_1, bazinga64, Proteus, postal;
    var store, CryptoboxSession, Cryptobox;
    return {
        setters:[
            function (dexie_1_1) {
                dexie_1 = dexie_1_1;
            },
            function (bazinga64_1) {
                bazinga64 = bazinga64_1;
            },
            function (Proteus_1) {
                Proteus = Proteus_1;
            },
            function (postal_1) {
                postal = postal_1;
            }],
        execute: function() {
            (function (store_1) {
                var Cache = (function () {
                    function Cache() {
                        this.prekeys = {};
                        this.sessions = {};
                    }
                    Cache.prototype.delete_all = function () {
                        var _this = this;
                        return new Promise(function (resolve) {
                            _this.identity = undefined;
                            _this.prekeys = {};
                            _this.sessions = {};
                            resolve(true);
                        });
                    };
                    Cache.prototype.delete_prekey = function (prekey_id) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            delete _this.prekeys[prekey_id];
                            resolve(prekey_id);
                        });
                    };
                    Cache.prototype.delete_session = function (session_id) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            delete _this.sessions[session_id];
                            resolve(session_id);
                        });
                    };
                    Cache.prototype.load_identity = function () {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            if (_this.identity) {
                                resolve(_this.identity);
                            }
                            else {
                                reject(new Error("No local identity present."));
                            }
                        });
                    };
                    Cache.prototype.load_prekey = function (prekey_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var serialised = _this.prekeys[prekey_id];
                            if (serialised) {
                                resolve(Proteus.keys.PreKey.deserialise(serialised));
                            }
                            else {
                                reject(new Error("PreKey with ID '" + prekey_id + "' not found."));
                            }
                        });
                    };
                    Cache.prototype.load_prekeys = function () {
                        var _this = this;
                        return new Promise(function (resolve) {
                            var all_prekeys = Object.keys(_this.prekeys).map(function (key) {
                                return _this.prekeys[key];
                            });
                            resolve(all_prekeys);
                        });
                    };
                    Cache.prototype.load_session = function (identity, session_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var serialised = _this.sessions[session_id];
                            if (serialised) {
                                resolve(Proteus.session.Session.deserialise(identity, serialised));
                            }
                            else {
                                reject(new Error("Session with ID '" + session_id + "' not found."));
                            }
                        });
                    };
                    Cache.prototype.save_identity = function (identity) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            _this.identity = identity;
                            resolve(_this.identity);
                        });
                    };
                    Cache.prototype.save_prekey = function (preKey) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            try {
                                _this.prekeys[preKey.key_id] = preKey.serialise();
                            }
                            catch (error) {
                                return reject("PreKey serialization problem: '" + error.message + "'");
                            }
                            resolve(preKey);
                        });
                    };
                    Cache.prototype.save_prekeys = function (preKeys) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var savePromises = [];
                            preKeys.forEach(function (preKey) {
                                savePromises.push(_this.save_prekey(preKey));
                            });
                            Promise.all(savePromises).then(function () {
                                resolve(preKeys);
                            }).catch(reject);
                        });
                    };
                    Cache.prototype.save_session = function (session_id, session) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            try {
                                _this.sessions[session_id] = session.serialise();
                            }
                            catch (error) {
                                return reject("Session serialization problem: '" + error.message + "'");
                            }
                            resolve(session);
                        });
                    };
                    return Cache;
                }());
                store_1.Cache = Cache;
                var IndexedDB = (function () {
                    function IndexedDB(identifier) {
                        var _this = this;
                        this.prekeys = {};
                        this.TABLE = {
                            LOCAL_IDENTITY: "keys",
                            PRE_KEYS: "prekeys",
                            SESSIONS: "sessions"
                        };
                        this.localIdentityKey = 'local_identity';
                        if (typeof indexedDB === "undefined") {
                            var warning = "IndexedDB isn't supported by your platform.";
                            throw new Error(warning);
                        }
                        if (typeof identifier === 'string') {
                            var schema = {};
                            schema[this.TABLE.LOCAL_IDENTITY] = '';
                            schema[this.TABLE.PRE_KEYS] = '';
                            schema[this.TABLE.SESSIONS] = '';
                            this.db = new dexie_1.default("cryptobox@" + identifier);
                            this.db.version(1).stores(schema);
                        }
                        else {
                            this.db = identifier;
                        }
                        this.db.on('blocked', function (event) {
                            console.warn("Database access to '" + _this.db.name + "' got blocked.", event);
                            _this.db.close();
                        });
                    }
                    IndexedDB.prototype.init = function () {
                        console.log("Connecting to IndexedDB database '" + this.db.name + "'...");
                        return this.db.open();
                    };
                    IndexedDB.prototype.delete = function (store_name, primary_key) {
                        var _this = this;
                        return new dexie_1.default.Promise(function (resolve) {
                            _this.validate_store(store_name).then(function (store) {
                                return store.delete(primary_key);
                            }).then(function () {
                                resolve(primary_key);
                            });
                        });
                    };
                    IndexedDB.prototype.load = function (store_name, primary_key) {
                        var _this = this;
                        return new dexie_1.default.Promise(function (resolve, reject) {
                            _this.validate_store(store_name).then(function (store) {
                                return store.get(primary_key);
                            }).then(function (record) {
                                if (record) {
                                    console.log("Loaded record '" + primary_key + "' from store '" + store_name + "'.", record);
                                    resolve(record);
                                }
                                else {
                                    reject("Record '" + primary_key + "' not found in store '" + store_name + "'.");
                                }
                            });
                        });
                    };
                    IndexedDB.prototype.save = function (store_name, primary_key, entity) {
                        var _this = this;
                        return new dexie_1.default.Promise(function (resolve) {
                            _this.validate_store(store_name).then(function (store) {
                                return store.put(entity, primary_key);
                            }).then(function (key) {
                                console.log("Saved record '" + primary_key + "' into store '" + store_name + "'.", entity);
                                resolve(key);
                            });
                        });
                    };
                    IndexedDB.prototype.validate_store = function (store_name) {
                        var _this = this;
                        return new dexie_1.default.Promise(function (resolve, reject) {
                            if (_this.db[store_name]) {
                                resolve(_this.db[store_name]);
                            }
                            else {
                                reject(new Error("Data store '" + store_name + "' not found."));
                            }
                        });
                    };
                    IndexedDB.prototype.delete_all = function () {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            console.info("Deleting '" + _this.db.name + "'.");
                            _this.db.delete()
                                .then(function () {
                                resolve(true);
                            })
                                .catch(reject);
                        });
                    };
                    IndexedDB.prototype.delete_prekey = function (prekey_id) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            _this.delete(_this.TABLE.PRE_KEYS, prekey_id.toString()).then(function (primary_key) {
                                resolve(primary_key);
                            });
                        });
                    };
                    IndexedDB.prototype.delete_session = function (session_id) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            _this.delete(_this.TABLE.SESSIONS, session_id).then(function (primary_key) {
                                resolve(primary_key);
                            });
                        });
                    };
                    IndexedDB.prototype.load_identity = function () {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.load(_this.TABLE.LOCAL_IDENTITY, _this.localIdentityKey).then(function (payload) {
                                if (payload) {
                                    var bytes = bazinga64.Decoder.fromBase64(payload.serialised).asBytes;
                                    var identity = Proteus.keys.IdentityKeyPair.deserialise(bytes.buffer);
                                    resolve(identity);
                                }
                                else {
                                    reject(new Error("No local identity present."));
                                }
                            });
                        });
                    };
                    IndexedDB.prototype.load_prekey = function (prekey_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.load(_this.TABLE.PRE_KEYS, prekey_id.toString()).then(function (record) {
                                var bytes = bazinga64.Decoder.fromBase64(record.serialised).asBytes;
                                resolve(Proteus.keys.PreKey.deserialise(bytes.buffer));
                            }).catch(reject);
                        });
                    };
                    IndexedDB.prototype.load_prekeys = function () {
                        var _this = this;
                        return new dexie_1.default.Promise(function (resolve, reject) {
                            _this.validate_store(_this.TABLE.PRE_KEYS).then(function (store) {
                                return store.toArray();
                            }).then(function (records) {
                                var preKeys = [];
                                records.forEach(function (record) {
                                    var bytes = bazinga64.Decoder.fromBase64(record.serialised).asBytes;
                                    var preKey = Proteus.keys.PreKey.deserialise(bytes.buffer);
                                    preKeys.push(preKey);
                                });
                                resolve(preKeys);
                            }).catch(reject);
                        });
                    };
                    IndexedDB.prototype.load_session = function (identity, session_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.load(_this.TABLE.SESSIONS, session_id).then(function (payload) {
                                var bytes = bazinga64.Decoder.fromBase64(payload.serialised).asBytes;
                                resolve(Proteus.session.Session.deserialise(identity, bytes.buffer));
                            }).catch(reject);
                        });
                    };
                    IndexedDB.prototype.save_identity = function (identity) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.identity = identity;
                            var serialised = bazinga64.Encoder.toBase64(identity.serialise()).asString;
                            var payload = new SerialisedRecord(serialised, _this.localIdentityKey);
                            _this.save(_this.TABLE.LOCAL_IDENTITY, payload.id, payload).then(function (primaryKey) {
                                var fingerprint = identity.public_key.fingerprint();
                                var message = ("Saved local identity '" + fingerprint + "'")
                                    + (" with key '" + primaryKey + "' into storage '" + _this.TABLE.LOCAL_IDENTITY + "'");
                                resolve(identity);
                            }).catch(reject);
                        });
                    };
                    IndexedDB.prototype.save_prekey = function (prekey) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.prekeys[prekey.key_id] = prekey;
                            var serialised = bazinga64.Encoder.toBase64(prekey.serialise()).asString;
                            var payload = new SerialisedRecord(serialised, prekey.key_id.toString());
                            _this.save(_this.TABLE.PRE_KEYS, payload.id, payload).then(function (primaryKey) {
                                var message = "Saved PreKey with ID '" + prekey.key_id + "' into storage '" + _this.TABLE.PRE_KEYS + "'";
                                resolve(prekey);
                            }).catch(reject);
                        });
                    };
                    IndexedDB.prototype.save_prekeys = function (prekeys) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            if (prekeys.length === 0) {
                                resolve(prekeys);
                            }
                            var items = [];
                            var keys = [];
                            prekeys.forEach(function (preKey) {
                                var serialised = bazinga64.Encoder.toBase64(preKey.serialise()).asString;
                                var key = preKey.key_id.toString();
                                var payload = new SerialisedRecord(serialised, key);
                                items.push(payload);
                                keys.push(key);
                            });
                            _this.validate_store(_this.TABLE.PRE_KEYS).then(function (store) {
                                return store.bulkAdd(items, keys);
                            }).then(function () {
                                console.log("Saved a batch of '" + items.length + "' PreKeys. From ID '" + items[0].id + "' to ID '" + items[items.length - 1].id + "'.", items);
                                resolve(prekeys);
                            }).catch(reject);
                        });
                    };
                    IndexedDB.prototype.save_session = function (session_id, session) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var serialised = bazinga64.Encoder.toBase64(session.serialise()).asString;
                            var payload = new SerialisedRecord(serialised, session_id);
                            _this.save(_this.TABLE.SESSIONS, payload.id, payload).then(function (primaryKey) {
                                var message = "Saved session with key '" + session_id + "' into storage '" + _this.TABLE.SESSIONS + "'";
                                resolve(session);
                            }).catch(reject);
                        });
                    };
                    return IndexedDB;
                }());
                store_1.IndexedDB = IndexedDB;
                var LocalStorage = (function () {
                    function LocalStorage(identifier) {
                        if (identifier === void 0) { identifier = "temp"; }
                        this.localIdentityKey = 'local_identity';
                        if (typeof localStorage === "undefined") {
                            var warning = "Local Storage isn't supported by your platform.";
                            throw new Error(warning);
                        }
                        else {
                            this.localIdentityStore = "cryptobox@" + identifier + "@identity";
                            this.preKeyStore = "cryptobox@" + identifier + "@prekey";
                            this.sessionStore = "cryptobox@" + identifier + "@session";
                            this.storage = localStorage;
                        }
                    }
                    LocalStorage.prototype.delete = function (store_name, primary_key) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            var key = store_name + "@" + primary_key;
                            _this.storage.removeItem(key);
                            resolve(key);
                        });
                    };
                    LocalStorage.prototype.load = function (store_name, primary_key) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var item = _this.storage.getItem(store_name + "@" + primary_key);
                            if (item) {
                                resolve(item);
                            }
                            else {
                                reject(new Error("Item '" + primary_key + "' not found in '" + store_name + "'."));
                            }
                        });
                    };
                    ;
                    LocalStorage.prototype.save = function (store_name, primary_key, entity) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            var key = store_name + "@" + primary_key;
                            _this.storage.setItem(key, entity);
                            resolve(key);
                        });
                    };
                    LocalStorage.prototype.delete_all = function () {
                        var _this = this;
                        return new Promise(function (resolve) {
                            var removed_items = false;
                            Object.keys(localStorage).forEach(function (key) {
                                if (key.indexOf(_this.localIdentityStore) > -1 ||
                                    key.indexOf(_this.preKeyStore) > -1 ||
                                    key.indexOf(_this.sessionStore) > -1) {
                                    removed_items = true;
                                    localStorage.removeItem(key);
                                }
                            });
                            resolve(removed_items);
                        });
                    };
                    LocalStorage.prototype.delete_prekey = function (prekey_id) {
                        return this.delete(this.preKeyStore, prekey_id.toString());
                    };
                    LocalStorage.prototype.delete_session = function (session_id) {
                        return this.delete(this.sessionStore, session_id);
                    };
                    LocalStorage.prototype.load_identity = function () {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.load(_this.localIdentityStore, _this.localIdentityKey).then(function (payload) {
                                if (payload) {
                                    var bytes = bazinga64.Decoder.fromBase64(payload).asBytes;
                                    var ikp = Proteus.keys.IdentityKeyPair.deserialise(bytes.buffer);
                                    resolve(ikp);
                                }
                                else {
                                    reject(new Error("No local identity present."));
                                }
                            }).catch(reject);
                        });
                    };
                    LocalStorage.prototype.load_prekey = function (prekey_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.load(_this.preKeyStore, prekey_id.toString()).then(function (serialised) {
                                var bytes = bazinga64.Decoder.fromBase64(serialised).asBytes;
                                resolve(Proteus.keys.PreKey.deserialise(bytes.buffer));
                            }).catch(reject);
                        });
                    };
                    LocalStorage.prototype.load_prekeys = function () {
                        var _this = this;
                        var prekey_promises = [];
                        Object.keys(localStorage).forEach(function (key) {
                            if (key.indexOf(_this.preKeyStore) > -1) {
                                var separator = '@';
                                var prekey_id = key.substr(key.lastIndexOf(separator) + separator.length);
                                var promise = _this.load_prekey(parseInt(prekey_id));
                                prekey_promises.push(promise);
                            }
                        });
                        return Promise.all(prekey_promises);
                    };
                    LocalStorage.prototype.load_session = function (identity, session_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            _this.load(_this.sessionStore, session_id).then(function (serialised) {
                                var bytes = bazinga64.Decoder.fromBase64(serialised).asBytes;
                                resolve(Proteus.session.Session.deserialise(identity, bytes.buffer));
                            }).catch(reject);
                        });
                    };
                    LocalStorage.prototype.save_identity = function (identity) {
                        var _this = this;
                        var fingerprint = identity.public_key.fingerprint();
                        var serialised = bazinga64.Encoder.toBase64(identity.serialise()).asString;
                        var payload = new SerialisedRecord(serialised, this.localIdentityKey);
                        return new Promise(function (resolve, reject) {
                            _this.save(_this.localIdentityStore, payload.id, payload.serialised).then(function (key) {
                                var message = "Saved local identity '" + fingerprint + "' with key '" + key + "'.";
                                resolve(identity);
                            }).catch(reject);
                        });
                    };
                    LocalStorage.prototype.save_prekey = function (preKey) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var serialised = bazinga64.Encoder.toBase64(preKey.serialise()).asString;
                            var payload = new SerialisedRecord(serialised, preKey.key_id.toString());
                            _this.save(_this.preKeyStore, payload.id, payload.serialised).then(function () {
                                resolve(preKey);
                            }).catch(reject);
                        });
                    };
                    LocalStorage.prototype.save_prekeys = function (preKeys) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var savePromises = [];
                            preKeys.forEach(function (preKey) {
                                savePromises.push(_this.save_prekey(preKey));
                            });
                            Promise.all(savePromises).then(function () {
                                resolve(preKeys);
                            }).catch(reject);
                        });
                    };
                    LocalStorage.prototype.save_session = function (session_id, session) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            var serialised = bazinga64.Encoder.toBase64(session.serialise()).asString;
                            var payload = new SerialisedRecord(serialised, session_id);
                            _this.save(_this.sessionStore, payload.id, payload.serialised).then(function () {
                                resolve(session);
                            }).catch(reject);
                        });
                    };
                    return LocalStorage;
                }());
                store_1.LocalStorage = LocalStorage;
                var ReadOnlyStore = (function (_super) {
                    __extends(ReadOnlyStore, _super);
                    function ReadOnlyStore(store) {
                        _super.call(this);
                        this.store = store;
                        this.removed_prekeys = [];
                    }
                    ReadOnlyStore.prototype.get_prekey = function (prekey_id) {
                        var _this = this;
                        return new Promise(function (resolve, reject) {
                            if (_this.removed_prekeys.indexOf(prekey_id) !== -1) {
                                reject(new Error("PreKey '" + prekey_id + "' not found."));
                            }
                            else {
                                _this.store.load_prekey(prekey_id).then(function (pk) {
                                    resolve(pk);
                                });
                            }
                        });
                    };
                    ReadOnlyStore.prototype.remove = function (prekey_id) {
                        this.removed_prekeys.push(prekey_id);
                        return Promise.resolve(prekey_id);
                    };
                    return ReadOnlyStore;
                }(Proteus.session.PreKeyStore));
                store_1.ReadOnlyStore = ReadOnlyStore;
                var SerialisedRecord = (function () {
                    function SerialisedRecord(serialised, id) {
                        this.id = id;
                        this.serialised = serialised;
                    }
                    return SerialisedRecord;
                }());
            })(store = store || (store = {}));
            exports_1("store", store);
            CryptoboxSession = (function () {
                function CryptoboxSession(id, pk_store, session) {
                    this.id = id;
                    this.pk_store = pk_store;
                    this.session = session;
                    Object.freeze(this);
                }
                CryptoboxSession.prototype.decrypt = function (ciphertext) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        var envelope = Proteus.message.Envelope.deserialise(ciphertext);
                        _this.session.decrypt(_this.pk_store, envelope).then(function (plaintext) {
                            resolve(plaintext);
                        }).catch(reject);
                    });
                };
                CryptoboxSession.prototype.encrypt = function (plaintext) {
                    var _this = this;
                    return new Promise(function (resolve) {
                        _this.session.encrypt(plaintext).then(function (ciphertext) {
                            resolve(ciphertext.serialise());
                        });
                    });
                };
                CryptoboxSession.prototype.fingerprint_local = function () {
                    return this.session.local_identity.public_key.fingerprint();
                };
                CryptoboxSession.prototype.fingerprint_remote = function () {
                    return this.session.remote_identity.fingerprint();
                };
                return CryptoboxSession;
            }());
            exports_1("CryptoboxSession", CryptoboxSession);
            Cryptobox = (function () {
                function Cryptobox(cryptoBoxStore, minimumAmountOfPreKeys) {
                    if (minimumAmountOfPreKeys === void 0) { minimumAmountOfPreKeys = 1; }
                    this.EVENT = {
                        NEW_PREKEYS: 'new-prekeys'
                    };
                    this.cachedSessions = {};
                    this.channel = postal.channel("cryptobox");
                    console.log("Constructed Cryptobox. Minimum limit of PreKeys '" + minimumAmountOfPreKeys + "' (1 Last Resort PreKey and " + (minimumAmountOfPreKeys - 1) + " others).");
                    this.minimumAmountOfPreKeys = minimumAmountOfPreKeys;
                    this.pk_store = new store.ReadOnlyStore(this.store);
                    this.store = cryptoBoxStore;
                }
                Cryptobox.prototype.init = function () {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        _this.store.load_identity()
                            .catch(function () {
                            var identity = Proteus.keys.IdentityKeyPair.new();
                            console.info("Created new identity " + identity.public_key.fingerprint() + ".");
                            return _this.store.save_identity(identity);
                        })
                            .then(function (identity) {
                            _this.identity = identity;
                            return _this.store.load_prekey(Proteus.keys.PreKey.MAX_PREKEY_ID);
                        })
                            .catch(function () {
                            var lastResortPreKey = Proteus.keys.PreKey.new(Proteus.keys.PreKey.MAX_PREKEY_ID);
                            return _this.store.save_prekey(lastResortPreKey);
                        })
                            .then(function () {
                            return _this.generate_required_prekeys();
                        })
                            .then(function () {
                            console.log("Initialized Cryptobox with 'xx' PreKeys.");
                            resolve(_this);
                        }).catch(reject);
                    });
                };
                Cryptobox.prototype.generate_required_prekeys = function () {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        _this.store.load_prekeys().then(function (currentPreKeys) {
                            var missingAmount = 0;
                            var highestId = 0;
                            if (currentPreKeys.length < _this.minimumAmountOfPreKeys) {
                                missingAmount = _this.minimumAmountOfPreKeys - currentPreKeys.length;
                                highestId = -1;
                                currentPreKeys.forEach(function (preKey) {
                                    if (preKey.key_id > highestId && preKey.key_id !== Proteus.keys.PreKey.MAX_PREKEY_ID) {
                                        highestId = preKey.key_id;
                                    }
                                });
                                highestId += 1;
                                console.log("There are not enough available PreKeys. Generating '" + missingAmount + "' new PreKeys, starting from ID '" + highestId + "'...");
                            }
                            return _this.new_prekeys(highestId, missingAmount);
                        }).then(function (newPreKeys) {
                            if (newPreKeys.length > 0) {
                                _this.channel.publish(_this.EVENT.NEW_PREKEYS, newPreKeys);
                                console.log("Published event '" + _this.EVENT.NEW_PREKEYS + "'.", newPreKeys);
                            }
                            resolve(newPreKeys);
                        }).catch(reject);
                    });
                };
                Cryptobox.prototype.session_from_prekey = function (client_id, pre_key_bundle) {
                    var _this = this;
                    return new Promise(function (resolve) {
                        var bundle = Proteus.keys.PreKeyBundle.deserialise(pre_key_bundle);
                        Proteus.session.Session.init_from_prekey(_this.identity, bundle).then(function (session) {
                            return resolve(new CryptoboxSession(client_id, _this.pk_store, session));
                        });
                    });
                };
                Cryptobox.prototype.session_from_message = function (session_id, envelope) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        var env;
                        try {
                            env = Proteus.message.Envelope.deserialise(envelope);
                        }
                        catch (error) {
                            return reject(error);
                        }
                        Proteus.session.Session.init_from_message(_this.identity, _this.pk_store, env)
                            .then(function (tuple) {
                            var session = tuple[0];
                            var decrypted = tuple[1];
                            var cryptoBoxSession = new CryptoboxSession(session_id, _this.pk_store, session);
                            resolve([cryptoBoxSession, decrypted]);
                        })
                            .catch(reject);
                    });
                };
                Cryptobox.prototype.session_load = function (session_id) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        if (_this.cachedSessions[session_id]) {
                            resolve(_this.cachedSessions[session_id]);
                        }
                        else {
                            _this.store.load_session(_this.identity, session_id)
                                .then(function (session) {
                                if (session) {
                                    var pk_store = new store.ReadOnlyStore(_this.store);
                                    var cryptoBoxSession = new CryptoboxSession(session_id, pk_store, session);
                                    _this.cachedSessions[session_id] = cryptoBoxSession;
                                    resolve(cryptoBoxSession);
                                }
                                else {
                                    reject(new Error("Session with ID '" + session + "' not found."));
                                }
                            })
                                .catch(reject);
                        }
                    });
                };
                Cryptobox.prototype.session_save = function (session) {
                    var _this = this;
                    return new Promise(function (resolve) {
                        _this.store.save_session(session.id, session.session).then(function () {
                            var prekey_deletions = [];
                            session.pk_store.removed_prekeys.forEach(function (pk_id) {
                                prekey_deletions.push(_this.store.delete_prekey(pk_id));
                            });
                            return Promise.all(prekey_deletions);
                        }).then(function () {
                            return _this.generate_required_prekeys();
                        }).then(function () {
                            resolve(session.id);
                        });
                    });
                };
                Cryptobox.prototype.session_delete = function (session_id) {
                    delete this.cachedSessions[session_id];
                    return this.store.delete_session(session_id);
                };
                Cryptobox.prototype.new_prekey = function (prekey_id) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        var pk = Proteus.keys.PreKey.new(prekey_id);
                        _this.store.save_prekey(pk).then(function () {
                            var serialisedPreKeyBundle = Proteus.keys.PreKeyBundle.new(_this.identity.public_key, pk).serialise();
                            resolve(serialisedPreKeyBundle);
                        }).catch(reject);
                    });
                };
                Cryptobox.prototype.new_prekeys = function (start, size) {
                    var _this = this;
                    if (size === void 0) { size = 0; }
                    return new Promise(function (resolve, reject) {
                        if (size === 0) {
                            resolve([]);
                        }
                        var newPreKeys = Proteus.keys.PreKey.generate_prekeys(start, size);
                        _this.store.save_prekeys(newPreKeys).then(resolve).catch(reject);
                    });
                };
                Cryptobox.prototype.encrypt = function (session, payload) {
                    var _this = this;
                    return new Promise(function (resolve) {
                        var encryptedBuffer;
                        var loadedSession;
                        Promise.resolve().then(function () {
                            if (typeof session === 'string') {
                                return _this.session_load(session);
                            }
                            else {
                                return session;
                            }
                        }).then(function (session) {
                            loadedSession = session;
                            return loadedSession.encrypt(payload);
                        }).then(function (encrypted) {
                            encryptedBuffer = encrypted;
                            return _this.session_save(loadedSession);
                        }).then(function () {
                            resolve(encryptedBuffer);
                        });
                    });
                };
                Cryptobox.prototype.decrypt = function (session_id, ciphertext) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        var message;
                        var session;
                        _this.session_load(session_id)
                            .catch(function () {
                            return _this.session_from_message(session_id, ciphertext);
                        })
                            .then(function (value) {
                            var decrypted_message;
                            if (value[0] !== undefined) {
                                session = value[0];
                                decrypted_message = value[1];
                                return decrypted_message;
                            }
                            else {
                                session = value;
                                return value.decrypt(ciphertext);
                            }
                        })
                            .then(function (decrypted_message) {
                            message = decrypted_message;
                            return _this.session_save(session);
                        })
                            .then(function () {
                            resolve(message);
                        })
                            .catch(reject);
                    });
                };
                return Cryptobox;
            }());
            exports_1("Cryptobox", Cryptobox);
        }
    }
});
