module.exports = {
    getSecretStore: async function(client, task) {
        let secretName = await this.replaceKeywords(task.secretStore, task);
        let secret = await client.getSecretValue({'SecretId': secretName}).promise();
        return JSON.parse(secret.SecretString);
    },

    isNullOrEmptyValue: function(value) {
        return !value;
    },

    eventHasRegion: function(event) {
        return event.hasOwnProperty('region');
    },

    eventHasBrand: function(event) {
        return event.hasOwnProperty('brand');
    },

    eventHasTaskId: function(event) {
        return event.hasOwnProperty('taskId');
    },

    /*
     * This returns initialization detail error message.
     */
    initalizationErrorMessage: function(event, environment, layerRoot) {
        return [
            '<<ERROR>> Missing Required Paramenters\n',
            '(1) PROCESS.ENV.SKX_ENV:\n',
            'Should reflect the environment lambda is running in\n',
            '   This value will be prepend to properties file name.\n',
            '   Allowed values: prd and dev\n',
            '   Example:\n',
            '       dev-skx-eu.js | dev-skx-us.js | prd-skx-it.js...\n',
            '       where ENV = dev | prd\n',
            '------\n',
            environment + '\n',
            '------\n',
            '',
            '(2) PROCESS.ENV.SKX_CONFIG_LAYER_ROOT:\n',
            'Location of code in the configuration layer\n',
            '   node will look load properties at this location\n',
            '   Example:\n',
            '   SKX_CONFIG_LAYER_ROOT = /opt/nodejs/config\n',
            '------\n',
            layerRoot + '\n',
            '------\n',
            '',
            '(3) EVENT.BRAND and EVENT.REGION:\n',
            'Should reflect the brand and geoloaction\n',
            '   Value will be appended to properties file name\n',
            '   Example:\n',
            '       EVENT.BRAND = skx\n',
            '       EVENT.REGION = eu | gb | it | us | na (north america) | ...\n',
            '',
            '(4) EVENT.REPORTID:\n',
            'Must have a report identifier to run\n',
            '   Value is used a key to find properties applicable to this report\n',
            '   Example:\n',
            '       EVENT.REPORTID = ORDERS_REPORT | USER_REPORT | ...\n',
            '------\n',
            event,
            '------\n',
          ].join('');
    },

    /**
     * @author reinhed
     * @desc Prepare date value to be appended to report name
     * @returns Returns date in string format
     */
    getFileSuffixDate: function(date_ob) {
        let date = this.setIntTwoChars(date_ob.getDate());
        let month = this.setIntTwoChars(date_ob.getMonth() + 1);
        let year = date_ob.getFullYear();
        let hours = this.setIntTwoChars(date_ob.getHours());
        let minutes = this.setIntTwoChars(date_ob.getMinutes());
        let seconds = this.setIntTwoChars(date_ob.getSeconds());
        return `${year}-${month}-${date}_${hours}${minutes}${seconds}`;
    }, 
    /**
     * @author reinhed
     * @desc Prepare date to be displayed in notifications
     * @returns Returns date in string format
     */
    getDisplayDate: function(date_ob) {
        let date = this.setIntTwoChars(date_ob.getDate());
        let month = this.setIntTwoChars(date_ob.getMonth() + 1);
        let year = date_ob.getFullYear();
        let hours = this.setIntTwoChars(date_ob.getHours());
        let minutes = this.setIntTwoChars(date_ob.getMinutes());
        let seconds = this.setIntTwoChars(date_ob.getSeconds());
        return `${month}-${date}-${year}_${hours}:${minutes}:${seconds}`;
    }, 
    /**
     * @author reinhed
     * @desc Date utility function
     * @returns Returns date element in 2-digit
     */
    setIntTwoChars: function(i) {
        return (`0${i}`).slice(-2);
    },
    /**
     * @author reinhed
     * @desc File name utility function
     * @returns Returns file extension
     */
    getFileExtension: function(file) {
        return file.split('.').pop();
    },
    /**
     * @author reinhed
     * @desc File name utility function
     * @returns Returns name of file with extension
     */
    getFileName: function(file) {
        return file.split('.').shift();
    },
    /**
     * @author reinhed
     * @desc Text utility function, replace labeled text
     * @returns Returns normalized text
     */
    replaceKeywords: async function(text, reportData) {
        switch (true) {
            case text.includes('@ENVIRONMENT'):
                text = text.replace('@ENVIRONMENT',reportData.environment.toUpperCase());

            case text.includes('@BRAND'):
                text = text.replace('@BRAND',reportData.event.brand.toUpperCase());

            case text.includes('@BRAND_REGION'):
                text = text.replace('@BRAND_REGION',reportData.event.region.toUpperCase());

            case text.includes('@NOW'):
                let date_ob = new Date();
                text = text.replace('@NOW',
                    this.getDisplayDate(date_ob)
                );

            case text.includes('@PERIOD'):
                text = text.replace('@PERIOD',reportData.event.ageInHours);
        }
        return text;
    }
}