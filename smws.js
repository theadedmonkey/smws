var request = require('request');
var cheerio = require('cheerio');
var smws = require('commander');
var url = require('url');

smws
  .version('0.0.1')
  .option('-y, --year <n>', 'Add year', parseInt)
  .option('-m, --month <n>', 'Add month', parseInt)
  .parse(process.argv);

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

function toDateSmashing(date) {
  var dateSmashing = {};
  // is january
  if ( date.month === 1 ) {
    dateSmashing.year = date.year - 1;
    dateSmashing.month = 12;
  }
  // other months
  else {
    dateSmashing.year = date.year
    dateSmashing.month = zFill(date.month - 1, 2);
  }

  return dateSmashing;
}

function zFill(number, length) {
  var numberStr = number.toString();
  return numberStr.length === length
    ? numberStr
    : zFill('0'.concat(numberStr), length)
};

//

var date = {
  year:  smws.year,
  month: smws.month
};

var dateSmashing = toDateSmashing(date);

var urlSmashing = url.resolve(
  'https://www.smashingmagazine.com', [
      dateSmashing.year
    , dateSmashing.month
    , [
        'desktop-wallpaper-calendars'
        , monthNames[date.month - 1]
        , date.year
      ].join('-')
  ].join('/')
);

console.log(urlSmashing);

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


request(urlSmashing, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var $ = cheerio.load(body);
    var $body = $('body');

    // list of all wallpapers
    var wallpapers = [];

    // list of h3
    var $titles = $body
      .find('h3')
      .filter(function(i, el) {
        return $(el)
          .attr('id')
      })
      .filter(function(i, el) {
        return $(el)
          .prop('id')
          .indexOf(zFill(date.month, 2) + '-' + date.year) > -1
      })


    $titles.each(function(i, el) {

      var wallpaper = {
        title: '',
        resolutions: []
      };

      wallpaper.title = $(el).text();

      var $resolutions = $(el)
        .nextAll('ul')
        .first()
        .find('li:contains("without calendar")')
        .find('> a')

      $resolutions.each(function(i, el) {
        wallpaper.resolutions.push($(el).text())
      });

      wallpapers.push(wallpaper);

    });

    wallpapers.map(function(wallpaper) {
      console.log(wallpaper.title);
      console.log(wallpaper.resolutions);
      console.log('-------------------');
    });
  }
})
