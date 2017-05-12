/**
 * Created by ck on 04/05/2017.
 */
class BaseDb {
    constructor() {
        this.ISOLATION_LEVEL = {
            READ_UNCOMMITTED: ' READ UNCOMMITTED',
            READ_COMMITTED: ' READ COMMITTED',
            REPEATABLE_READ: 'REPEATABLE READ',
            SERIALIZABLE: 'SERIALIZABLE'
        };
    }

    getTable(sql, params) {
        throw 'Not Implemented';
    }

    getTablePage(sql, params, pageIndex, pageSize, orderBy) {
        throw 'Not Implemented';
    }

    getTableCount(sql, params) {
        throw 'Not Implemented';
    }

    execute(sql, params) {
        throw 'Not Implemented';
    }

    beginTransaction(level) {
        throw 'Not Implemented';
    }

    rollbackTransaction() {
        throw 'Not Implemented';
    };

    commitTransaction() {
        throw 'Not Implemented';
    };

    setIsolationLevel(level) {
        throw 'Not Implemented';
    };
}
module.exports = BaseDb;