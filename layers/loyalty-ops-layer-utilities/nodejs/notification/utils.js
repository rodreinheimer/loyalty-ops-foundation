const utils = require('/opt/nodejs/common/utils');

module.exports = {
    /**
     * @author reinhed
     * @desc Prepare email options
     * @returns Returns email options
     */
    getMailOptions: async function(template, csvContent, report, csvFileName) {

        let ses = report.ses;
        let subject = await utils.replaceKeywords(ses.subject, report);
        let mailOptions = {
            from: ses.from,
            subject: subject,
            html: template,
            to: ses.to
        };
        //If include report as attachment
        if (JSON.stringify(ses.delivery).includes('attachment')){
            var attachments = [
                        {
                            filename: csvFileName,
                            contentType: 'text/csv',
                            content: Buffer.from(csvContent, "utf-8")
                        }
                    ]
            mailOptions["attachments"] = attachments;
        }
        return mailOptions;
    },
    /**
     * @author reinhed
     * @desc Uploads slack notification
     * @returns Returns upload result
     */
    notifySlack: async function(report, csvContent, csvFileName, client, WebClient, LogLevel) {
        let result;
        if(!utils.isNullOrEmptyValue(csvContent)){
            let slack = report.slack;
            let secretName = slack.secret;
            let secret = await client.getSecretValue({'SecretId': secretName}).promise();
            let webClient = new WebClient(JSON.parse(secret.SecretString).TOKEN, {
                logLevel: LogLevel.DEBUG
            });
            let text = await utils.replaceKeywords(slack.subject, report);
            result = await webClient.files.upload({
                channels: slack.channelId,
                initial_comment: text,
                name: csvFileName,
                title: csvFileName,
                minetype: "text/csv",
                file: Buffer.from(csvContent, "utf-8")
            });
        } else {
            console.log("<< WARNING >> Report file is undefine, will skip posting to slack " + error);
        }
        return result;
    }, 
     /**
     * @author reinhed
     * @desc Uploads teams notification
     * @returns Returns upload result
     */
     notifyTeams: async function(report, csvContent, csvFileName, secretStore, axios, template) {
        let result;
        if(!utils.isNullOrEmptyValue(csvContent)){
            let teams = report.teams;
            let secretName = teams.teams_webhook_url;
            let teamsWebhookUrl = secretStore[secretName];
            //let card = report.teams.card;
            let card = {
                "type": "message",
                "attachments": [
                    {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "TextBlock",
                                "size": "Medium",
                                "weight": "Bolder",
                                "text": "Health Check for Critical Workflows"
                            },
                            {
                                "type": "TextBlock",
                                "text": "<at>Developer</at>, Foo Blaa",
                                "color": "attention",
                                "wrap": true
                            },
                            {
                                "type": "Table",
                                "gridStyle": "accent",
                                "firstRowAsHeaders": true,
                                "columns": [
                                    {
                                        "width": 1
                                    },
                                    {
                                        "width": 1
                                    }
                                ],
                                "rows": [
                                    {
                                        "type": "TableRow",
                                        "cells": [
                                            {
                                                "type": "TableCell",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "Name",
                                                        "wrap": true,
                                                        "weight": "Bolder"
                                                    }
                                                ]
                                            },
                                            {
                                                "type": "TableCell",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "Type",
                                                        "wrap": true,
                                                        "weight": "Bolder"
                                                    }
                                                ]
                                            }
                                        ],
                                        "style": "accent"
                                    },
                                    {
                                        "type": "TableRow",
                                        "cells": [
                                            {
                                                "type": "TableCell",
                                                "style": "good",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "columns",
                                                        "wrap": true
                                                    }
                                                ]
                                            },
                                            {
                                                "type": "TableCell",
                                                "style": "warning",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "ColumnDefinition[]",
                                                        "wrap": true
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        "type": "TableRow",
                                        "cells": [
                                            {
                                                "type": "TableCell",
                                                "style": "good",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "rows",
                                                        "wrap": true
                                                    }
                                                ]
                                            },
                                            {
                                                "type": "TableCell",
                                                "style": "accent",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "TableRow[]",
                                                        "wrap": true
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "version": "1.5",
                        "msteams": {
                            "width": "full",
                            "entities": [
                                {
                                    "type": "mention",
                                    "text": "<at>Developer</at>",
                                    "mentioned": {
                                      "id": "some ID",
                                      "name": "Developer"
                                    }
                                  }
                            ]
                        }
                    }
                }]
            };
            result = await axios.post(teamsWebhookUrl, card, {
                headers: {
                  'content-type': 'application/vnd.microsoft.teams.card.o365connector'
                },
            });
            if(result.status !== 200) {
                throw `Unable to post to teams ${response.status} - ${response.statusText}`;
            }
        } else {
            console.log("<< WARNING >> Report file is undefined, will skip posting to teams " + error);
        }
        return result;
    },
   /**
    * @author reinhed
    * @desc Loads and initialize handlebar template
    * @returns Returns template
    */
   getTemplateOrig: async function(handlebars, fs, report) {
        let data = {};
        let html = await fs.readFile("/opt/nodejs/" + report.ses.template, { encoding: 'utf-8' });
        const template = handlebars.compile(html);
        if(JSON.stringify(report.ses.delivery).includes('html'))
        {
            data.records = report.result.records;
        }
        data.headers = report.result.headers;
        data.body = await utils.replaceKeywords(report.ses.body, report);
        return template({report: data});
    }, 
    getTemplate: async function(handlebars, fs, report) {
        let data = {};
        let html = await fs.readFile("/opt/nodejs/" + report.ses.template, { encoding: 'utf-8' });
        const template = handlebars.compile(html);
        if(JSON.stringify(report.ses.delivery).includes('html'))
        {
            for(var i = 0; i < report.results.inlineReports.length; i++)
            {
                let nameOfElementWithRecords = report.results.inlineReports[i];
                let records = report.results[nameOfElementWithRecords].records;
                let headers = report.results[nameOfElementWithRecords].headers;
                data[nameOfElementWithRecords + "_records"] = records;
                data[nameOfElementWithRecords + "_headers"] = headers;
            }
        }
        data.body = await utils.replaceKeywords(report.ses.body, report);
        return template({report: data});
    },
    /**
    * @author reinhed
    * @desc If has records, generate CSV content
    * @returns Returns csv
    */
    generateCSV: async (reportDataResults) => {
        let result;
        if( reportDataResults.records.length > 0) {
            result = reportDataResults.headers + "\r\n";
            for(var i = 0; i < reportDataResults.records.length; i++)
            {
                result += reportDataResults.records[i] + "\r\n";
            }
        }
        return result;
     },
     generateCSVFromJson: async (reportDataResults) => {
        let result = '';
        if( reportDataResults.records.length > 0) {
            result = reportDataResults.headers + "\r\n";
            for(var i = 0; i < reportDataResults.records.length; i++)
            {
                let value = '';
                for (var key in reportDataResults.records[i]){
                    if(key !== "_id") {
                        value += reportDataResults.records[i][key] + ',';
                    }
                }
                result += value.substring(0,value.length-1) + "\r\n";
            }
        }
        return result;
     }
}