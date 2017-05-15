/**
 * Created by ck on 10/05/2017.
 */
let MySql = require('./MySql');
let ORMEntity = require('./ORMEntity');
class ORM {
    constructor(dbConfig) {
        this.entitys = {};
        this.options = null;
        if (typeof dbConfig === 'object') {
            switch (dbConfig.type) {
                case 'mysql':
                    this.db = new MySql(dbConfig.server, dbConfig.database, dbConfig.user, dbConfig.password);
                    break;
                default:
                    throw new Error("invalid database type");
            }
        } else {
            throw 'parameter should be an object';
        }
    }

    defineEntity(key, Entity) {
        let ormEntity = new Entity(this);
        this.entitys[key] = ormEntity;
        this.entitys[Entity.prototype.tableName] = ormEntity;
        return ormEntity;
    }

    opts({beforeInsert = null, beforeUpdate = null, beforeDelete = null} = {}) {
        this.options = {
            beforeInsert: beforeInsert,
            beforeUpdate: beforeUpdate,
            beforeDelete: beforeDelete
        };
    }
}

module.exports = ORM;