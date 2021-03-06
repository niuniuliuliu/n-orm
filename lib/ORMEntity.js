﻿let readOneToMany = '_readOneToMany_';
let getEntity = '_getEntity_';
let read = 'read';
let readAll = '_readAll_';
let buildSql = '_buildSql_';
let buildWhereSql = '_buildWhereSql_';
let getCount = '_getCount_';
let create = '_create_';
let update = '_update_';
let updateOneToMany = '_updateOneToMany_';
let del = '_del_';
let delOneToMany = 'delOneToMany';

class ORMEntity {
    constructor(orm) {
        Object.defineProperty(this, 'orm', {
            value: orm,
            enumerable: false
        });
        Object.defineProperty(this, 'db', {
            value: orm.db,
            enumerable: false
        });
        Object.defineProperty(this, 'queryCondition', {
            value: {
                page: null,
                conditions: [],
                orConditions: [],
                where: '',
                orderBy: '',
                only: false
            },
            enumerable: false,
            writable: true
        });
    }

    instance(obj) {
        return this[getEntity](this.tableName, obj);
    }

    find(condition) {
        for (let item in condition) {
            this.queryCondition.conditions.push({name: item, op: '=', value: condition[item]});
        }
        return this;
    }

    condition(condition) {
        this.queryCondition.conditions.push(condition);
        return this;
    }

    conditions(conditions) {
        for (let condition of conditions) {
            this.queryCondition.conditions.push(condition);
        }
        return this;
    }

    orCondition(condition) {
        this.queryCondition.orConditions.push(condition);
        return this;
    }

    where(where) {
        this.queryCondition.where += (where || '');
        return this;
    }

    only() {
        this.queryCondition.only = true;
        return this;
    }

    orderBy(orderBy) {
        this.queryCondition.orderBy = (orderBy || '');
        return this;
    }

    page(pageIndex, pageSize) {
        this.queryCondition.page = {pageIndex: pageIndex || 1, pageSize: pageSize || 10};
        return this;
    }

    async run({all = true} = {}) {
        if (this.queryCondition.page && this.queryCondition.orderBy === '') throw 'orderBy must be provided when query with page';
        let result;
        if (all) {
            result = await this[readAll](this, this.queryCondition);
        } else {
            result = await this[read](this, this.queryCondition);
        }
        this.queryCondition = {
            page: null,
            conditions: [],
            orConditions: [],
            where: '',
            orderBy: '',
            only: false
        };
        return result;
    }


    async count() {
        let count = await this[getCount](this, this.queryCondition);
        this.queryCondition = {
            page: null,
            conditions: [],
            orConditions: [],
            where: '',
            orderBy: '',
            only: false
        };
        return count;
    }

    async save({cascade = true} = {}) {
        let conditions = [];
        let pks = this.columns.filter((x) => x.ispk);
        for (let item of pks) {
            if (this[item.name])
                conditions.push({name: item.name, op: '=', value: this[item.name]});
        }
        let count = 0;
        if (pks.length > 0 && conditions.length === pks.length)
            count = await this[getCount](this, {conditions: conditions});
        let result = null;
        if (count === 0) {
            if (this.orm.options && this.orm.options.beforeInsert)
                this.orm.options.beforeInsert(this);
            result = await this[create](this, {cascade: cascade});
        }

        else {
            if (this.orm.options && this.orm.options.beforeUpdate)
                this.orm.options.beforeUpdate(this);
            result = await this[update](this, {cascade: cascade});
        }
        return result;
    }

    async del({cascade = true} = {}) {
        if (this.orm.options && this.orm.options.beforeDelete)
            this.orm.options.beforeDelete(this);
        let result = await this[del](this, {cascade: cascade});
        return result;
    }

