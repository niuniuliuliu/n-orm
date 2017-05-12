let readOneToMany = '_readOneToMany_';
let getEntity = '_getEntity_';
let read = 'read';
let readAll = '_readAll_';
let buildRelationSql = '_buildRelationSql_';
let buildWhereSql = '_buildWhereSql_';
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
            this.queryCondition.conditions.push({name: item, op: 'like', value: '%' + condition[item] + '%'});
        }
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

    async run() {
        if (this.queryCondition.page && this.queryCondition.orderBy === '') throw 'orderBy must be provided when query with page';
        let result = await this.readAll(this, this.queryCondition);
        this.queryCondition = {
            page: null,
            conditions: [],
            where: '',
            orderBy: '',
            only: false
        };
        return result;
    }


    count() {

    }

    delete() {
        return this.constructor.db;
    }

    insert() {

    }

    update() {

    }


    [getEntity](tableName, obj) {
        let entity = this.orm.entitys[tableName];
        if (!entity) throw `entity ${tableName} is not defined`;
        entity = new entity.constructor(this.orm);
        for (var item in obj) {
            var columns = entity.columns.filter(function (x) {
                return x.name.toLowerCase() === item.toLowerCase();
            });
            if (columns.length !== 0) {
                entity[columns[0].name] = obj[item];
            }
        }
        return entity;
    }

    [buildRelationSql](joinTableName,relation){

    }

    async [readOneToMany](relation, row) {
        let e = relation.e || this[getEntity](relation.entity);
        relation.e = e;
        let result = await this.read(e, {
            conditions: [{
                name: relation.refColumn,
                op: '=',
                value: row[relation.field]
            }]
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

    async read(entity, queryCondition) {
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
            let neEntity = e.instance(ne);
            relObj[relation.propertyName] = neEntity;
            let rs = e.relations || [];
            rs = rs.filter((x) => x.relationType === 'OneToOne');
            rs.forEach((r) => {
                buildResult(r, row, neEntity);
            });
        };
        let relations = (entity.relations || []).filter((x) => x.relationType === 'OneToOne');
        relations.forEach((item) => {
            buildSql('t1', item);
        });
        let sql = `select ${displayColumns.substring(0, displayColumns.length - 1) } from ${ entity.tableName } t1 ${tableSql} where 1=1`;
        let params = [];


        for (let item of queryCondition.conditions) {
            if (entity.columns.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
                params.push(item.value);
                sql += ` and t1.${item.name} ${item.op} ?`;
            } else {
                relations.forEach((relation) => {
                    let e = relation.e || this[getEntity](relation.entity);
                    relation.e = e;
                    if (e.columns.some((x) => x.name.toLowerCase() === item.name.toLowerCase())) {
                        params.push(item.value);
                        sql += ` and ${relation.castName}.${item.name} ${item.op} ?`;
                    }
                });
            }
        }
        if (queryCondition.where)
            sql += ` ${queryCondition.where}`;
        if (queryCondition.orderBy)
            sql += ` order by ${queryCondition.orderBy}`;
        let rows = await this.db.getTable(sql, params);
        let entitys = rows.map((x) => entity.instance(x));
        rows.forEach((row, index) => {
            relations.forEach((r) => {
                buildResult(r, row, entitys[index]);
            });
        });
        return entitys;
    }

    async readAll(entity, queryCondition) {
        let rows = await this.read(entity, queryCondition);
        let oneToManyRelations = (entity.relations || []).filter((x) => x.relationType === 'OneToMany');
        var todoArray = [];
        for (let row of rows) {
            for (let relation of oneToManyRelations) {
                await this[readOneToMany](relation, row);
            }
        }
        if (queryCondition.only && rows.length > 0)
            return rows[0];
        return rows;
    }

}
module.exports = ORMEntity;