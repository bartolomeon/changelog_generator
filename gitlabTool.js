let _ = require('underscore')
let BPromise = require('bluebird')

let config = require('./config.json')

let sh = require('shelljs')
sh.config.silent = true


let separator = '|';
let idRefPatternStr = '#[0-9]+';
let idRefPattern = new RegExp(idRefPatternStr);


let getFullLog = function(fromTag, tillTag) {
  fromTag = fromTag || '';
  tillTag = tillTag || 'HEAD'

  return new BPromise(function(resolve, reject) {
    sh.cd('/home/bartek/work/C4C/c4c_soft');
    let result = sh.exec('git log --pretty="%h '+separator+' %s" '+fromTag+'..'+tillTag+' | head -n 100', function(status, output) {
      if (result.status) { //0 != failure
        reject(new Error(output));
      } else {
        let lines = output.split('\n');
        resolve(lines)
      }
    });
  });
}

let splitIntoFields = function(line) {
  let arr = line.split(separator);
  let descrWithIdRef = arr[1];
  let idRef = idRefPattern.exec(descrWithIdRef);

  //descrWithIdRef.replace(idRef, ''); //FIXME (or not) remove the id from description

  let result = {
    commitId : arr[0].trim(),
    redmineIdRef : idRef[0].trim(),
    description: descrWithIdRef.trim()
  }
  return result;

}

let processLogLines = function(lines) {
  let regExp = new RegExp("^.* \\"+separator+" "+idRefPatternStr+":?\\s+");
  let entries = _.filter(lines, line => {
    let testResult = regExp.test(line);
    return testResult;
  }).map(line => splitIntoFields(line));

  return entries;
}



module.exports = {
  processLogLines : processLogLines,
  getFullLog : getFullLog
}

