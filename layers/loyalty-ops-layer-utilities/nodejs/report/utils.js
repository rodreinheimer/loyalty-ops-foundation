module.exports = {
    /**
     * @author reinhed
     * @desc This function is the interface to query types. 
     *      New query types shgould become new case in the switch statement
     *      Please do not duplicate query types
     * @returns Returns query result in json
     */
    getReport: async function(mysql, moment, connection, report) {
        let startTime = moment(Date.now())
        console.log("connection start[" + startTime + "] queryType[" + report.queryType + "] host[" + connection.host + "] user[" + connection.username + "] dbname[" + connection.dbname + "] connection[" + connection.queryConnectionTimeout + "]");
        
        //Configure connection
        const conn = await mysql.createConnection({
            host:           connection.host, 
            user:           connection.username, 
            password:       connection.password, 
            database:       connection.dbname,
            connectTimeout: connection.queryConnectionTimeout
        });
        let resultSet = "";
        switch (report.queryType) {
            case "LAST_14_DAYS":
                resultSet = await this.getLast14DaysReport(conn, report, moment);
                break;
            default:
                resultSet = await this.getDefaultReport(conn, report);
                break;
        }
        let endTime = moment(Date.now())
        console.log("Connection end[" + endTime + "] diff[" + endTime.diff(startTime) + "]");
        conn.destroy();
        return resultSet;
    },
    /**
     * @author reinhed
     * @desc The default query
     * @returns Returns query result in json
     */
    getDefaultReport: async function(conn, report) {
        console.log("Enter getDefaultReport");
        try {
            let [rows, fields] = await conn.query(report.query);
            return this.getResultSet(rows, fields);
        } catch (error) {
            conn.destroy();
            throw "<< ERROR >> Error while querying database.";
        } 
     },
    /**
     * @author reinhed
     * @desc The last 14 days query sample
     * @returns Returns query result in json
     */
     getLast14DaysReport: async function(conn, report, moment) {
        console.log("Enter getLast14DaysReport");
        try {
            let past = moment().subtract(14, 'days').format('YYYY-MM-DD HH:mm:ss');
            let now = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
            let [rows, fields] = await conn.query(report.query, [past, now]);
            return this.getResultSet(rows, fields);
        } catch (error) {
            conn.destroy();
            throw "<< ERROR >> Error while querying database.";
        } 
     },
    /**
     * @author reinhed
     * @desc Iterate over result set
     * @returns Returns query result in json
     */
     getResultSet: async function(rows, fields) {
        //Generate returnr agnostic result set
        result = "{\"records\":[";
        Object.keys(rows).forEach(function(rKey) {
            result += "[";
            Object.keys(fields).forEach(function(fKey) {
                let field = fields[fKey].name;
                result += "\"" + rows[rKey][field] + "\",";
            });
            result = result.slice(0, -1) + "],";
        });
        result = result.slice(0, -1) + "]}";
        return result;
     }
}