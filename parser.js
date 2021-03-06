var syntax = {
    lex: {
        options: {
            backtrack_lexer: true
        },

        rules: [
            ['\\s+', ''],
            ['\\/\\*([^*]|[\\r\\n]|(\\*+([^*/]|[\\r\\n])))*\\*+\\/', ''],
            ['(?:\\/\\/|#).*(?=\\r\\n|\\n|$)', ''],
            ['\\/(?:\\[(?:[^\\\\\\]]|\\\\.)*\\]|[^\\\\/]|\\\\.)*\\/[gimuy]*', 'if (yy.regexable) { yy.regexable = false; return "REGEX" } else this.reject();'],
            ['-?\\d*\\.?\\d+(?:[Ee](?:[+-]?\\d+)?)?', 'yy.regexable = false; return "NUMBER"'],
            ['\"([^\\\\\"]|\\\\.)*\"|\'([^\\\\\']|\\\\.)*\'', 'yy.regexable = false; return "STRING"'],
            ['\\b(true|false)\\b', 'yy.regexable = false; return "BOOLEAN"'],
            ['\\b(null)\\b', 'yy.regexable = false; return "NULL"'],
            ['\\b(is)\\b', 'yy.regexable = true; return "IS"'],
            ['\\b(and)\\b', 'yy.regexable = true; return "AND"'],
            ['\\b(or)\\b', 'yy.regexable = true; return "OR"'],
            ['\\b(not)\\b', 'yy.regexable = true; return "NOT"'],
            ['\\b(throws)\\b', 'yy.regexable = false; return "THROWS"'],
            ['[_a-zA-Z][_a-zA-Z0-9]*', 'yy.regexable = false; return "IDENTIFIER"'],
            ['\\?', 'yy.regexable = true; return "?"'],
            ['\\*', 'yy.regexable = true; return "*"'],
            ['\\/', 'yy.regexable = true; return "/"'],
            ['%', 'yy.regexable = true; return "%"'],
            ['\\+', 'yy.regexable = true; return "+"'],
            ['-', 'yy.regexable = true; return "-"'],
            ['<=', 'yy.regexable = true; return "<="'],
            ['>=', 'yy.regexable = true; return ">="'],
            ['<', 'yy.regexable = true; return "<"'],
            ['>', 'yy.regexable = true; return ">"'],
            ['\\(', 'yy.regexable = true; return "("'],
            ['\\)', 'yy.regexable = false; return ")"'],
            ['\\{', 'yy.regexable = true; return "{"'],
            ['\\}', 'yy.regexable = false; return "}"'],
            ['\\[', 'yy.regexable = true; return "["'],
            ['\\]', 'yy.regexable = false; return "]"'],
            ['=', 'yy.regexable = true; return "="'],
            [':', 'yy.regexable = true; return ":"'],
            [',', 'yy.regexable = true; return ","'],
            ['\\.\\.\\.', 'yy.regexable = false; return "..."'],
            ['\\.', 'yy.regexable = false; return "."']
        ]
    },
    start: 'ast',
    bnf: {
        ast: [['defs', 'return $1']],
        def: [
            ['a_is_b', '$$ = $1'],
            ['a_throws_b', '$$ = $1']
        ],
        defs: [
            ['def', '$$ = [$1]'],
            ['defs def', '$1.push($2); $$ = $1']
        ],
        a_is_b: [['ltype IS rtype', '$$ = {type: "a_is_b", ltype: $1, rtype: $3}']],
        a_throws_b: [['ltype THROWS STRING', '$$ = {type: "a_throws_b", ltype: $1, message: eval($3)}']],
        ltype: [
            ['primary_ltype', '$$ = $1'],
            ['primary_ltype [ expression ]', '$$ = {type: "conditional", ltype: $1, condition: $3}']
        ],
        primary_ltype: [
            ['IDENTIFIER', '$$ = {type: "identifier", name: $1}'],
        ],
        rtype: [['rtype_or', '$$ = $1']],
        primary_rtype: [
            ['NULL', '$$ = {type: "identifier", name: "null"}'],
            ['IDENTIFIER', '$$ = {type: "identifier", name: $1}'],
            ['*', '$$ = {type: "identifier", name: "*"}'],
            ['REGEX', [
                '$$ = { type: "regex", regex: (function () {',
                    'var m = $1.match(/^\\/(.+)\\/([gimuy]*)$/);',
                    'return {body: m[1], flags: m[2]}',
                '})() }'
            ].join('')],
            ['rtype_vector', '$$ = $1'],
            ['rtype_enum', '$$ = $1'],
            ['rtype_object', '$$ = $1'],
            ['IDENTIFIER ?', 'if ($1 === "any") console.warn("Syntax Warning: just use `any` instead of `any?`."); $$ = {type: "or", lhs: {type: "identifier", name: $1}, rhs: {type: "or", lhs: {type: "identifier", name: "null"}, rhs: {type: "identifier", name: "void"}}}']
        ],
        rtype_and: [
            ['primary_rtype', '$$ = $1'],
            ['rtype_and AND primary_rtype', '$$ = {type: "and", lhs: $1, rhs: $3}']
        ],
        rtype_or: [
            ['rtype_and', '$$ = $1'],
            ['rtype_or OR rtype_and', '$$ = {type: "or", lhs: $1, rhs: $3}']
        ],
        rtype_vector: [
            ['[ rtypes ]', '$$ = {type: "tuple", items: $2}'],
            ['[ rtypes , ]', '$$ = {type: "tuple", items: $2}'],
            ['[ rtypes , ... ]', '$$ = {type: "pattern", items: $2}']
        ],
        rtypes: [
            ['rtype', '$$ = [$1]'],
            ['rtypes , rtype', '$1.push($3); $$ = $1']
        ],
        rtype_enum: [
            ['( values )', '$$ = {type: "enum", items: $2}'],
            ['( values , )', '$$ = {type: "enum", items: $2}']
        ],
        values: [
            ['value', '$$ = [$1]'],
            ['values , value', '$1.push($3); $$ = $1']
        ],
        value: [
            ['NULL', '$$ = null'],
            ['NUMBER', '$$ = eval($1)'],
            ['STRING', '$$ = eval($1)'],
            ['BOOLEAN', '$$ = eval($1)'],
            ['value_array', '$$ = $1'],
            ['value_object', '$$ = $1']
        ],
        value_array: [
            ['[ values ]', '$$ = $2'],
            ['[ values , ]', '$$ = $2']
        ],
        value_object: [
            ['{ key_value_pairs }', [
                '$$ = {};',
                '$2.forEach(function (pair) {',
                    '$$[pair.key] = pair.value;',
                '}.bind(this));'
            ].join('')],
            ['{ key_value_pairs , }', [
                '$$ = {};',
                '$2.forEach(function (pair) {',
                    '$$[pair.key] = pair.value;',
                '}.bind(this));'
            ].join('')]
        ],
        key_value_pairs: [
            ['key_value_pair', '$$ = [$1]'],
            ['key_value_pairs , key_value_pair', '$1.push($3); $$ = $1']
        ],
        key_value_pair: [['key : value', '$$ = {key: $1, value: $3}']],
        key: [
            ['IDENTIFIER', '$$ = $1'],
            ['STRING', '$$ = eval($1)']
        ],
        rtype_object: [
            ['{ fields }', '$$ = {type: "object", fields: $2};'],
            ['{ fields , }', '$$ = {type: "object", fields: $2};']
        ],
        fields: [
            ['field', '$$ = [$1]'],
            ['fields , field', '$1.push($3); $$ = $1']
        ],
        field: [
            ['field_match : rtype', '$$ = {match: $1, rtype: $3}'],
            ['field_match = value', '$$ = {match: $1, default: $3}'],
            ['field_match : rtype = value', '$$ = {match: $1, rtype: $3, default: $5}']
        ],
        field_match: [
            ['IDENTIFIER', '$$ = {type: "plain", name: $1}'],
            ['STRING', '$$ = {type: "plain", name: eval($1)}'],
            ['*', '$$ = {type: "wildcard"}']
        ],
        expression: [['or_expression', '$$ = $1']],
        primary_expression: [
            ['IDENTIFIER', '$$ = {type: "identifier", name: $1}'],
            ['value', '$$ = {type: "value", value: $1}'],
            ['( expression )', '$$ = $2'],
        ],
        exists_expression: [
            ['primary_expression', '$$ = $1'],
            [
                'exists_expression ?',
                '$$ = {type: "?", lhs: $1}'
            ]
        ],
        access_expression: [
            ['exists_expression', '$$ = $1'],
            [
                'access_expression . IDENTIFIER',
                '$$ = {type: "access", expression: $1, key: $3}'
            ],
            [
                'access_expression [ STRING ]',
                '$$ = {type: "access", expression: $1, key: eval($3)}'
            ]
        ],
        multiplicative_expression: [
            ['access_expression', '$$ = $1'],
            [
                'multiplicative_expression * access_expression',
                '$$ = {type: "*", lhs: $1, rhs: $3}'
            ],
            [
                'multiplicative_expression / access_expression',
                '$$ = {type: "/", lhs: $1, rhs: $3}'
            ],
            [
                'multiplicative_expression % access_expression',
                '$$ = {type: "%", lhs: $1, rhs: $3}'
            ]
        ],
        additive_expression: [
            ['multiplicative_expression', '$$ = $1'],
            [
                'additive_expression + multiplicative_expression',
                '$$ = {type: "+", lhs: $1, rhs: $3}'
            ],
            [
                'additive_expression - multiplicative_expression',
                '$$ = {type: "-", lhs: $1, rhs: $3}'
            ]
        ],
        relational_expression: [
            ['additive_expression', '$$ = $1'],
            [
                'relational_expression < additive_expression',
                '$$ = {type: "<", lhs: $1, rhs: $3}'
            ],
            [
                'relational_expression > additive_expression',
                '$$ = {type: ">", lhs: $1, rhs: $3}'
            ],
            [
                'relational_expression <= additive_expression',
                '$$ = {type: "<=", lhs: $1, rhs: $3}'
            ],
            [
                'relational_expression >= additive_expression',
                '$$ = {type: ">=", lhs: $1, rhs: $3}'
            ]
        ],
        equality_expression: [
            ['relational_expression', '$$ = $1'],
            [
                'equality_expression = relational_expression',
                '$$ = {type: "=", lhs: $1, rhs: $3}'
            ]
        ],
        not_expression: [
            ['equality_expression', '$$ = $1'],
            [
                'NOT equality_expression',
                '$$ = {type: "not", rhs: $2}'
            ]
        ],
        and_expression: [
            ['not_expression', '$$ = $1'],
            [
                'and_expression AND not_expression',
                '$$ = {type: "and", lhs: $1, rhs: $3}'
            ]
        ],
        or_expression: [
            ['and_expression', '$$ = $1'],
            [
                'or_expression OR and_expression',
                '$$ = {type: "or", lhs: $1, rhs: $3}'
            ]
        ]
    }
};
var jisonLex = require('jison-lex');
var jison = require('jison');
var lexer = new jisonLex(syntax.lex);
var parser = new jison.Parser(syntax);
parser.yy = function () {
    return {
        regexable: false
    };
};

function pad(str, len) {
    if (str.length < len) {
        return str + (new Array(1 + len - str.length)).join(' ');
    }
    return str;
}

module.exports.printTokens = function (code) {
    lexer.setInput(code);
    var result = [];
    var token = lexer.lex();
    while (token !== lexer.EOF) {
        console.log(pad(token, 15) + ': ' + lexer.yytext);
        token = lexer.lex();
    }
    return result;
};

module.exports.parse = function (code) {
    return parser.parse(code);
};
