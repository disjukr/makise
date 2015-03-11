var assert = require('assert');

var parser = require('../parser');
var schema = require('../schema');

function newSchema(makiseCode) {
    return new schema(parser.parse(makiseCode));
}
function result(value, makiseCode) {
    return newSchema(makiseCode).validate(value);
}
function errors(value, makiseCode) {
    var schemaInstance = newSchema(makiseCode);
    schemaInstance.validate(value);
    console.log(schemaInstance.errorList.map(function (error) {
        return error.toString();
    }));
    return schemaInstance.errorList;
}

describe('a_is_b', function() {
    describe('this is what?', function () {
        it('this is void', function () {
            assert(result(undefined, 'this is void'));
            assert(!result(1, 'this is void'));
        });
        it('this is number', function () {
            assert(result(1, 'this is number'));
            assert(!result(undefined, 'this is number'));
        });
        it('enum', function () {
            assert(result('apple', 'this is ("apple", "banana", "orange")'));
            assert(errors('kiwi', 'this is ("apple", "banana", "orange")').length > 0);
        });
        it('tuple', function () {
            assert(result([1, '2', true], 'this is [number, string, boolean]'));
            assert(result([1, '2', true, null], 'this is [number, string, boolean]'));
            assert(errors(['hello', false], 'this is [number, string, boolean]').length > 0);
            assert(errors([true, 'hi', null, 0], 'this is [number, string, boolean]').length > 0);
        });
        it('pattern', function () {
            assert(result([1, '2', true], 'this is [number, string, boolean, ...]'));
            assert(result([1, '2', true, 3, '4', false], 'this is [number, string, boolean, ...]'));
            assert(errors(['hello', false], 'this is [number, string, boolean, ...]').length > 0);
            assert(errors([true, 'hi', null, 0], 'this is [number, string, boolean, ...]').length > 0);
        });
        it('object', function () {
            assert(result({a: 1, b: '2', c: true}, 'this is {a: number, b: string, c: boolean}'));
            assert(errors({a: 1, b: '2', c: true}, 'this is {a: number, b: string, c: boolean, d: any}').length > 0);
            assert(result({a: 1, b: '2', c: true, d: null}, 'this is {a: number, b: string, c: boolean, *: any}'));
        });
        it('or', function () {
            assert(result(1, 'this is number or string'));
            assert(result('1', 'this is number or string'));
            assert(errors(true, 'this is number or string').length > 0);
        });
        it('and', function () {
            assert(result({a: 1, b: true}, 'this is {a: number} and {b: boolean}'));
            assert(result({a: 1, b: true, c: 'string'}, 'this is {a: number} and {b: boolean}'));
            assert(errors({a: 1, c: 'string'}, 'this is {a: number} and {b: boolean}').length > 0);
        });
        it('this is a, a is b, b is number', function () {
            assert(result(1, 'this is a \n a is b \n b is number'));
            assert(result(1, 'b is number \n a is b \n this is a'));
        });
        it('check more', function () {
            assert(errors(1, 'this is number \n this[true] throws "hi, {{context}}"').length > 0);
            assert(result(1, 'this is number \n this[false] throws "bye, {{context}}"'));
            assert(errors(true, 'this is boolean \n this[this] throws "oh"').length > 0);
            assert(result(false, 'this is boolean \n this[this] throws "ho"'));
        });
        it('expression', function () {
            assert(errors({a: 0}, 'this is object \n this[a = 0] throws "0"').length > 0);
        });
    });
});

describe('a_throws_b', function() {
    it ('(╯°□°）╯︵ ┻━┻', function () {
        assert(errors(undefined, 'this throws "(╯°□°）╯︵ ┻━┻"').length > 0);
    });
});
