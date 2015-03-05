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
        it('this is nothing', function () {
            assert(result(undefined, 'this is nothing'));
            assert(!result(1, 'this is nothing'));
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
            assert(errors([1, '2', true, 3, '4', false], 'this is [number, string, boolean]').length > 0);
            assert(errors(['hello', false], 'this is [number, string, boolean]').length > 0);
            assert(errors([true, 'hi', null, 0], 'this is [number, string, boolean]').length > 0);
        });
        it('pattern', function () {
            assert(result([1, '2', true], 'this is [number, string, boolean, ...]'));
            assert(result([1, '2', true, 3, '4', false], 'this is [number, string, boolean, ...]'));
            assert(errors(['hello', false], 'this is [number, string, boolean, ...]').length > 0);
            assert(errors([true, 'hi', null, 0], 'this is [number, string, boolean, ...]').length > 0);
        });
    });
});

describe('a_throws_b', function() {
    it ('(╯°□°）╯︵ ┻━┻', function () {
        assert(errors(undefined, 'this throws "(╯°□°）╯︵ ┻━┻"').length > 0);
    });
});
