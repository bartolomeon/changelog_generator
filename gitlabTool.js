var _ = require('underscore')
var BPromise = require('bluebird')
var log4js = require('log4js');
var logger = log4js.getLogger();

var config = require('./config.json')

var sh = require('shelljs')
sh.config.silent = true


var separator = '|';
var idRefPatternStr = '#[0-9]+';
var idRefPattern = new RegExp(idRefPatternStr);


var getFullLog = function() {
  return new BPromise(function(resolve, reject) {
    sh.cd('/home/bartek/work/C4C/c4c_soft');
    var result = sh.exec('git log --pretty="%h '+separator+' %s" | head -n 100', function(status, output) {
      if (result.status) { //0 != failure
        reject(new Error(output));
      } else {
        var lines = output.split('\n');
        resolve(lines)
      }
    });
  });
}

var splitIntoFields = function(line) {
  //logger.debug("splitting line: " + line);
  var arr = line.split(separator);
  var descrWithIdRef = arr[1];
  var idRef = idRefPattern.exec(descrWithIdRef);

  //descrWithIdRef.replace(idRef, ''); //FIXME (or not) remove the id from description

  var result = {
    commitId : arr[0].trim(),
    redmineIdRef : idRef[0].trim(),
    description: descrWithIdRef.trim()
  }
  //logger.error(result);
  return result;

}

var processLogLines = function(lines) {
  //logger.debug("pattern: " + idRefPattern);
  //logger.debug("separator: " + separator);
  //logger.debug("LINES: ", lines);
  var regExp = new RegExp("^.* \\"+separator+" "+idRefPatternStr+":?\\s+");
  //logger.debug("regexp: " + regExp);
  var entries = _.filter(lines, function(line) {
    var testResult = regExp.test(line);
    //logger.debug("TEST: " + testResult +"   | line: " + line);
    return testResult;
  }).map(function(line) {
    return splitIntoFields(line)
  });

  return entries;
}




module.exports = {
  processLogLines : processLogLines,
  getFullLog : getFullLog
}

