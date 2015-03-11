var parser = require('./parser');
var Schema = require('./schema');

if (require.main === module) {
    var fs = require('fs');
    // var code = fs.readFileSync('./ast.makise', {encoding: 'utf8'});
    var code = 'this is integer \n integer is number \n integer[this % 1 = 0] throws "{{context}} is not integer"';
    var ast = parser.parse(code);
    parser.printTokens(code);
    console.log(JSON.stringify(ast, undefined, 2));
}

module.exports = {
    parser: parser,
    Schema: Schema,
    schemaFromCode: function (code) {
        var ast = parser.parse(code);
        return new Schema(ast);
    }
};