    [getEntity](tableName, obj) {
        let entity = this.orm.entitys[tableName];
        if (!entity) throw `entity ${tableName} is not defined`;
        entity = new entity.constructor(this.orm);
        for (let item in obj) {
            let columns = entity.columns.filter((x) => x.name.toLowerCase() === item.toLowerCase());
            if (columns.length !== 0) {
                entity[columns[0].name] = obj[item];
            } else {
                let props = (entity.relations || []).filter((x) => x.propertyName.toLowerCase() === item.toLowerCase());
                if (props.length !== 0)
                    entity[props[0].propertyName] = obj[item];
            }
        }
        return entity;
    }

    [buildSql](entity, relations) {
        let displayColumns = entity.columns.filter((x) => !x.hide).map((x) => 't1.' + x.name + ' ' + x.name).join(',') + ',';
        let tableSql = '';
        let castNameCount = 1;
        let buildSql = (joinTableName, relation, entity) => {
            if (!entity.castRelations) {
                Object.defineProperty(entity, "castRelations", {
                    value: {},
                    enumerable: false
                });
            }
            let e = entity.castRelations[relation.entity + '@' + relation.field] || this[getEntity](relation.entity);
            entity.castRelations[relation.entity + '@' + relation.field] = e;
            e.castName = 't' + ++castNameCount;
            tableSql += ` left join ${e.tableName} ${e.castName} on ${joinTableName}.${relation.field}=${e.castName}.${relation.refColumn}`;
            displayColumns += e.columns.filter((x) => !x.hide).map((x) => `${e.castName}.${x.name} ${e.castName}_${x.name}`).join(',') + ',';
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildSql(e.castName, r, e);
            });
        };
        relations.forEach((item) => {
            buildSql('t1', item, entity);
        });
        let sql = `select ${displayColumns.substring(0, displayColumns.length - 1) } from ${ entity.tableName } t1 ${tableSql} where 1=1`;
        return sql;
    }

    [buildWhereSql](entity, relations, queryCondition, params) {
        let sql = '';
        for (let item of queryCondition.conditions) {
            let queryColumn = '';
            if (entity.columns.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
                queryColumn = `t1.${item.name}`;

            } else {
                relations.forEach((relation) => {
                    let e = entity.castRelations[relation.entity + '@' + relation.field];
                    if (e && e.columns.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
                        queryColumn = `${e.castName}.${item.name}`;
                    }
                });
            }
            if (queryColumn === '') continue;
            let svalues = [];
            switch (item.op) {
                case '=':
                case '!=':
                case '<>':
                case '>':
                case '>=':
                case '<':
                case '<=':
                case 'like':
                    sql += ` and ${queryColumn} ${item.op} ?`;
                    params.push(item.value);
                    break;
                case 'between':
                    svalues = item.value.split(',');
                    if (svalues.length !== 2) break;
                    sql += ` and ${queryColumn} between ? and ?`;
                    params.push(...svalues);
                    break;
                case 'in':
                    svalues = item.value.split(',');
                    if (svalues.length === 0) break;
                    sql += ` and ${queryColumn} in (`;
                    for (let i = 0; i < svalues.length; i++) {
                        sql += '?';
                        if (i !== svalues.length - 1)
                            sql += ',';
                        else
                            sql += ')';
                        params.push(svalues[i]);
                    }
                    break;
                case 'not in':
                    svalues = item.value.split(',');
                    if (svalues.length === 0) break;
                    sql += ` and ${queryColumn} not in (`;
                    for (let i = 0; i < svalues.length; i++) {
                        sql += '?';
                        if (i !== svalues.length - 1)
                            sql += ',';
                        else
                            sql += ')';
                        params.push(svalues[i]);
                    }
                    break;
            }
        }

        if (queryCondition.orConditions && queryCondition.orConditions.length > 0) {
            let ors = [];
            let orSql = '';
            for (let item of queryCondition.orConditions) {
                let queryColumn = '';
                if (entity.columns.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
                    queryColumn = `t1.${item.name}`;

                } else {
                    relations.forEach((relation) => {
                        let e = entity.castRelations[relation.entity + '@' + relation.field];
                        if (e && e.columns.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
                            queryColumn = `${e.castName}.${item.name}`;
                        }
                    });
                }
                if (queryColumn === '') continue;
                let svalues = [];
                switch (item.op) {
                    case '=':
                    case '!=':
                    case '<>':
                    case '>':
                    case '>=':
                    case '<':
                    case '<=':
                    case 'like':
                        ors.push(`${queryColumn} ${item.op} ?`);
                        params.push(item.value);
                        break;
                    case 'between':
                        svalues = item.value.split(',');
                        if (svalues.length !== 2) break;
                        ors.push(`${queryColumn} between ? and ?`);
                        params.push(...svalues);
                        break;
                    case 'in':
                        orSql = '';
                        svalues = item.value.split(',');
                        if (svalues.length === 0) break;
                        orSql += `${queryColumn} in (`;
                        for (let i = 0; i < svalues.length; i++) {
                            orSql += '?';
                            if (i !== svalues.length - 1)
                                orSql += ',';
                            else
                                orSql += ')';
                            params.push(svalues[i]);
                        }
                        ors.push(orSql);
                        break;
                    case 'not in':
                        orSql = '';
                        svalues = item.value.split(',');
                        if (svalues.length === 0) break;
                        orSql += `${queryColumn} not in (`;
                        for (let i = 0; i < svalues.length; i++) {
                            orSql += '?';
                            if (i !== svalues.length - 1)
                                orSql += ',';
                            else
                                orSql += ')';
                            params.push(svalues[i]);
                        }
                        ors.push(orSql);
                        break;
                }
            }
            if (ors.length > 0) {
                sql += ' and (' + ors.join(' or ') + ')';
            }
        }
        if (queryCondition.where)
            sql += ` ${queryCondition.where}`;
        return sql;
    }

    async [readOneToMany](relation, row) {
        let e = this[getEntity](relation.entity);
        let result = await this[read](e, {
            conditions: [{
                name: relation.refColumn,
                op: '=',
                value: row[relation.field]
            }],
            orderBy: relation.orderBy || ''
        });
        row[relation.propertyName] = result;
        let rs = e.relations || [];
        rs = rs.filter((x) => x.relationType === 'OneToMany');
        for (let ro of result) {
            for (let re of rs) {
                await this['readOneToMany'](re, ro);
            }
        }
        return row;
    }

    async [read](entity, queryCondition) {
        let buildResult = (relation, row, relObj, entity) => {
            let ne = {};
            let e = entity.castRelations[relation.entity + '@' + relation.field];
            e.columns.forEach((column) => {
                if (!column.hide && row[e.castName + '_' + column.name] !== undefined) {
                    ne[column.name] = row[e.castName + '_' + column.name];
                    if (column.format) {
                        ne[column.name] = this.formatValue(ne[column.name], column.format);
                    }
                    delete row[e.castName + '_' + column.name];
                }
            });
            let neEntity = e.instance(ne);
            relObj[relation.propertyName] = neEntity;
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildResult(r, row, neEntity, e);
            });
        };
        let relations = (entity.relations || []).filter((x) => x.relationType === 'OneToOne');
        let sql = this[buildSql](entity, relations);
        let params = [];
        sql += this[buildWhereSql](entity, relations, queryCondition, params);

        let rows = null;
        if (queryCondition.page) {
            rows = await this.db.getTablePage(sql, params, queryCondition.page.pageIndex, queryCondition.page.pageSize, queryCondition.orderBy);
        } else {
            if (queryCondition.orderBy)
                sql += ` order by ${queryCondition.orderBy}`;
            rows = await this.db.getTable(sql, params);
        }

        let entitys = rows.map((x) => entity.instance(x));
        rows.forEach((row, index) => {
            let formatColumns = entitys[index].columns.filter((x) => x.format);
            formatColumns.forEach((column) => {
                entitys[index][column.name] = this.formatValue(entitys[index][column.name], column.format);
            });
            relations.forEach((r) => {
                buildResult(r, row, entitys[index], entity);
            });
        });
        return entitys;
    }

    async [getCount](entity, queryCondition) {
        let relations = (entity.relations || []).filter((x) => x.relationType === 'OneToOne');
        let sql = this[buildSql](entity, relations);
        let params = [];
        sql += this[buildWhereSql](entity, relations, queryCondition, params);
        let total = await this.db.getTableCount(sql, params);
        return total;
    }

    async [readAll](entity, queryCondition) {
        let rows = await this[read](entity, queryCondition);
        let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
        let todoArray = [];
        for (let row of rows) {
            for (let relation of oneToManyRelations) {
                await this[readOneToMany](relation, row);
            }
        }
        if (queryCondition.only) {
            if (rows.length > 0) return rows[0];
            else return null;
        }
        return rows;
    }

    async [create](entity, {cascade = true} = {}) {
        let sql = `insert into ${ entity.tableName} (`;
        let valueSql = '';
        let params = [];
        for (let item of entity.columns) {
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
        if (cascade) {
            let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
            for (let relation of oneToManyRelations) {
                if (entity[relation.propertyName] && entity[relation.propertyName] instanceof Array) {
                    for (let i = 0; i < entity[relation.propertyName].length; i++) {
                        let reItem = entity[relation.propertyName][i];
                        reItem[relation.refColumn] = entity[relation.field];
                        let e = this[getEntity](relation.entity, reItem);
                        entity[relation.propertyName][i] = e;
                        await e.save();
                    }
                }
            }
        }
        return entity;
    }

    async [update](entity, {cascade = true} = {}) {
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
        if (pks.length === 0) throw 'no primary key';
        for (let item of pks) {
            if (!(item.name in entity)) throw 'primary key should be set';
            sql += ' and ' + item.name + '=?';
            params.push(entity[item.name]);
        }
        if (cascade) {
            await this[updateOneToMany](entity);
        }
        await this.db.execute(sql, params);
        return entity;
    }

    async [updateOneToMany](entity) {
        let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
        let resultArray = [];
        for (let relation of oneToManyRelations) {
            if (entity[relation.propertyName] && entity[relation.propertyName] instanceof Array) {
                let e = this[getEntity](relation.entity);
                let sql = 'delete from ' + e.tableName + ' where ' + relation.refColumn + ' =?';
                let params = [entity[relation.field]];
                await this.db.execute(sql, params);
                for (let i = 0; i < entity[relation.propertyName].length; i++) {
                    let reItem = entity[relation.propertyName][i];
                    reItem[relation.refColumn] = entity[relation.field];
                    let e = this[getEntity](relation.entity, reItem);
                    entity[relation.propertyName][i] = e;
                    await e.save();
                    resultArray.push(e);
                }
            }
        }
        return resultArray;
    }

    async [del](entity, {cascade = true} = {}) {
        let sql = 'delete from ' + entity.tableName + ' where 1=1 ';
        let params = [];
        let pks = entity.columns.filter((x) => x.ispk);
        if (pks.length === 0) throw 'no primary key';
        for (let item of pks) {
            if (!(item.name in entity)) throw 'primary key should be set';
            sql += ' and ' + item.name + '=?';
            params.push(entity[item.name]);
        }
        if (cascade) {
            await this[delOneToMany](entity);
        }
        await this.db.execute(sql, params);
        return entity;
    }

    async [delOneToMany](entity) {
        let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
        let resultArray = [];
        for (let relation of oneToManyRelations) {
            if (entity[relation.propertyName] && entity[relation.field]) {
                let e = this[getEntity](relation.entity);
                let sql = 'delete from ' + e.tableName + ' where ' + relation.refColumn + ' =?';
                let params = [entity[relation.field]];
                let result = await  this.db.execute(sql, params);
                resultArray.push(result);
            }
        }
        return resultArray;
    }

    formatValue(value, format) {
        if (!value) return value;
        switch (format) {
            case 'BufferToString':
                return value.toString('ascii');
            default:
                return value;
        }
    }

}

module.exports = ORMEntity;