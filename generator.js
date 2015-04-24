//module deps
let rest = require('rest')
let restBasicAuth = require('rest/interceptor/basicAuth')
let _ = require('underscore')
let BPromise = require('bluebird')
let moment = require('moment-timezone');

let config = require('./config.json')
let gitlabTool = require('./gitlabTool.js')

let program = require('commander');
program
.version('0.0.1')
.option('-f, --format <type>', 'Output format (default: json)', ['json', 'html'])
.option('-r, --range <start>..<end>', 'Range between 2 tags in git', val => val.split('..'))
.parse(process.argv);

let redmineTools = {
  queryForTicketInfo : function(ticketId) {
    let id = ticketId.replace('#','');
    let client = rest.wrap(restBasicAuth, config.redmine.credentials);
    let promise = client({
      path: config.redmine.url + '/issues/'+id+'.json',
      params : {}
    });
    return promise;
  },


  findDescriptionForTicket : function(ticketId) {
    return this.queryForTicketInfo(ticketId)
    .then(function(rmDescr) {

      let entity;
      if (!rmDescr.entity.trim()) {
        entity = { issue : {
          priority : {name: '???'},
          status : { name : '???'},
          project : { name : '???'},
          tracker : { name : '???' },
          closed_on : '',
          subject : '<Missing entry in Redmine>'}
        };
      } else {
        entity = JSON.parse(rmDescr.entity);
      }

      let issue = entity.issue;
      let prio   = issue.priority.name;
      let status = issue.status.name;
      let project = issue.project.name;
      let subject = issue.subject;
      let type = issue.tracker.name;
      let closedOn = issue.closed_on;

      let category = _.chain(issue.custom_fields)
      .filter(field => field.name === 'Kategoria')
      .first()
      .value();


      if (!category) {
        category = '---';
      } else {
        category = category.value
      }

      let descr = {
        id : ticketId.replace('#',''),
        subject : subject,
        priority :  prio,
        status : status,
        project : project,
        category: category,
        type : type,
        closed_on : moment(closedOn)
      };
      return descr;
    });
  }
}



let combineLogs = function(logLines) {

  let id2gitMap = _.groupBy(logLines, 'redmineIdRef');

  return _.map(id2gitMap, function(gitEntries, ticketId){
    return redmineTools.findDescriptionForTicket(ticketId)
    .then(function(ticket) {
      ticket.git = gitEntries;
      return ticket;
    })
  })
}

let formatToHtml = function(changelog, fromTag, tillTag) {

  var gitEntryTemplate =
    _.template("<li><a href=<%- commitId %><%- commitId %></a><%- description %></li>");

  let redmineEntry =
    _.template("<h2>#<%- id %> - <%- subject %></h2>"  );
  /*
     + "<ul> <% _.each(git, gitEntry => { "
     + "    let gitData = gitEntryTemplate(gitEntry)) %> "
     + "<% - gitData %> "
     + "<% } %> </ul> ");
     */


  let rmEntries = _.template(
    "<!DOCTYPE html> <html lang=\"pl\"> <head> <meta charset=\"utf-8\" /> <title>Changelog</title>"
    +"<link href=\"https://redmine.c4c.sprint.pl/themes/alternate/stylesheets/application.css?1413918791\" media=\"all\" rel=\"stylesheet\" type=\"text/css\" />" 
    +" <div id=\"header\">"
    +"<h1>Changelog dla zakresu od <%- fromTag %> do <%- tillTag %></h1> "
    +"</div>"
    +"<ul><% _.each(log, rmEntry => { %>"
    +"  <h2><img src=\"https://redmine.c4c.sprint.pl/images/<% print(rmEntry.status === 'Wykonane' ? 'toggle_check.png' : 'exclamation.png') %>\" title=\"<%- rmEntry.status %>\"></img> <a href=\"https://redmine.c4c.sprint.pl/issues/<%- rmEntry.id.replace('#','') %>\">#<%- rmEntry.id %> [<%- rmEntry.project %> / <%- rmEntry.category %> / <%- rmEntry.type %>] - <%- rmEntry.subject %></a></h2>"
    +"  <ul><% _.each(rmEntry.git, gitEntry => {  %> "
    +"      <li><a href=\"https://gitlab.c4c.sprint.pl/c4c_dev/c4c_soft/commit/<%- gitEntry.commitId %>\"> <%- gitEntry.commitId %></a><%- gitEntry.description.replace(/^#?[0-9]+/,'') %></li>"
    +"    <% }) %>"
    +"  </ul> <% }) %>"
    +"</ul>");

    //return _.map(changelog, entry => redmineEntry(entry) );

    return rmEntries({ log : changelog, fromTag : fromTag, tillTag : tillTag });

}

let fromTag = program.range[0];
let tillTag = program.range[1];

gitlabTool.getFullLog(fromTag, tillTag)
.then(gitlabTool.processLogLines)
.then(combineLogs)
.all(entry => entry)
.then(logs => _.sortBy(logs, 'closed_on'))
.then(function(changelog) {
  if (program.format === 'html') {
    console.log( formatToHtml( changelog, fromTag, tillTag ));
  } else {
    console.log(JSON.stringify(changelog)); 
  }
}).catch(error => {
  console.error( "ERROR: "+error );
  process.exit(1)
});

module.exports={ redmineTools : redmineTools, gitlabTools : gitlabTool }
