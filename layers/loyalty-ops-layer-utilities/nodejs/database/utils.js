module.exports = {
    /**
     * @author reinhed
     * @desc Loads database connection from configuration.
     * If secret name is DEFAULT_TO_LOCAL 
     *    This function will return the database object defined in the property
     *    This is to be used for local test only
     * Otherwise 
     *    This function will retreve db info from AWS secret manager
     * @returns database connection object
     */
    getDatabaseConnection: async function (client, database) {
        let secretName = database.connection.secret;
        if (secretName === "DEFAULT_TO_LOCAL") {
            return database.connection;
        } else {
            let secret = await client.getSecretValue({ 'SecretId': secretName }).promise();
            return JSON.parse(secret.SecretString);
        }
    },
    findAllRecordsInThePeriod: async function (client, databaseName, collectionName, queryMatchDateLowerBound, queryLimit) {
        const cursor = client.db(databaseName).collection(collectionName).
            find({
                updated_at: {
                    $gte: queryMatchDateLowerBound
                },
            }).
            project({
                sessionm_id: 1,
                store_id: 1,
                total_transaction_amount: 1,
                created_at: 1,
                updated_at: 1,
                'numberOfAttempts': {
                    '$cond': {
                        'if': {
                            '$isArray': '$attempts'
                        },
                        'then': {
                            '$size': '$attempts'
                        },
                        'else': 'NA'
                    }
                }
            }).
            sort({
                updated_at: -1
            }).
            limit(queryLimit);
        return await cursor.toArray();
    },
    findTopUsageGroupedByDynamicField: async function (client, databaseName, collectionName, queryMatchDateLowerBound, queryGroupByField, querySortByField, querySumFieldName, querySumFieldValue, queryLimit) {
    const pipeline = [
        {
          '$match': {
            'updated_at': {
              '$gte': queryMatchDateLowerBound
            }
          }
        }, {
          '$group': {
            '_id': queryGroupByField, 
            [querySumFieldName]: {
              '$sum': querySumFieldValue
            }, 
            'itemCount': {
              '$count': {}
            }
          }
        }, {
          '$sort': {
            [querySortByField]: -1
          }
        }, {
          '$limit': queryLimit
        }
      ];
      const cursor = client.db(databaseName).collection(collectionName).aggregate(pipeline);
      return await cursor.toArray();
}
}