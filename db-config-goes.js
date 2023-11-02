
const ini = require('ini');
const fs = require('fs')


function parseConfigFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const config = ini.parse(fileContent);
        const { HOST, USER, PASSWORD, PORT, DATABASE } = config.database_geos;
        return { HOST, USER, PASSWORD, PORT, DATABASE };
    } catch (error) {

        console.error(`Error reading or parsing file: ${error}`);
    }
}

const config = parseConfigFile('./config.ini');

module.exports = {
  host: config.HOST,
  user: config.USER,
  password: config.PASSWORD,
  port: config.PORT,
  database: config.DATABASE,
  multipleStatements: true,
  timezone: 'utc'
}
