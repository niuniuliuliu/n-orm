'use strict'
let BaseDb = require('./BaseDb');
let MsSql = require('mssql');

class SqlServer extends BaseDb {
    constructor({server, database, user, password, port = 1433} = {}) {
        super();
        this.pool = null;
        this.transaction = null;
        this.config = {
            user: user,
            password: password,
            server: server,
            database: database,
            port: port,
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            }
        };
    }

    getPool() {
        return new Promise((resolve, reject) => {
            if (this.pool) {
                resolve(this.pool);
            } else {
                let pool = new MsSql.ConnectionPool(this.config, err => {
                    if (err) reject(err);
                    else {
                        this.pool = pool;
                        resolve(pool);
                    }
                });
            }
        });
    }

    async getTable(sql, params) {
        await this.getPool();
        let br = this.buildRequest(sql, params);
        let result = await br.request.query(br.sql);
        return result.recordset;
    }

    async getTablePage(sql, params, pageIndex, pageSize, orderBy) {
        await this.getPool();
        let pageSql = `select top(${pageSize}) * from (select *,Row_Number() Over (order by ${orderBy}) as RowNumber From(${sql}) tmp) TableA
        Where TableA.RowNumber>${pageSize}*${pageIndex - 1}`;
        let br = this.buildRequest(pageSql, params);
        let result = await br.request.query(br.sql);
        return result.recordset;
    }

    async getTableCount(sql, params) {
        await this.getPool();
        let countSql = `select count(1) as total from (${sql}) tmp`;
        let br = this.buildRequest(countSql, params);
        let result = await br.request.query(br.sql);
        return result.recordset[0].total;
    }

    async execute(sql, params) {
        await this.getPool();
        let br = this.buildRequest(sql, params);
        let result = await br.request.query(br.sql);
        return result.rowsAffected[0];
    }

    async beginTransaction(level) {
        await this.getPool();
        this.transaction = this.pool.transaction();
        if (level)
            await this.transaction.begin(this.mapIoslationLevel(level));
        else
            await this.transaction.begin();
        return this.transaction;
    }

    rollbackTransaction() {
        if (this.transaction) {
            this.transaction.rollback(err => {
                this.transaction = null;
            });
        }
    }

    commitTransaction() {
        if (this.transaction) {
            this.transaction.commit(err => {
                if (err)
                    this.rollbackTransaction();
                else
                    this.transaction = null;
            });
        }
    }

    buildRequest(sql, params) {
        let request = this.transaction ? this.transaction.request() : this.pool.request();
        if (!(params && Array.isArray(params) && params.length > 0))
            return {sql: sql, request: request};
        let reg = new RegExp('\'\\S{1,}\'', 'g');
        let match = null;
        let startIndex = 0, paramIndex = 0;
        let newSql = '';
        let addParam = () => {
            let value = params[paramIndex];
            let paramName = 'param' + paramIndex;
            request = request.input(paramName, value);
            paramIndex++;
            return '@' + paramName;
        };
        do {
            match = reg.exec(sql);
            if (!match) break;
            let str = sql.substring(startIndex, match.index);
            while (str.indexOf('?') !== -1) {
                str = str.replace('?', addParam());
            }
            newSql += str + match[0];
            startIndex = match.index + match[0].length + 1;
        } while (match);
        let leftStr = sql.substring(startIndex);
        while (leftStr.indexOf('?') !== -1) {
            leftStr = leftStr.replace('?', addParam());
        }
        newSql += leftStr;
        return {sql: newSql, request: request};
    }

    mapIoslationLevel(level) {
        switch (level) {
            case this.ISOLATION_LEVEL.READ_UNCOMMITTED:
                return MsSql.ISOLATION_LEVEL.READ_COMMITTED;
            case this.ISOLATION_LEVEL.READ_COMMITTED:
                return MsSql.ISOLATION_LEVEL.READ_UNCOMMITTED;
            case this.ISOLATION_LEVEL.REPEATABLE_READ:
                return MsSql.ISOLATION_LEVEL.REPEATABLE_READ;
            case this.ISOLATION_LEVEL.SERIALIZABLE:
                return MsSql.ISOLATION_LEVEL.SERIALIZABLE;
            default:
                return MsSql.ISOLATION_LEVEL.READ_COMMITTED;
        }
    }
}

module.exports = SqlServer;