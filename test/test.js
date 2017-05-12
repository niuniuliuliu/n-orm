/**
 * Created by ck on 10/05/2017.
 */
var norm = require('../index');
var assert = require('assert');


class StudentEntity extends norm.ORMEntity {
    constructor(orm) {
        super(orm);
    }
}
Object.defineProperty(StudentEntity.prototype, 'tableName',
    {
        value: 'student',
        enumerable: false
    });
Object.defineProperty(StudentEntity.prototype, 'columns', {
    value: [
        {name: 'id', ispk: true, defaultVal: 'uuid'},
        {name: 'name', ispk: false}
    ],
    enumerable: false
});
Object.defineProperty(StudentEntity.prototype, 'relations', {
    value: [
        {
            propertyName: 'courses',
            field: 'id',
            refColumn: 'studentid',
            entity: 'sc',
            relationType: 'OneToMany'
        }
    ],
    enumerable: false
});

class CourseEntity extends norm.ORMEntity {
    constructor(orm) {
        super(orm);
    }
}
Object.defineProperty(CourseEntity.prototype, 'tableName',
    {
        value: 'course',
        enumerable: false
    });
Object.defineProperty(CourseEntity.prototype, 'columns', {
    value: [
        {name: 'id', ispk: true, defaultVal: 'uuid'},
        {name: 'name', ispk: false}
    ],
    enumerable: false
});


class StudentCourseEntity extends norm.ORMEntity {
    constructor(orm) {
        super(orm);
    }
}
Object.defineProperty(StudentCourseEntity.prototype, 'tableName',
    {
        value: 'sc',
        enumerable: false
    });
Object.defineProperty(StudentCourseEntity.prototype, 'columns', {
    value: [
        {name: 'studentid', ispk: false},
        {name: 'courseid', ispk: false}
    ],
    enumerable: false
});
Object.defineProperty(StudentCourseEntity.prototype, 'relations', {
    value: [
        {
            propertyName: 'course',
            field: 'courseid',
            refColumn: 'id',
            entity: 'course',
            relationType: 'OneToOne'
        }
    ],
    enumerable: false
});


var orm = norm.connect({
    type: "mysql",
    server: "115.159.102.109",
    database: "test",
    user: "sa",
    password: "111111"
});

let Student = orm.defineEntity('Student', StudentEntity);


orm.defineEntity('Course', CourseEntity);
orm.defineEntity('StudentCourse', StudentCourseEntity);

Student.find().orderBy('id desc').run().then((result) => {
    console.log(result);
});

// describe('ORM', function () {
//     describe('#find', function () {
//         it('find with no relation', function () {
//             return ClientEntity.find().run();
//         });
//     });
// });


console.log('');