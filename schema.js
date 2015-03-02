module.exports = schema;

function schema(ast) {
    var self = this;
    self.defs = ast;
    self.errorList = [];
    self.checkedMap = new Map;
    self.checkers = null;
}

function ValidationError(value, context, message) {
    var self = this;
    self.value = value;
    self.context = context;
    self.message = message;
}

schema.prototype.validate = function validate(value) {
    var self = this;
    self.checkedMap.clear();
    self.errorList.length = 0;
    self.checkers = getBuiltInCheckers(self);
    self.defs.forEach(function (def) {
        switch (def.type) {
        case 'a_is_b': {
            var ltype = def.ltype;
            var rtype = def.rtype;
            var checkerName = (ltype.type === 'this') ? 'this' : ltype.name;
            // TODO: check_more type
            self.checkers[checkerName] = self.rtype(rtype);
        } break;
        case 'a_throws_b': {
            var ltype = def.ltype;
            var message = def.message;
            var checkerName = (ltype.type === 'this') ? 'this' : ltype.name;
            // TODO: check_more type
            self.checkers[checkerName] = self.error(message);
        } break;
        default: throw def;
        }
    });
    return self.check(self.checkers['this'], value, ['this']);
};

schema.prototype.throws = function throws(value, context, message) {
    var self = this;
    self.errorList.push(new ValidationError(value, context, message));
}
schema.prototype.check = function check(checker, value, context) {
    var self = this;
    var checkedMap = self.checkedMap;
    var resultMap;
    if (!checkedMap.has(value)) {
        resultMap = new Map;
        checkedMap.set(value, resultMap);
    } else {
        resultMap = checkedMap.get(value);
    }
    if (resultMap.has(checker))
        return resultMap.get(checker);
    var result = checker(value, context);
    resultMap.set(checker, result);
    return result;
}

schema.prototype.rtype = function rtype(rtypeNode) {
    var self = this;
    switch (rtypeNode.type) {
    case 'identifier': {
        return function checkerReference(value, context) {
            return self.checkers[rtypeNode.name](value, context);
        };
    } break;
    // TODO
    default: throw rtypeNode;
    }
}

schema.prototype.error = function error(message) {
    var self = this;
    return function customError(value, context) {
        self.throws(value, context, message);
    };
}

function getBuiltInCheckers(schema) {
    var throws = schema.throws.bind(schema);
    return {
        '*': passAll,
        'any': isSomething,
        'nothing': isNothing,
        'null': isNull,
        'number': isNumber,
        'string': isString,
        'boolean': isBoolean,
        'object': isObject,
        'array': isArray
    };
    function passAll(value, context) {
        return true;
    }
    function isSomething(value, context) {
        var result = value !== undefined;
        if (!result)
            throws(value, context, 'is nothing');
        return result;
    }
    function isNothing(value, context) {
        var result = value === undefined;
        if (!result)
            throws(value, context, 'is something');
        return result;
    }
    function isNull(value, context) {
        var result = value === null;
        if (!result)
            throws(value, context, 'is not null');
        return result;
    }
    function isNumber(value, context) {
        var result = typeof value === 'number';
        if (!result)
            throws(value, context, 'is not number');
        return result;
    }
    function isString(value, context) {
        var result = typeof value === 'string';
        if (!result)
            throws(value, context, 'is not string');
        return result;
    }
    function isBoolean(value, context) {
        var result = typeof value === 'boolean';
        if (!result)
            throws(value, context, 'is not boolean');
        return result;
    }
    function isObject(value, context) {
        var result = (typeof value === 'object') && !Array.isArray(value);
        if (!result)
            throws(value, context, 'is not object');
        return result;
    }
    function isArray(value, context) {
        var result = Array.isArray(value);
        if (!result)
            throws(value, context, 'is not array');
        return result;
    }
}
