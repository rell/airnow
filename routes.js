const config = require('./db-config.js');
const mysql = require('mysql');
const async = require('async');
const pool = mysql.createPool(config); // added

config.connectionLimit = 10;
const connection = mysql.createPool(config);

/* -------------------------------------------------- */
/* ------------------- Route Handlers --------------- */
/* -------------------------------------------------- */

// helper functions
function split_date_string(date_string) {
  return date_string.split('-')
}

function round_sixth(value) {
  return Math.round(value * 1000000) / 1000000
}

function getUTCString(date_input, utcoff) {
  var offset_date = new Date((new Date(date_input)).getTime() + (utcoff * 60 * 60 * 1000));
  var [UTC_year, UTC_month, UTC_date, UTC_hour, UTC_minute] = divide_time(offset_date)
  var [UTC_month, UTC_date, UTC_hour, UTC_minute] = [add_leading0(UTC_month), add_leading0(UTC_date), add_leading0(UTC_hour), add_leading0(UTC_minute)];
  var UTC_string = `${UTC_year}-${UTC_month}-${UTC_date}T${UTC_hour}:${UTC_minute}:00.000Z`;
  return UTC_string;
}

// queries
// get all stations
function query_all_stations() {
  return `SELECT * FROM Stations ORDER BY sitename`;
}

// get one station
function query_one_station(stationid) {
  return `SELECT * FROM Stations WHERE stationid = '${stationid}'`
}

// get one-hour observation values from all stations
function query_all_stations_one_hour_actual(year, month, day, hour) {
    return `WITH hour_filter as (SELECT DISTINCT * FROM PM25_Hourly\
          WHERE YEAR(UTC) = ${year} AND MONTH(UTC) = ${month} AND DAY(UTC) = ${day} AND HOUR(UTC) = ${hour})\
          SELECT * FROM hour_filter RIGHT JOIN Stations
          on hour_filter.stationid = Stations.stationid
          ORDER BY sitename`;
}

// get all observation values from one station
function query_one_station_all_hours_actual(stationid){
  return `SELECT * FROM PM25_Hourly WHERE stationid = '${stationid}'`;
}

// get one-hour prediction values from all stations
function query_all_stations_one_hour_prediction(init_year, init_month, init_day, fore_year, fore_month, fore_day, fore_hour) {
  return `WITH hour_filter as (SELECT * FROM PM25_Predictions
  WHERE YEAR(UTC) = ${init_year} AND MONTH(UTC) = ${init_month} AND DAY(UTC) = ${init_day}
  AND YEAR(Forecast) = ${fore_year} AND MONTH(Forecast) = ${fore_month} AND DAY(Forecast) = ${fore_day} AND HOUR(Forecast) = ${fore_hour})
  SELECT * FROM hour_filter RIGHT JOIN Stations
          on hour_filter.stationid = Stations.stationid
          ORDER BY sitename`
}

// get all prediction values from one station for a given initialization date
function query_one_station_one_initial_prediction(stationid, init_year, init_month, init_day) {
  return `SELECT * FROM PM25_Predictions
          WHERE YEAR(UTC) = ${init_year} AND MONTH(UTC) = ${init_month} AND DAY(UTC) = ${init_day} AND stationid = '${stationid}'`
}

// get the three day average prediction value from one station given a initialization date
function query_one_station_one_initial_three_avg_day_prediction(stationid, init_year, init_month, init_day) {
  return `WITH day_filter as (SELECT * FROM PM25_Predictions
        WHERE YEAR(UTC) = ${init_year} AND MONTH(UTC) = ${init_month} AND DAY(UTC) = ${init_day} AND stationid = '${stationid}')
        SELECT DATE(Forecast) as Forecast, ROUND(AVG(Merra2), 3) as Merra2_avg, ROUND(AVG(Merra2_ML), 3) as Merra2_ML_avg FROM day_filter
        GROUP BY DATE(Forecast)`
}

