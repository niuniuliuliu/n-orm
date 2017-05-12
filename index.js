/**
 * Created by ck on 10/05/2017.
 */
var ORMDb = require('./lib/ORM');
var ORMEntity = require('./lib/ORMEntity');
exports.ORMEntity = ORMEntity;

exports.connect = (dbConfig) => {
    return new ORMDb(dbConfig);
};

exports.exress = (connect) => {

};