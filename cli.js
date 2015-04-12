#!/usr/bin/env node

process.title = 'makise';

var nomnom = require('nomnom');
nomnom.script('makise');
nomnom.options({
    schema: {
        required: true,
        position: 0,
        list: true,
        help: 'makise schema definitions'
    },
    target: {
        required: true,
        position: 1,
        help: 'json file'
    },
    help: {
        abbr: 'h',
        flag: true,
        help: 'print this message'
    }
});
var opts = nomnom.parse();
var target = opts.target;
var schemaList = opts.schema;


var fs = require('fs');
var path = require('path');

function file(filePath) {
    try {
        var fullPath = path.resolve(filePath);
        var content = fs.readFileSync(fullPath, { encoding: 'utf8' });
    } catch (e) {
        switch (e.errno) {
        case 34:
            console.error(fullPath + ': no such file or directory');
            process.exit(-2);
            break;
        default:
            console.error(e.message);
            process.exit(-1);
            break;
        }
    }
    return content;
}

var makise = require('./index');

var schema = makise.schemaFromCode(schemaList.map(function (schemaPath) {
    return file(schemaPath);
}).join('\n'));

schema.validate(JSON.parse(file(target)));

schema.errorList.forEach(function (error) {
    console.error(error.toString());
});

process.exit(schema.errorList.length);
