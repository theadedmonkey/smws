var request = require('request');
var cheerio = require('cheerio');
var smws = require('commander');

smws
  .version('0.0.1')
  .option('-y, --year <n>', 'Add year', parseInt)
  .option('-m, --month <n>', 'Add month', parseInt)
  .parse(process.argv);


console.log('you want wallpapers:');
if (smws.year) console.log('  - year');
if (smws.month) console.log('  - month');

//console.log(smws.year, smws.month);

var monthNames = [
    'january'
  , 'february'
  , 'march'
  , 'april'
  , 'may'
  , 'june'
  , 'july'
  , 'august'
  , 'september'
  , 'november'
  , 'december'
];

var date = {
  year:  smws.year,
  month: smws.month,
  yearSmashing: smws.year,
  monthSmashing: smws.month
};

function normalizeDate(date) {
  // is january
  if ( date.month === 1 ) {
    date.yearSmashing  = date.year - 1;
    date.monthSmashing = 12;
  }
  // other months
  else {
    date.monthSmashing = zFill(date.month - 1, 2);
  }
};
normalizeDate(date)
console.log(date);


function zFill(number, length) {
  var numberStr = number.toString();
  return numberStr.length === length
    ? numberStr
    : zFill('0'.concat(numberStr), length)
};

function smashingUrl(date) {
  return ''.concat(
      '/'
    , date.yearSmashing
    , '/'
    , date.monthSmashing
    , '/'
    , 'desktop-wallpaper-calendars-'
    , monthNames[date.month - 1]
    , '-'
    , date.year
  )
};

console.log(smashingUrl(date))

/*
 * the schema of the smashing magazine url for wallpapers:
 *
 * /2015/12/desktop-wallpaper-calendars-january-2016/
 *
 * year:  2015
 * month: 12
 * name:  desktop-wallpaper-calendars-january-2016
 *
 * /2016/01/desktop-wallpaper-calendars-february-2016/
 *
 * year:  2016
 * month: 01
 * name:  desktop-wallpaper-calendars-february-2016
 */


var smashingUrlFull = 'https://www.smashingmagazine.com' + smashingUrl(date);
console.log(smashingUrlFull);


request(smashingUrlFull, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var $ = cheerio.load(body);
    var $body = $('body');
    var $titles = $body.find('h3');
    $titles.each(function(i, elem) {
      console.log($(this).text())
    });
  }
})
