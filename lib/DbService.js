/**
 * Created by ck on 11/03/2017.
 */
let uuidV1 = require('uuid/v1');
let readOneToMany = '_readOneToMany_';
let getEntity = '_getEntity_';
let updateOneToMany = '_updateOneToMany_';
let deleteOneToMany = '_deleteOneToMany_';
class DbService {
    constructor(orm, userId, userName) {
        this.db = orm.db;
        this.orm = orm;
        this.userId = userId;
        this.userName = userName;
    }

    /***private methods***/

    [getEntity](entityName, obj) {
        let Entity = this.orm.entitys[entityName];
        if (!Entity) throw `entity ${entityName} is not defined`;
        return new Entity(obj);
    }

    async [readOneToMany](relation, row) {
        let e = relation.e || this[getEntity](relation.entity);
        relation.e = e;
        let search = {};
        search[relation.refColumn] = row[relation.field];
        let result = await this.read(e, '', search);
        row[relation.propertyName] = result;
        let rs = e.relations || [];
        rs = rs.filter((x) => x.relationType === 'OneToMany');
        for (let ro of result) {
            for (let re of rs) {
                await this[readOneToMany](re, ro);
            }
        }
        return row;
    }

    async [updateOneToMany](entity) {
        let oneToManyRelations = entity.relations.filter((x) => x.relationType === 'OneToMany');
        let resultArray = [];
        for (let relation of oneToManyRelations) {
            if (entity[relation.propertyName] && entity[relation.field]) {
                let e = relation.e || this[getEntity](relation.entity);
                relation.e = e;
                let sql = 'delete from ' + e.tableName + ' where ' + relation.refColumn + ' =?';
                let params = [entity[relation.field]];
                await this.db.execute(sql, params);
                for (let item of entity[relation.field]) {
                    let newEntity = this[getEntity](relation.entity, item);
                    let result = await this.create(newEntity);
                    resultArray.push(result);
                }
            }
        }
        return resultArray;
    }

    async [deleteOneToMany](entity) {
        let oneToManyRelations = entity.relations.filter((x) => x.relationType === 'OneToMany');
        let resultArray = [];
        for (let relation of oneToManyRelations) {
            if (entity[relation.propertyName] && entity[relation.field]) {
                let e = relation.e || this[getEntity](relation.entity);
                relation.e = e;
                let sql = 'delete from ' + e.tableName + ' where ' + relation.refColumn + ' =?';
                let params = [entity[relation.field]];
                let result = await  this.db.execute(sql, params);
                resultArray.push(result);
            }
        }
        return resultArray;
    }

