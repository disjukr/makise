var fs = require('fs');
// var code = fs.readFileSync('./ast.makise', {encoding: 'utf8'});
var code = 'this is {a: number, b: number = 1, c = 1, *: number}';

var parser = require('./parser');
var ast = parser.parse(code);
parser.printTokens(code);
console.log(JSON.stringify(ast, undefined, 2));
