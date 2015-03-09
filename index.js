var fs = require('fs');
// var code = fs.readFileSync('./ast.makise', {encoding: 'utf8'});
var code = 'this is integer \n integer is number \n integer[this % 1 = 0] throws "{{context}} is not integer"';

var parser = require('./parser');
var ast = parser.parse(code);
parser.printTokens(code);
console.log(JSON.stringify(ast, undefined, 2));
