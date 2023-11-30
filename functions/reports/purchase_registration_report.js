const aws = require('aws-sdk');
const s3 = new aws.S3();
const {MongoClient} = require('mongodb');
const moment = require('moment');
const utils = require('/opt/nodejs/common/utils');
const databaseUtils = require('/opt/nodejs/database/utils');

var config;

 var smClient = new aws.SecretsManager({
     region: process.env.region
 });

/**
 * @author reinhed
 * @desc This function will executed asyncronously by cloudwatch,
 *  This function lift configuation based event values
 *  Sample event: {"brand": "tbl", "region": "eu", "tasktId": "ORDERS_REPORT" }
 *      Process will do the following steps based on the values defined properties
 *      1. event.brand/event.region and process.env define which property file to load
 *      2. Property file defines query to run and bucket to post result
 *      3. Process completes once file is writen to S3
 */
exports.handler = async function(event, context) {
    console.log("task run start");
    //see emptyEventLoop info here: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
    context.callbackWaitsForEmptyEventLoop = false;
    let task,                               //task configuration
        taskData,                           //task data
        bucketName;                         //bucket name
    let topStores,                          //Results group by Store
        topUsers,                           //Results group by User
        allRecords;                         //All Results
    let fileNameDateSuffix = new Date();    //appended to file name

    //Fail Job if any of the required properties are missing
    if(utils.isNullOrEmptyValue(process.env.SKX_ENV) || 
        utils.isNullOrEmptyValue(process.env.SKX_CONFIG_LAYER_ROOT) ||
        !utils.eventHasBrand(event) ||
        !utils.eventHasRegion(event) ||
        !utils.eventHasTaskId(event)) {
            console.error(utils.initalizationErrorMessage(JSON.stringify(event),
                process.env.SKX_ENV,
                process.env.SKX_CONFIG_LAYER_ROOT));
            throw "<<ERROR>> Missing Required Parameters";
    }

    //Fail Job if any of the required properties are missing
    try {
        //Load config
        process.env["NODE_ENV"] = process.env.SKX_ENV;    
        process.env["NODE_APP_INSTANCE"] = event.brand + "-" + event.region;
        process.env["NODE_CONFIG_DIR"] = process.env.SKX_CONFIG_LAYER_ROOT + "/" + event.brand;
        config = require('config');
        
        //Init task from config
        task = config[event.taskId];

        //Merge event and task config
        task.environment = process.env.SKX_ENV;
        task.defaults = config.defaults;
        task.event = event;

        //Validate and set defaults
        if(task.hasOwnProperty('ses'))
        {
            if(!task.ses.hasOwnProperty('template')) {
                task.ses.template = report.defaults.template;
            }
        }

    } catch (error) {
        throw "<<ERROR>> Missing Required Configuration. Please review configuration properties "  + error;
    }

    //Prepare file name
    let reportNameSuffix = utils.getFileSuffixDate(fileNameDateSuffix);
    let reportNamePrefix = event.taskId + "_" + reportNameSuffix;
    
    /*
     * Database tasks
     */
    try {
        const secretStore = await utils.getSecretStore(smClient, task);
        const uri = `mongodb+srv://${secretStore.MDB_USER}:${secretStore.MDB_PASSWORD}@${secretStore.MDB_CLUSTER}/${secretStore.MDB_DATABASE}?retryWrites=true&w=majority`;
        const client = new MongoClient(uri, 
            {
                connectTimeoutMS: task.mongoConnectTimeoutMS,
                serverSelectionTimeoutMS: task.mongoServerSelectionTimeoutMS
            });
        const queryMatchDateLowerBound = new Date(moment().subtract(event.ageInHours, 'hours').utc().format("YYYY-MM-DD HH:mm:ss"));
        const queryGroupByStoreId = "$store_id";
        const querySortByField = "totalAmount"
        const queryGroupBySessionMId = "$sessionm_id";
        const querySumFieldValue = "$total_transaction_amount";
        const querySumFieldName = "totalAmount";
        const groupedQueryLimit = task.mongoGroupedQueryLimit;
        const queryLimit = task.mongoQueryLimit;
        console.log(queryMatchDateLowerBound);
        topStores = await databaseUtils.findTopUsageGroupedByDynamicField (
            client, task.mongoDatabaseName, task.mongoCollectionName, 
            queryMatchDateLowerBound, queryGroupByStoreId, querySortByField, 
            querySumFieldName, querySumFieldValue, groupedQueryLimit);
        topUsers = await databaseUtils.findTopUsageGroupedByDynamicField (
            client, task.mongoDatabaseName, task.mongoCollectionName, 
            queryMatchDateLowerBound, queryGroupBySessionMId, querySortByField, 
            querySumFieldName, querySumFieldValue, groupedQueryLimit);
        allRecords = await databaseUtils.findAllRecordsInThePeriod (
            client, task.mongoDatabaseName, task.mongoCollectionName, 
            queryMatchDateLowerBound, queryLimit);
        task.results.topStores.records = topStores
        task.results.topUsers.records = topUsers
        task.results.allUsers.records = allRecords
        console.log('report: ' + JSON.stringify(task));
    } catch (error) {
        throw "<<ERROR>> Database error " + error;
    }
    
    //No data reported warning
    if (utils.isNullOrEmptyValue(allRecords)) {
        console.log("<<WARNING>> No data reported");
    }
    
    /*
     * S3 tasks
     */
    try {
        bucketName = task.bucketName;
        taskData = JSON.stringify(task);

        //Prepare json with report meta-data
        let fname = reportNamePrefix + '.json';
        let taskParams = {
            Bucket: bucketName,
            Key: fname,
            Body: taskData,
            ContentType: 'text/json'
        };
        //Put report meta-data to s3
        console.log("bucketName[" + bucketName + "] fileName[" + fname + "]");
        let putTaskDataResult = await s3.putObject(taskParams).promise(); 
        console.log("putTaskDataResult[" + JSON.stringify(putTaskDataResult) + "]");
        
    } catch (error) {
        throw "<<ERROR>> Unable to post to S3 " + error;
    } 

    console.log("report run completed.");

    return {
        body: JSON.stringify({
          message: 'report run completed.'
        })
    }

};