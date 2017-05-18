/**
 * Created by ck on 10/05/2017.
 */
var ORM = require('./lib/ORM');
var ORMEntity = require('./lib/ORMEntity');
exports.ORMEntity = ORMEntity;

exports.connect = (dbConfig) => {
    return new ORM(dbConfig);
};

exports.express = (dbConfig) => {
    return (req, res, next) => {
        req.orm = new ORM(dbConfig);
        next();
    }
};