require('es6-shim');

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
ValidationError.prototype.toString = function toString() {
    var self = this;
    return self.message.replace(/\{\{(.+?)\}\}/g, function (match, field) {
        return self[field + 'Repr'](self[field]);
    });
};
ValidationError.prototype.valueRepr = function valueRepr(value) {
    return JSON.stringify(value) + '';
};
ValidationError.prototype.contextRepr = function contextRepr(context) {
    var identifierRegex = /[$_a-z][$_a-z0-9]*/i; // not correct but working anyway
    var temp = context.map(function (field) {
        if (identifierRegex.test(field)) {
            var ok = true;
            try {
                eval('ok.' + field); // reserved keywords filter
            } catch (e) {
                ok = false;
            }
            if (ok) return '.' + field;
        }
        return '[' + JSON.stringify(field) + ']';
    });
    temp.unshift('this');
    return temp.join('');
};

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
    return self.check(self.checkers['this'], value, []);
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
    var throws = self.throws.bind(self);
    switch (rtypeNode.type) {
    case 'identifier': {
        return function checkerReference(value, context) {
            return self.checkers[rtypeNode.name](value, context);
        };
    } break;
    case 'enum': {
        return function enumChecker(value, context) {
            var items = rtypeNode.items;
            var result = items.indexOf(value) > -1;
            if (!result) {
                var itemsString = items.map(function (item) {
                    return JSON.stringify(item);
                }).join(', ');
                throws(value, context, '{{context}} must be one of ' + itemsString + '. but {{value}}');
            }
            return result;
        };
    } break;
    case 'tuple': {
        return function tupleChecker(value, context) {
            var rtypes = rtypeNode.items.map(function (item) {
                return self.rtype(item);
            });
            var allIsWell = true;
            var thisIsArray = self.check(self.checkers['array'], value, context);
            if (thisIsArray) {
                var correctLength = value.length >= rtypes.length;
                if (!correctLength) {
                    throws(value, context, '{{context}} has too little. needs more or equal than ' + rtypes.length + ', but ' + value.length);
                    allIsWell = false;
                }
                value.forEach(function (item, index) {
                    var rtype = rtypes[index];
                    if (rtype === undefined) return;
                    var currentContext = context.concat(index);
                    var result = self.check(rtype, item, currentContext);
                    if (!result) allIsWell = false;
                });
            } else {
                allIsWell = false;
            }
            return allIsWell;
        };
    } break;
    case 'pattern': {
        return function patternChecker(value, context) {
            var rtypes = rtypeNode.items.map(function (item) {
                return self.rtype(item);
            });
            var allIsWell = true;
            var thisIsArray = self.check(self.checkers['array'], value, context);
            if (thisIsArray) {
                var patternLength = rtypes.length;
                var correctLength = (value.length % patternLength) === 0;
                if (!correctLength) {
                    throws(value, context, '{{context}} has wrong number of items. expected a multiple of ' + rtypes.length + ', but ' + value.length);
                    allIsWell = false;
                }
                value.forEach(function (item, index) {
                    var rtype = rtypes[index % patternLength];
                    var currentContext = context.concat(index);
                    var result = self.check(rtype, item, currentContext);
                    if (!result) allIsWell = false;
                });
            } else {
                allIsWell = false;
            }
            return allIsWell;
        };
    } break;
    case 'object': {
        return function objectChecker(value, context) {
            var fields = rtypeNode.fields.map(function (field) {
                var replica = Object.create(field);
                replica.rtype = self.rtype(replica.rtype);
                return replica;
            });
            var allIsWell = true;
            var thisIsObject = self.check(self.checkers['object'], value, context);
            if (thisIsObject) {
                var plainFields = [];
                var wildcard = null;
                fields.forEach(function (field) {
                    switch (field.match.type) {
                    case 'plain': {
                        plainFields.push(field);
                    } break;
                    case 'wildcard': {
                        wildcard = field;
                    } break;
                    default: throw field;
                    }
                });
                var restKeySet = new Set(Object.keys(value));
                plainFields.forEach(function (field) {
                    var key = field.match.name;
                    var rtype = field.rtype;
                    var item = value[key];
                    var currentContext = context.concat(key);
                    var result = self.check(rtype, item, currentContext);
                    restKeySet.delete(key);
                    if (!result) allIsWell = false;
                });
                if (wildcard) {
                    var rtype = wildcard.rtype;
                    Array.from(restKeySet).forEach(function (key) {
                        var item = value[key];
                        var currentContext = context.concat(key);
                        var result = self.check(rtype, item, currentContext);
                        if (!result) allIsWell = false;
                    });
                }
            } else {
                allIsWell = false;
            }
            return allIsWell;
        };
    } break;
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
        'any': isAnything,
        'void': isUndefined,
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
    function isAnything(value, context) {
        var result = value !== undefined;
        if (!result)
            throws(value, context, '{{context}} is undefined');
        return result;
    }
    function isUndefined(value, context) {
        var result = value === undefined;
        if (!result)
            throws(value, context, '{{context}} is not undefined');
        return result;
    }
    function isNull(value, context) {
        var result = value === null;
        if (!result)
            throws(value, context, '{{context}} is not null');
        return result;
    }
    function isNumber(value, context) {
        var result = typeof value === 'number';
        if (!result)
            throws(value, context, '{{context}} is not number');
        return result;
    }
    function isString(value, context) {
        var result = typeof value === 'string';
        if (!result)
            throws(value, context, '{{context}} is not string');
        return result;
    }
    function isBoolean(value, context) {
        var result = typeof value === 'boolean';
        if (!result)
            throws(value, context, '{{context}} is not boolean');
        return result;
    }
    function isObject(value, context) {
        var result = (typeof value === 'object') && !Array.isArray(value);
        if (!result)
            throws(value, context, '{{context}} is not object');
        return result;
    }
    function isArray(value, context) {
        var result = Array.isArray(value);
        if (!result)
            throws(value, context, '{{context}} is not array');
        return result;
    }
}
