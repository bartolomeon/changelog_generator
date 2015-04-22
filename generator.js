//module deps
var rest = require('rest')
var restBasicAuth = require('rest/interceptor/basicAuth')
var _ = require('underscore')
var BPromise = require('bluebird')
var config = require('./config.json')

var gitlabTool = require('./gitlabTool.js')

var log4js = require('log4js');
var logger = log4js.getLogger();


var redmineTools = {
  queryForTicketInfo : function(ticketId) {
    var id = ticketId.replace('#','');
    var client = rest.wrap(restBasicAuth, config.redmine.credentials);
    var promise = client({
      path: config.redmine.url + '/issues/'+id+'.json',
      params : {}
    });
    return promise;
  },



  findDescriptionForTicket : function(ticketId) {

    //logger.debug("querrying for ticket: "+ticketId);
    return this.queryForTicketInfo(ticketId)
    .then(function(rmDescr) {
      var entity = JSON.parse(rmDescr.entity);

      var issue = entity.issue;
      var prio   = issue.priority.name;
      var status = issue.status.name;
      var project = issue.project.name;
      var category = _.filter(issue.custom_fields, function(field) { return field.name === 'Kategoria'}).value;

      var descr = {
        priority :  prio,
        status : status,
        project : project,
        category: category 
      };
      //logger.debug('REDMINE SAYS: ' + JSON.stringify(descr));
      return descr;
    });

  }

}


gitlabTool.getFullLog()
.then(gitlabTool.processLogLines)
.then(function(logLines) {

  var id2gitMap = _.groupBy(logLines, 'redmineIdRef');

  return _.map(id2gitMap, function(gitEntries, ticketId){
    return redmineTools.findDescriptionForTicket(ticketId)
    .then(function(ticket) {
      var resultEntry = {};
      resultEntry[ticketId] = {
        redmine: ticket,
        git: gitEntries
      }
      return resultEntry;
    })
  })
}).all(function(entry) {
  return entry
}).then(function(changelog) {
  console.log(JSON.stringify(changelog)); 

});

module.exports={ redmineTools : redmineTools, gitlabTools : gitlabTool }
