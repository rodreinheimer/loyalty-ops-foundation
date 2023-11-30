const aws = require('aws-sdk');
const s3 = new aws.S3();
const ses = new aws.SES();
const nodemailer = require('nodemailer');
const utils = require('/opt/nodejs/common/utils');
const notifyUtils = require('/opt/nodejs/notification/utils');
const { WebClient, LogLevel } = require("@slack/web-api");
const handlebars = require('handlebars');
const fs = require('fs-extra');
const axios = require('axios');

var smClient = new aws.SecretsManager({
  region: process.env.region
});

exports.handler = async function (event, context) {
  console.log("report notify run start");

  //Fail Job if any of the required properties are missing
  if (utils.isNullOrEmptyValue(process.env.SKX_ENV) ||
    utils.isNullOrEmptyValue(process.env.SKX_CONFIG_LAYER_ROOT)) {
    console.error(utils.initalizationErrorMessage(JSON.stringify(event),
      process.env.SKX_ENV,
      process.env.SKX_CONFIG_LAYER_ROOT));
    throw "<<ERROR>> Missing Required Parameters";
  }

  let filesProcessed = event.Records.map(async (record) => {
    let bucket = record.s3.bucket.name;
    let fileName = utils.getFileName(record.s3.object.key);
    let fileExtension = utils.getFileExtension(record.s3.object.key);
    console.log("fileExtension[" + fileExtension + "] fileName[" + fileName + "]");

    //Get report from S3
    let task,
      taskData,
      secretStore;

    try {
      var taskParams = {
        Bucket: bucket,
        Key: fileName + ".json"
      };
      task = await s3.getObject(taskParams).promise();
      taskData = JSON.parse(task.Body.toString('utf-8'));
      secretStore = await utils.getSecretStore(smClient, taskData);
    } catch (error) {
      console.log("<<ERROR>> Unable to get file from S3 " + error);
      throw "<<ERROR>> Unable to get file from S3 ";
    }

    //Generate CSV when required
    let csvContent = "";
    let csvFileName = fileName + ".csv";
    if (
      (JSON.stringify(taskData.transports).includes('ses') &&
        JSON.stringify(taskData.ses.delivery).includes('attachment')) ||
      (JSON.stringify(taskData.transports).includes('slack') &&
        JSON.stringify(taskData.ses.delivery).includes('attachment'))
    ) {
      if (taskData.results.hasOwnProperty(taskData.results.attachedReport)) {
        csvContent = await notifyUtils.generateCSVFromJson(taskData.results[taskData.results.attachedReport]);
      }
    }
    
    //Send Email
    try {
      if (JSON.stringify(taskData.transports).includes('ses')) {
        let template = await notifyUtils.getTemplate(handlebars, fs, taskData);
        let mailOptions = await notifyUtils.getMailOptions(template, csvContent, taskData, csvFileName);
        var transporter = nodemailer.createTransport({
          SES: ses
        });
        await transporter.sendMail(mailOptions)
      }
    } catch (error) {
      console.log("<<WARNING>> Unable to send email " + error);
    }

    //Notify Slack
    try {
      if (JSON.stringify(taskData.transports).includes('slack')) {
        await notifyUtils.notifySlack(taskData, csvContent, csvFileName, secretStore, WebClient, LogLevel);
      }
    } catch (error) {
      console.log("<<WARNING>> Unable to post to slack " + error);
    }

    //Notify Teams
    try {
      if (JSON.stringify(taskData.transports).includes('teams')) {
        let template = await notifyUtils.getTemplate(handlebars, fs, taskData);
        await notifyUtils.notifyTeams(taskData, csvContent, csvFileName, secretStore, axios, template);
      }
    } catch (error) {
      console.log("<<WARNING>> Unable to post to teams " + error);
    }

  });
  await Promise.all(filesProcessed);
  console.log("report notify run completed");
  return {
    body: JSON.stringify({
      message: 'report notify run completed',
      input: event
    })
  }
};
