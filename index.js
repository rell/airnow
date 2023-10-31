const bodyParser = require('body-parser');
const express = require('express');
var routes = require("./routes.js");
var routes_goes=require("./routes-goes.js");
const cors = require('cors');

const app = express();

app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

/* ---------------------------------------------------------------- */
/* ------------------- Route handler registration ----------------- */
/* ---------------------------------------------------------------- */
app.get('/goes', routes_goes.get_main_goes)
app.get('/goes-getstations', routes_goes.get_stations_goes); // get stations
app.get('/goes-gethourlyactual', routes_goes.get_hourly_actual_goes)
// get actual data at one hour
app.get('/goes-gethourlygoes', routes_goes.get_hourly_goes)
//app.get('/gethourlyprediction', routes.get_hourly_prediction) // get prediction data at one hour
app.get('/goes-getstationplot', routes_goes.get_station_plot_goes) // get plot data
app.get('/goes-getdate', routes_goes.get_date_goes)
app.get('/', routes.get_main); // load initial html page
/*app.get('/test', (req, res) => {
  res.redirect('test page');
});*/


//app.get('/test',routes.get_test);
app.get('/getstations', routes.get_stations); // get stations
app.get('/gethourlyactual', routes.get_hourly_actual) // get actual data at one hour
app.get('/gethourlyprediction', routes.get_hourly_prediction) // get prediction data at one hour
app.get('/getstationplot', routes.get_station_plot) // get plot data

app.get('/querypredictions/', routes.query_predictions)

app.listen(8081, () => {
	console.log(`Server listening on PORT 8081`);
});
