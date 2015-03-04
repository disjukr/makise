require('es6-shim');

var fs = require('fs');
// var code = fs.readFileSync('./ast.makise', {encoding: 'utf8'});
var code = 'this is [number, string, boolean]';

var parser = require('./parser');
var ast = parser.parse(code);
parser.printTokens(code);
console.log(JSON.stringify(ast, undefined, 2));