// query prediction values with both time and station filter
function query_api_predictions(f_init_date=null, f_predict_date=null, f_predict_time=null,
                               sitename=null, station_lat=null, station_lon=null, stationid=null,
                               nw_lat=null, nw_lon=null, se_lat=null, se_lon=null) {

  // filter prediction_sql
  prediction_sql = 'SELECT * FROM PM25_Predictions as p WHERE stationid IS NOT NULL'
  if (f_init_date) {
    var f_init_split = split_date_string(f_init_date)
    prediction_sql += ` AND YEAR(UTC) = ${f_init_split[0]} AND MONTH(UTC) = ${f_init_split[1]} AND DAY(UTC) = ${f_init_split[2]}`
  }
  if (f_predict_date) {
    var f_predict_split = split_date_string(f_predict_date)
    prediction_sql += ` AND YEAR(Forecast) = ${f_predict_split[0]} AND MONTH(Forecast) = ${f_predict_split[1]} AND DAY(Forecast) = ${f_predict_split[2]}`
  }
  if (f_predict_time) prediction_sql += ` AND HOUR(Forecast) = ${f_predict_time}`
  if (stationid) prediction_sql += ` AND stationid = '${stationid}'`

  // filter station_sql
  station_sql = 'SELECT * FROM Stations as s WHERE stationid IS NOT NULL'
  if (sitename) station_sql += ` AND sitename = '${sitename}'`
  if (station_lat) station_sql += ` AND Round(Latitude, 6) = ${round_sixth(station_lat)}`
  if (station_lon) station_sql += ` AND Round(Longitude, 6) = ${round_sixth(station_lon)}`
  if (nw_lat && nw_lon && se_lat && se_lon) {
    station_sql +=` AND Round(Latitude, 6) < ${round_sixth(nw_lat)} AND Round(Latitude, 6) > ${round_sixth(se_lat)}\
    AND Round(Longitude, 6) < ${round_sixth(se_lon)} AND Round(Longitude, 6) > ${round_sixth(nw_lon)}`
  }

  combined_sql = `WITH prediction_filter as (${prediction_sql}),
                 station_filter as (${station_sql})
                 SELECT * FROM station_filter NATURAL JOIN prediction_filter`

  console.log(prediction_sql)
  console.log(station_sql)
  console.log(combined_sql)
  return combined_sql
}


// returns main page
var getMain = function (req, res) {
  res.render('main.ejs');
//res.redirect('/test'); 
};
/*var getTest = function (req, res) {
  //res.render('../../GEO_AIRNOW_TT/airnow_app/views/main.ejs');
  //console.log('test page')
  //res.send("Redirected to test Page");
  res.render('main.ejs');
};*/
// returns all stations
var getStations = function(req, res) {
  var query = query_all_stations()
  connection.query(query, function(err, rows, fields) {
    if (err) console.log(err);
    else res.json(rows)
  })
}

// returns field of all site at an hour
var getHourlyActual = function(req, res) {
  var [year, month, day, hour] = [req.query['year'], req.query['month'], req.query['day'], req.query['hour']]
  var query = query_all_stations_one_hour_actual(year, month, day, hour)
  connection.query(query, function(err, rows, fields) {
    if (err) console.log(err);
    else res.json(rows)
  })
}

// return predictions of all site at an hour
var getHourlyPrediction = function(req, res) {
  var [init_year, init_month, init_day] = [req.query['init_year'], req.query['init_month'], req.query['init_day']]
  var [fore_year, fore_month, fore_day, fore_hour] = [req.query['fore_year'], req.query['fore_month'], req.query['fore_day'], req.query['fore_hour']]
  var query = query_all_stations_one_hour_prediction(init_year, init_month, init_day, fore_year, fore_month, fore_day, fore_hour)
  connection.query(query, function(err, rows, fields) {
    if (err) console.log(err);
    else res.json(rows)
  })     
}

// returns field of one site at all hours
var getStationPlot = function(req, res) {
  var [stationid, init_year, init_month, init_day] = [req.query['stationid'], req.query['init_year'], req.query['init_month'], req.query['init_date']];
  var query =  `${query_one_station(stationid)};
                ${query_one_station_all_hours_actual(stationid)};
                ${query_one_station_one_initial_prediction(stationid, init_year, init_month, init_day)};
                ${query_one_station_one_initial_three_avg_day_prediction(stationid, init_year, init_month, init_day)};`
  var return_data = {};
  connection.query(query, [1, 2, 3, 4], function(err, rows, fields) {
    if (err) console.log(err);
    else {
      var return_data = {'station_info': rows[0][0], 'pm25_hour': rows[1], 'predictions': rows[2],
                         'grouped_predictions': rows[3]
      }
      res.json(return_data);
    }
  })
}

var queryPredictions = function(req, res) {
  var query = query_api_predictions(req.query.f_init_date, req.query.f_predict_date, req.query.f_predict_time,
                                    req.query.sitename, req.query.station_lat, req.query.station_lon, req.query.stationid,
                                    req.query.nw_lat, req.query.nw_lon, req.query.se_lat, req.query.se_lon);
  connection.query(query, function(err, rows, fields) {
    if (err) console.log(err);
    else res.json(rows)
  })
}


module.exports = {
 get_main: getMain,
 //get_test: getTest,
 get_stations: getStations,
 get_hourly_actual: getHourlyActual,
 get_hourly_prediction: getHourlyPrediction,
 get_station_plot: getStationPlot,
 query_predictions: queryPredictions
};
