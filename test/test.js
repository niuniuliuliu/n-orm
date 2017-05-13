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
    server: "localhost",
    database: "test",
    user: "sa",
    password: "111111"
});

let Student = orm.defineEntity('Student', StudentEntity);


let Course = orm.defineEntity('Course', CourseEntity);
orm.defineEntity('StudentCourse', StudentCourseEntity);
let english = null, math = null, kevin = null, judy = null;
describe('ORM', function () {
    describe('#save-add', function () {
        it('add course english', function () {
            english = Course.instance({id: 1, name: 'english'});
            return english.save();
        });
        it('add course math', function () {
            math = Course.instance({id: 2, name: 'math'});
            return math.save();
        });
        it('add student judy with no course', function () {
            judy = Student.instance({id: 1, name: 'judy'});
            return judy.save();
        });
        it('add student kevin with course', function () {
            kevin = Student.instance({id: 2, name: 'kevin', courses: [{courseid: 1}, {courseid: 2}]});
            return kevin.save();
        });
    });
    describe('#find', function () {
        it('find', function (done) {
            Course.find().run().then(function (result) {
                assert(result.length === 2, 'course length should be 2');
                done();
            }, function (err) {
                done(err);
            });
        });
        it('find math', function () {
            return Course.find({name: 'Math'}).run();
        });
        it('find with condition,where', function (done) {
            Course.find({name: 'Math'}).where(' and id=2').run().then(function (result) {
                assert(result.length === 1, 'course length should be 1');
                done();
            }, function (err) {
                done(err);
            });
        });
        it('find with condition,where,only', function (done) {
            Course.find({name: 'Math'}).where(' and id=2').only().run().then(function (result) {
                assert(result.name === 'math', 'course name should be math');
                done();
            }, function (err) {
                done(err);
            });
        });
        it('find with condition,where,only,orderBy', function () {
            return Course.find({name: 'Math'}).where(' and id=2').only().orderBy('name desc').run();
        });
        it('find with page', function (done) {
            Course.find().orderBy('name desc').page(1, 1).run().then(function (result) {
                assert(result.length === 1, 'course length should be 1');
                done();
            }, function (err) {
                done(err);
            });
        });
        it('count', function (done) {
            Course.find().orderBy('name desc').count().then(function (count) {
                assert(count === 2, 'count should be 2');
                done();
            }, function (err) {
                done(err);
            });
        });
    });
    describe('#save-update', function () {
        it('find course english', function (done) {
            Course.find({name: 'english'}).only().run().then(function (course) {
                english = course;
                assert('course name should be english', course.name === 'english');
                done();
            }, function (err) {
                done(err);
            });
        });
        it('update course english to chinese', function () {
            english.name = 'chinese';
            return english.save();
        });
        it('find course chinese', function (done) {
            Course.find({name: 'chinese'}).only().run().then(function (course) {
                assert('course name should be chinese', course.name === 'chinese');
                done();
            }, function (err) {
                done(err);
            });
        });
        it('find student kevin', function (done) {
            Student.find({name: 'kevin'}).only().run().then(function (student) {
                kevin = student;
                assert('student name should be kevin', student.name === 'kevin');
                assert('kevin courses number should be 2', student.courses.length === 2);
                done();
            }, function (err) {
                done(err);
            });
        });
        it('update kevin courses to  math only', function () {
            kevin.courses = [{courseid: 2}];
            return kevin.save();
        });
        it('find student kevin again', function (done) {
            Student.find({name: 'kevin'}).only().run().then(function (student) {
                kevin = student;
                assert('kevin courses number should be 1', student.courses.length === 1);
                done();
            }, function (err) {
                done(err);
            });
        });
    });


    describe('#delete', function () {
        it('delete judy', function () {
            return judy.del();
        });
        it('delete kevin', function () {
            return kevin.del();
        });
    });
});