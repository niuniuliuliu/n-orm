'use strict'
let mysql = require('mysql');
let Q = require('q');
let BaseDb = require('./BaseDb');
class MySql extends BaseDb {
    constructor(server, database, user, password) {
        super();
        this.currentConnection = null;
        this.pool = mysql.createPool({
            connectionLimit: 10,
            host: server,
            user: user,
            password: password,
            database: database
        });
    }

    getTable(sql, params) {
        let deferred = Q.defer();
        params = params || [];
        if (this.currentConnection) {
            this.currentConnection.query(sql, params, (err, rows, fields) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(rows);
                }
            });
        } else {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    connection.query(sql, params, (err, rows, fields) => {
                        connection.destroy();
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(rows);
                        }
                    });
                }
            });
        }
        return deferred.promise;
    }

    getTablePage(sql, params, pageIndex, pageSize, orderBy) {
        let deferred = Q.defer();
        sql = 'select * from (select * from (' + sql + ') a Order by ' + orderBy + ' LIMIT ' + ((pageIndex - 1) * pageSize) + ',' + pageSize + ') TableA';
        params = params || [];
        if (this.currentConnection) {
            this.currentConnection.query(sql, params, (err, rows, fields) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(rows);
                }
            });
        } else {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    connection.query(sql, params, (err, rows, fields) => {
                        connection.destroy();
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(rows);
                        }
                    });
                }
            });
        }
        return deferred.promise;
    }

    getTableCount(sql, params) {
        let deferred = Q.defer();
        sql = 'select count(1) as total from (' + sql + ') a';
        params = params || [];
        if (this.currentConnection) {
            this.currentConnection.query(sql, params, (err, rows, fields) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(rows[0].total);
                }
            });
        } else {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    connection.query(sql, params, (err, rows, fields) => {
                        connection.destroy();
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(rows[0].total);
                        }
                    });
                }
            });
        }
        return deferred.promise;
    }

    execute(sql, params) {
        let deferred = Q.defer();
        params = params || [];
        if (this.currentConnection) {
            this.currentConnection.query(sql, params, (err, result) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(result);
                }
            });
        }
        else {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    connection.query(sql, params, (err, result) => {
                        connection.destroy();
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(result);
                        }
                    });
                }
            });
        }
        return deferred.promise;
    }

    beginTransaction(level) {
        let deferred = Q.defer();
        if (this.currentConnection) {
            this.currentConnection.beginTransaction((err) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    if (level) {
                        this.setIsolationLevel(level).then(() => {
                            deferred.resolve(this.currentConnection);
                        }, (err) => {
                            deferred.reject(err);
                        });
                    } else {
                        deferred.resolve(this.currentConnection);
                    }
                }
            });
        }
        else {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    this.currentConnection = connection;
                    connection.beginTransaction((err) => {
                        if (err) {
                            deferred.reject(err);
                        }
                        else {
                            if (level) {
                                this.setIsolationLevel(level).then(() => {
                                    deferred.resolve(connection);
                                }, (err) => {
                                    deferred.reject(err);
                                });
                            } else {
                                deferred.resolve(connection);
                            }
                        }
                    });
                }
            });
        }
        return deferred.promise;
    }

    rollbackTransaction() {
        if (this.currentConnection) {
            this.currentConnection.rollback(() => {
                try {
                    this.currentConnection.destroy();
                }
                catch (e) {
                }
                finally {
                    this.currentConnection = null;
                }
            });
        }
    };

    commitTransaction() {
        if (this.currentConnection) {
            this.currentConnection.commit((err) => {
                if (err) {
                    this.rollbackTransaction();
                } else {
                    try {
                        this.currentConnection.destroy();
                    }
                    catch (e) {
                    }
                    finally {
                        this.currentConnection = null;
                    }
                }
            });
        }
    };

    setIsolationLevel(level) {
        let deferred = Q.defer();
        if (this.currentConnection) {
            this.execute('SET SESSION tx_isolation=\'' + level + '\' ').then(() => {
                deferred.resolve('');
            }, (err) => {
                deferred.reject(err);
            });
        } else {
            deferred.resolve('');
        }
        return deferred.promise;
    };
}
module.exports = MySql;