    /***end private methods***/
    async read(entity, orderBy, search) {
        let displayColumns = entity.columns.filter((x) => !x.hide).map((x) => 't1.' + x.name + ' ' + x.name).join(',') + ',';
        let tableSql = '';
        let castNameCount = 1;
        let buildSql = (joinTableName, relation) => {
            relation.castName = 't' + ++castNameCount;
            let e = relation.e || this[getEntity](relation.entity);
            relation.e = e;
            tableSql += ` left join ${e.tableName} ${relation.castName} on ${joinTableName}.${relation.field}=${relation.castName}.${relation.refColumn}`;
            displayColumns += e.columns.filter((x) => !x.hide).map((x) => `${relation.castName}.${x.name} ${relation.castName}_${x.name}`).join(',') + ',';
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildSql(relation.castName, r);
            });
        };
        let buildResult = (relation, row, relObj) => {
            let ne = {};
            let e = relation.e || this[getEntity](relation.entity);
            relation.e = e;
            e.columns.forEach((column) => {
                if (!column.hide && row[relation.castName + '_' + column.name] !== undefined) {
                    ne[column.name] = row[relation.castName + '_' + column.name];
                    delete row[relation.castName + '_' + column.name];
                }
            });
            relObj[relation.propertyName] = ne;
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildResult(r, row, ne);
            });
        };
        let relations = (entity.relations || []).filter((x) => x.relationType === 'OneToOne');
        relations.forEach((item) => {
            buildSql('t1', item);
        });
        let sql = `select ${displayColumns.substring(0, displayColumns.length - 1) } from ${ entity.tableName } t1 ${tableSql} where 1=1`;
        let params = [];
        for (var item in search) {
            if (entity.columns.some((x) => x.name.toLowerCase() === item.toLowerCase())) {
                params.push(search[item]);
                sql += ' and t1.' + item + ' like ?';
            } else {
                relations.forEach((relation) => {
                    let e = relation.e || this[getEntity](relation.entity);
                    relation.e = e;
                    if (e.columns.some((x) => x.name.toLowerCase() === item.toLowerCase())) {
                        params.push(search[item]);
                        sql += ' and ' + relation.castName + '.' + item + ' like ?';
                    }
                });
            }
        }
        if (orderBy)
            sql += ' order by ' + orderBy;
        let rows = await this.db.getTable(sql, params);
        rows.forEach((row) => {
            relations.forEach((r) => {
                buildResult(r, row, row);
            });
        });
        return rows;
    }

    async readAll(entity, orderBy, search) {
        let rows = await this.read(entity, orderBy, search);
        let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
        var todoArray = [];
        for (let row of rows) {
            for (let relation of oneToManyRelations) {
                await this[readOneToMany](relation, row);
            }
        }
        return rows;
    }

    async readPage(entity, pageIndex, pageSize, orderBy, search) {
        let displayColumns = entity.columns.filter((x) => !x.hide).map((x) => 't1.' + x.name + ' ' + x.name).join(',') + ',';
        let tableSql = '';
        let castNameCount = 1;
        let buildSql = (joinTableName, relation) => {
            relation.castName = 't' + ++castNameCount;
            let e = relation.e || this[getEntity](relation.entity);
            relation.e = e;
            tableSql += ` left join ${e.tableName} ${relation.castName} on ${joinTableName}.${relation.field}=${relation.castName}.${relation.refColumn}`;
            displayColumns += e.columns.filter((x) => !x.hide).map((x) => `${relation.castName}.${x.name} ${relation.castName}_${x.name}`).join(',') + ',';
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildSql(relation.castName, r);
            });
        };
        let buildResult = (relation, row, relObj) => {
            let ne = {};
            let e = relation.e || this[getEntity](relation.entity);
            relation.e = e;
            e.columns.forEach((column) => {
                if (!column.hide && row[relation.castName + '_' + column.name] !== undefined) {
                    ne[column.name] = row[relation.castName + '_' + column.name];
                    delete row[relation.castName + '_' + column.name];
                }
            });
            relObj[relation.propertyName] = ne;
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildResult(r, row, ne);
            });
        };
        let relations = (entity.relations || []).filter((x) => x.relationType === 'OneToOne');
        relations.forEach((item) => {
            buildSql('t1', item);
        });

        let sql = `select ${displayColumns.substring(0, displayColumns.length - 1) } from ${ entity.tableName } t1 ${tableSql} where 1=1`;
        let params = [];

        for (var item in search) {
            if (entity.columns.some((x) => x.name.toLowerCase() === item.toLowerCase())) {
                params.push(search[item]);
                sql += ' and t1.' + item + ' like ?';
            } else {
                relations.forEach((relation) => {
                    let e = relation.e || this[getEntity](relation.entity);
                    relation.e = e;
                    if (e.columns.some((x) => x.name.toLowerCase() === item.toLowerCase())) {
                        params.push(search[item]);
                        sql += ' and ' + relation.castName + '.' + item + ' like ?';
                    }
                });
            }
        }
        let rows = await this.db.getTablePage(sql, params, pageIndex, pageSize, orderBy);
        for (let row of rows) {
            for (let r of relations) {
                buildResult(r, row, row);
            }
        }
        let total = await this.db.getTableCount(sql, params);
        return {list: rows, total: total};
    }

    async readPageAll(entity, pageIndex, pageSize, orderBy, search) {
        let rows = await this.readPage(entity, pageIndex, pageSize, orderBy, search);
        let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
        for (let row of rows.list) {
            for (let relation of oneToManyRelations) {
                await this[readOneToMany](relation, row)
            }
        }
        return rows;
    }

    async create(entity) {
        if (entity.columns.some((x) => x.name.toLowerCase() == 'creator')) {
            entity['creator'] = this.userName || entity['creator'];
        }
        if (entity.columns.some((x) => x.name.toLowerCase() == 'creationdate')) {
            entity['creationDate'] = new Date();
        }
        let sql = `insert into ${ entity.tableName} (`;
        let valueSql = '';
        let params = [];
        for (let item of entity.columns) {
            if (item.defaultVal !== undefined) {
                entity[item.name] = item.defaultVal;
                if (item.defaultVal === 'uuid')
                    entity[item.name] = uuidV1();
            }
            if (item.name in entity) {
                sql += item.name + ',';
                params.push(entity[item.name]);
                valueSql += '?,';
            }
        }
        sql = sql.substring(0, sql.length - 1) + ') values ';
        valueSql = '(' + valueSql.substring(0, valueSql.length - 1) + ')';
        sql = sql + valueSql;
        let result = await this.db.execute(sql, params);
        let relations = entity.relations || [];
        let oneToManyRelations = relations.filter((x) => x.relationType === 'OneToMany');
        for (let item of oneToManyRelations) {
            var T = require('../../entity/' + item.entity + '.js');
            if (entity[item.propertyName] && entity[item.propertyName] instanceof Array) {
                for (let i = 0; i < entity[item.propertyName].length; i++) {
                    let reItem = entity[item.propertyName][i];
                    reItem[item.refColumn] = entity[item.field];
                    let e = new T(reItem);
                    entity[item.propertyName][i] = e;
                    await  this.create(e);
                }
            }
        }
        return entity;
    }

    async update(entity, options) {
        if (entity.columns.some((x) => x.name.toLowerCase() == 'modifier')) {
            entity['modifier'] = this.userName || entity['modifier'];
        }
        if (entity.columns.some((x) => x.name.toLowerCase() == 'modificationdate')) {
            entity['modificationDate'] = new Date();
        }
        let sql = 'update ' + entity.tableName + ' set ';
        let params = [];
        for (let item of entity.columns) {
            if ((item.name in entity) && !item.ispk) {
                sql += item.name + '=?,';
                params.push(entity[item.name]);
            }
        }
        sql = sql.substring(0, sql.length - 1) + ' where 1=1';
        let pks = entity.columns.filter((x) => x.ispk);
        if (pks.length === 0) throw new PFError('no pk column');
        for (let item of pks) {
            if (!(item.name in entity)) throw new PFError('pk column is not set');
            sql += ' and ' + item.name + '=?';
            params.push(entity[item.name]);
        }
        if (options && options.cascade === true) {
            await this[updateOneToMany](entity);
        }
        await this.db.execute(sql, params);
        return entity;
    }

    async delete(entity, options) {
        let sql = 'delete from ' + entity.tableName + ' where 1=1 ';
        let params = [];
        let pks = entity.columns.filter((x) => x.ispk);
        if (pks.length === 0) throw new PFError('no pk column');
        for (let item of pks) {
            if (!(item.name in entity)) throw new PFError('pk column is not set');
            sql += ' and ' + item.name + '=?';
            params.push(entity[item.name]);
        }
        if (options && options.cascade === true) {
            await this[deleteOneToMany](entity);
        }
        await this.db.execute(sql, params);
        return entity;
    }
}
module.exports = DbService;