var fs = require('fs');
var assert = require('assert');

var parser = require('../parser');
var schema = require('../schema');

function file(path) {
    return fs.readFileSync(path, { encoding: 'utf8' });
}
function json(path) {
    return JSON.parse(file(path));
}
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
            assert(errors(0, 'this is number \n this[this < 1] throws "0"').length > 0);
            assert(result(1, 'this is number \n this[this < 1] throws "0"'));
            assert(errors(0, 'this is number \n this[this <= 1] throws "0"').length > 0);
            assert(errors(1, 'this is number \n this[this <= 1] throws "0"').length > 0);
            assert(result(0, 'this is number \n this[this > 1] throws "0"'));
            assert(result(1, 'this is number \n this[this > 1] throws "0"'));
            assert(result(0, 'this is number \n this[this >= 1] throws "0"'));
            assert(errors(1, 'this is number \n this[this >= 1] throws "0"').length > 0);
            assert(errors(5, 'this is number \n this[this = 2 + 3] throws "5"').length > 0);
            assert(errors(-1, 'this is number \n this[this = 2 - 3] throws "-1"').length > 0);
            assert(errors(6, 'this is number \n this[this = 2 * 3] throws "6"').length > 0);
            assert(errors(1.5, 'this is number \n this[this = 3 / 2] throws "1.5"').length > 0);
            assert(errors(1, 'this is number \n this[this = 3 % 2] throws "1"').length > 0);
            assert(result(undefined, 'this[this?] throws "not undefined"'));
            assert(errors(1, 'this[this?] throws "not undefined"').length > 0);
            assert(errors(false, 'this[this?] throws "not undefined"').length > 0);
            assert(errors(0, 'this[this?] throws "not undefined"').length > 0);
            assert(errors(NaN, 'this[this?] throws "not undefined"').length > 0);
            assert(errors('', 'this[this?] throws "not undefined"').length > 0);
            assert(errors('0', 'this[this?] throws "not undefined"').length > 0);
            assert(errors(null, 'this[this?] throws "not undefined"').length > 0);
            assert(result(0, 'this[false and false] throws "and"'));
            assert(result(0, 'this[true and false] throws "and"'));
            assert(result(0, 'this[false and true] throws "and"'));
            assert(errors(0, 'this[true and true] throws "and"').length > 0);
            assert(result(0, 'this[false or false] throws "or"'));
            assert(errors(0, 'this[true or false] throws "or"').length > 0);
            assert(errors(0, 'this[false or true] throws "or"').length > 0);
            assert(errors(0, 'this[true or true] throws "or"').length > 0);
        });
    });
});

describe('a_throws_b', function() {
    it ('(╯°□°）╯︵ ┻━┻', function () {
        assert(errors(undefined, 'this throws "(╯°□°）╯︵ ┻━┻"').length > 0);
    });
});

describe('etc', function () {
    it('default', function () {
        assert(result({}, 'this is {a: number = 1}'));
        assert(errors({}, 'this is {a: number}').length > 0);
        assert(result({}, 'this is {a = 1}'));
        assert(errors({a: '1'}, 'this is {a = 1}').length > 0);
    });
    it('allow trailing comma', function () {
        assert(result({}, 'this is {a: *,}'));
        assert(result({}, 'this is {a: * = {a: "a",}}'));
        assert(result([0], 'this is [*,]'));
        assert(result({}, 'this is {a: * = [1,]}'));
        assert(result(0, 'this is (0,)'));
    });
    it('only conditional', function () {
        assert(result(undefined, 'this is c \n c[false] throws "oh?"'));
        assert(errors(undefined, 'this is c \n c[true] throws "ho!"').length > 0);
    });
    it('merge', function () {
        var schema = 'this is {a: number} \n this is {b: string}';
        assert(result({a: 0, b: '0'}, schema));
        assert(errors({a: 0}, schema).length > 0);
        assert(errors({b: '0'}, schema).length > 0);
    })
    it('int', function () {
        var schema = 'this is int \n int is number \n int[not this % 1 = 0] throws "{{context}} is not int"';
        assert(result(1, schema));
        assert(errors(1.5, schema).length > 0);
    });
    it ('package.json', function () {
        assert(result(json('package.json'), file('test/package.json.makise')));
    });
});
