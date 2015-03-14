require('es6-shim');

module.exports = Schema;
function Schema(ast) {
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

Schema.prototype.validate = function validate(value) {
    var self = this;
    self.checkedMap.clear();
    while (self.errorList.pop());
    self.checkers = getBuiltInCheckers(self);
    self.defs.forEach(function (def) {
        switch (def.type) {
        case 'a_is_b': {
            var ltype = def.ltype;
            var rtype = self.rtype(def.rtype);
        } break;
        case 'a_throws_b': {
            var ltype = def.ltype;
            var rtype = self.error(def.message);
        } break;
        default: throw def;
        }
        switch (ltype.type) {
        case 'identifier': {
            var checkerName = ltype.name;
            self.checkers[checkerName] = rtype;
        } break;
        case 'check_more': {
            if (ltype.ltype && ltype.ltype.type === 'identifier')
                var checker = self.checkers[ltype.ltype.name];
            else
                throw ltype.ltype;
            if (checker) {
                checker.checkList = checker.checkList || [];
                checker.checkList.push(function more(value, context) {
                    if (self.eval(ltype.condition, value)) {
                        return self.check(rtype, value, context);
                    }
                    return true;
                });
            } else {
                throw ltype;
            }
        } break;
        default: throw ltype;
        }
    });
    return self.check(self.checkers['this'], value, []);
};

Schema.prototype.eval = function eval(expression, context) {
    var self = this;
    switch (expression.type) {
    case 'value': {
        return expression.value;
    } break;
    case 'identifier': {
        var member = context[expression.name];
        if (member === undefined && expression.name === 'this')
            return context;
        return member;
    } break;
    case '=': {
        return self.eval(expression.lhs, context) == self.eval(expression.rhs, context);
    } break;
    case '<': {
        return self.eval(expression.lhs, context) < self.eval(expression.rhs, context);
    } break;
    case '>': {
        return self.eval(expression.lhs, context) > self.eval(expression.rhs, context);
    } break;
    case '<=': {
        return self.eval(expression.lhs, context) <= self.eval(expression.rhs, context);
    } break;
    case '>=': {
        return self.eval(expression.lhs, context) >= self.eval(expression.rhs, context);
    } break;
    default: throw expression;
    }
};

Schema.prototype.throws = function throws(value, context, message) {
    var self = this;
    self.errorList.push(new ValidationError(value, context, message));
}
Schema.prototype.check = function check(checker, value, context) {
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
    var allIsWell = checker(value, context);
    if (allIsWell) {
        checker.checkList = checker.checkList || [];
        checker.checkList.forEach(function (moreChecker) {
            var result = moreChecker(value, context);
            if (!result) allIsWell = false;
        });
    }
    resultMap.set(checker, allIsWell);
    return allIsWell;
}

Schema.prototype.rtype = function rtype(rtypeNode) {
    var self = this;
    var throws = self.throws.bind(self);
    switch (rtypeNode.type) {
    case 'identifier': {
        return function checkerReference(value, context) {
            var rtype = self.checkers[rtypeNode.name];
            return rtype(value, context);
        };
    } break;
    case 'enum': {
        var items = rtypeNode.items;
        return function enumChecker(value, context) {
            var result = items.indexOf(value) > -1;
            if (!result) {
                var itemsString = items.map(function (item) {
                    return JSON.stringify(item);
                }).join(', ');
                throws(value, context, '{{context}} should be one of ' + itemsString + '. but {{value}}');
            }
            return result;
        };
    } break;
    case 'tuple': {
        var rtypes = rtypeNode.items.map(function (item) {
            return self.rtype(item);
        });
        return function tupleChecker(value, context) {
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
        var rtypes = rtypeNode.items.map(function (item) {
            return self.rtype(item);
        });
        return function patternChecker(value, context) {
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
        var fields = rtypeNode.fields.map(function (field) {
            var replica = Object.create(field);
            replica.rtype = self.rtype(replica.rtype);
            return replica;
        });
        return function objectChecker(value, context) {
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
    case 'or': {
        var rtypeA = self.rtype(rtypeNode.lhs);
        var rtypeB = self.rtype(rtypeNode.rhs);
        return function orChecker(value, context) {
            var errorList = self.errorList;
            self.errorList = [];
            var resultA = self.check(rtypeA, value, context);
            var resultB = self.check(rtypeB, value, context);
            var result = resultA || resultB;
            if (!result) errorList = errorList.concat(self.errorList);
            self.errorList = errorList;
            return result;
        };
    } break;
    case 'and': {
        var rtypeA = self.rtype(rtypeNode.lhs);
        var rtypeB = self.rtype(rtypeNode.rhs);
        return function andChecker(value, context) {
            var resultA = self.check(rtypeA, value, context);
            var resultB = self.check(rtypeB, value, context);
            var result = resultA && resultB;
            return result;
        };
    } break;
    default: throw rtypeNode;
    }
}

Schema.prototype.error = function error(message) {
    var self = this;
    return function customError(value, context) {
        self.throws(value, context, message);
        return false;
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
